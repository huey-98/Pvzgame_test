# AGENTS.md

面向后续开发者的协作说明。修改代码前先阅读本文件；功能或规则变更后同步更新 `README.md`、`DEVELOPMENT_PLAN.md` 和 `DEVELOPMENT_LOG.md`。

## 项目概览

- 项目：`街区警戒线`，9:16 竖屏单手 Roguelite 僵尸生存射击游戏。
- 前端：React + Vite + Canvas 2D；旧引擎模块继续使用 `window.Game`，React 负责低频界面，Canvas 负责高频战斗表现。
- 后端：Python 3.13 + FastAPI + SQLAlchemy + SQLite，依赖见 `server/requirements.txt`。
- 生产启动：`npm --prefix frontend run build` 后执行 `.venv\Scripts\python server\run.py`，访问 `http://127.0.0.1:8787`。
- React 开发：后端保持 `8787`，另启 `npm --prefix frontend run dev`，访问 `http://127.0.0.1:5173`。
- 旧脚本由 `index.html` 按固定顺序加载；React 入口在 `frontend/src/game/engine.js` 中保持同一顺序。

## 运行与验证

改完代码后至少执行：

```powershell
npm --prefix frontend run build
node tmp\check-react-ssr.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

按改动范围追加验证：

```powershell
# 后端改动
.venv\Scripts\python -m compileall server

# 账户 / 数据层
.venv\Scripts\python tmp\check_db.py
.venv\Scripts\python tmp\check_api.py http://127.0.0.1:8787
node tmp\check-accounts.js

# 角色、装备、城墙、宝石、奖励
node tmp\check-character.js
node tmp\check-equipment.js
node tmp\check-wall.js
node tmp\check-gems.js
node tmp\check-rewards.js
node tmp\check-skills.js

# 敌人机制
node tmp\check-bomber.js
node tmp\trace-boss.js
```

- 逻辑回归优先写成一次性 `node -e`；Canvas 可用 `Proxy` 桩模拟 `getContext("2d")`。
- 本机不能用无头浏览器做画面验证。用 `tmp/trace-draw.js` 记录绘制指令到 `tmp/draw-ops.json`，再用 `tmp/replay-draw.py` 回放 PNG。
- `trace-draw.js` 支持 `enemies`、`status`、`wasp`、`wheelchair`、`frostBeast`、`lizard`、`bomber`、`codex ...`、`account ...` 等场景。
- 调试脚本、日志、截图和导出数据一律放在 `tmp/`；需要长期复用的内容才移入 `src/` 或文档。
- 不引入测试框架、Redux、TypeScript 或新的运行时依赖，除非用户明确要求；React/Vite 依赖只由 `frontend/package.json` 管理。

## 代码结构与边界

旧引擎加载顺序：`config → attributes → equipment → wall → gems → skills → accounts → utils → state → combat → update → sprites → render → input → lifecycle`。React 入口在 `frontend/src/game/engine.js` 中同步这一顺序。

| 文件 | 职责 |
| --- | --- |
| `src/config.js` | 静态数据、数值、界面几何、关卡与图鉴配置 |
| `src/attributes.js` | 角色属性与外部修正的唯一计算层 |
| `src/equipment.js` / `wall.js` / `gems.js` | 装备、城墙、宝石的只读数据层 |
| `src/skills.js` | 账户技能等级与 72 个高级节点的只读数据层（`Game.skillProgress`） |
| `src/accounts.js` | 账户缓存、异步请求与持久化入口 |
| `src/utils.js` / `state.js` | 工具函数、单局状态与界面切换 |
| `src/combat.js` | 生成、瞄准、射击、碰撞、伤害、词条、技能效果 |
| `src/update.js` | 主循环、实体推进、波次和技能更新 |
| `src/sprites.js` / `render.js` | 资源加载与 Canvas 战斗绘制；React 模式下不绘制旧菜单 |
| `src/input.js` / `lifecycle.js` | 输入绑定 / 清理、引擎挂载 / 卸载与动画循环 |
| `frontend/src/game/ui-store.js` | 10 Hz 不可变 UI 快照与订阅 |
| `frontend/src/game/actions.js` | React 进入游戏命令层的唯一入口 |
| `frontend/src/game/GameCanvas.jsx` | Canvas 主机与引擎生命周期 |
| `frontend/src/features/` | 首页、账户、关卡、图鉴、角色养成与战斗浮层 |

- 数据进 `config`，状态进 `state`，战斗规则进 `combat` / `update`，Canvas 绘制只进 `render`，输入只进 `input`。
- React 不直接修改 `Game.state`，不持有敌人、弹体、粒子或技能实体数组；所有操作经 `frontend/src/game/actions.js`。
- `ui-store.js` 只发布低频界面快照；HUD 高频变化以 10 Hz 更新，战斗循环仍由 Canvas 引擎驱动。
- React 浮层打开时必须阻止事件穿透到 Canvas；战场瞄准和坐标相关操作继续留在 Canvas。
- `render.js` 只读状态和账户缓存，不发起请求、不修改战斗状态。
- 后端路由只做请求解析与响应组装；数据访问统一经 SQLAlchemy 会话，不写散落裸 SQL。

## 命名与风格

- 旧引擎保持 IIFE 严格模式：`(function (Game) { "use strict"; ... })(window.Game = window.Game || {});`，使用 `var`、函数表达式和 ES5 语法。
- 新 React 代码使用 ES Module + JSX，可通过 Vite 构建；不要为旧引擎引入可选链等新语法。
- 常用缩写：旧引擎用 `C = Game.config`、`S = Game.state`、`U = Game.utils`；React 通过 `ui-store` 快照和 `actions` 命令访问。
- 公共游戏函数挂到 `Game.*`；React 组件不要复制战斗规则。
- 不添加注释，除非用户明确要求；现有注释只保留模块头部和配置注释。
- 文案使用简体中文。提交信息使用单段纯文本。

## 必须保持的核心规则

### 伤害与属性

- 六种属性为 `physical / energy / electric / ice / fire / wind`。
- 技能属性唯一来源是 `config.coreSkills[].element`，不要写进 `skillDefaults`；步枪属性只通过 `Game.getRifleElement` 获取。
- 所有伤害必须走 `Game.damageEnemy`。生成弹体或伤害实体时快照 `element` 与 `damageSource`。
- 属性抗性读 `damageTakenByElement`，来源减伤读 `damageTakenBySource`，唯一入口分别是 `Game.getElementDamageScale` 和 `Game.getDamageSourceScale`，且只在 `damageEnemy` 中使用。
- 结算顺序：护甲格挡 → 属性 / 来源 / 致伤倍率 → 扣血；护甲格挡时不记录 `lastHitElement`。
- 燃烧与冻伤的持续伤害不走属性倍率。
- 属性与抗性信息只显示在技能 / 僵尸图鉴，不显示在 HUD、伤害数字或特效中。

### 状态、护甲与移动

- 状态统一使用 `config.statusEffects`：伤害性 `burn / frostbite`，软控 `slow / knockback / pull`，硬控 `stun / freeze / paralysis`，削弱 `wound`。
- 所有负面状态必须走公开入口：`applySlow`、`applyKnockback`、`applyPull`、`applyStun`、`applyFreeze`、`applyParalysis`、`applyBurn`、`applyFrostbite`、`applyWound`；不要直接写 `enemy.slow`、`enemy.control` 或直接改坐标。
- 硬控共用 `enemy.control` / `enemy.controlType`，判断统一用 `Game.isHardControlled`，不要读取 `enemy.stun`。
- 免疫与时长缩放统一走 `Game.getStatusScale(enemy, status)`；免疫判定先于护甲消耗。击退倍率表示距离，牵引倍率表示速度。
- 护甲层数只能由 `Game.blockWithArmor` 扣除，同时抵挡伤害、状态、击退和牵引。
- 敌人移动速度只能通过 `Game.getEnemyMoveSpeed` 计算；它统一处理硬控、减速、狂暴和低血加速。
- 回血必须乘 `Game.getHealScale`，以正确应用重伤和禁疗。
- 狂暴期间 `Game.getStatusScale` 返回 0，`Game.damageEnemy` 拒绝伤害；统一用 `Game.isRaging` / `Game.tryStartRage` 判断与触发。

### 瞄准、技能与词条

- 自动索敌必须考虑预判、真实武器挂点和敌人停步位置；齐射锁一条真实弹道，使用 `Game.getAimAngleForShot`。
- 每个基础攻击周期只扣 1 发；齐射与连发额外弹丸不额外扣弹，最后一发连发完成后才换弹。
- 技能释放前必须通过 `Game.isSkillRangeEngaged(id)`；冷却就绪但未进入射程时保持在 0，不得空转进入冷却。索敌函数也必须过滤未进入距离的敌人。
- 技能槽上限由 `config.maxSkillSlots` 控制，当前为 4；已获得技能记录在 `player.skillOrder`，只进不出。
- `Game.unlockSkill` 是唯一解锁入口；常规流程不得传 `force`，测试场才允许强制解锁。
- `Game.rollTraits` 必须过滤满级、未满足条件、已解锁和满槽时的解锁词条；三张卡不能重复。
- `skillSlots` 几何必须同时被 `drawSkillSlots` 和 `input.js` 使用。长按预览状态只存于 `S.skillRangePreview`，暂停与重置时清空。

### 技能图纸与账户等级

- `player.skills[id].level` 只表示局内词条等级；账户等级单独保存在 `skill_progress`，由 `Game.skillProgress` 读取，禁止混写。
- 12 个核心技能账户等级为 Lv.1–31；升级价格、图纸校验和扣费只由服务端 `server/app/skills.py` 计算，客户端只展示 `nextCost`。
- 每级提供暴击率 +0.5%、对应技能伤害 +8%、冷却间隔 ×0.985；暴击仍受 95% 上限，冷却只乘 `fireTimer` 推进速度。
- 高级节点固定在 Lv.2/7/12/18/22/26。所有技能直伤、区域伤害、持续伤害和新增实体必须快照 `damageSource` / `progressSkillId`；持续伤害保留现有结算语义，在施加时应用账户倍率。
- 开局将账户等级快照到 `player.accountSkills`，战斗中不读取 `Game.accounts`；测试场固定 Lv.1。新增技能时必须同步 `config.skillProgress`、`config.skillProgressTraits`、前端图纸资源和服务端映射。

### 敌人与关卡

- 新敌人优先用 `config.enemies` 的可选字段表达机制，避免在 `spawnEnemy` / `update` 中堆 `type` 判断。
- 近战、远程、飞行的停步位置统一由 `Game.getEnemyHoldY(info)` 给出；远程字段是 `ranged`，飞行字段是 `flying`。
- 贴地技能在 `skillDefaults[].groundOnly` 标记，命中判断统一走 `Game.canHitEnemy`；当前贴地技能只有装甲车和燃油弹。
- 每种小怪都应有对应精英；精英固定在第 4 波，每局 1 只，可通过 `elitePool` 随机选择。
- 首领判断统一使用 `Game.isBossEnemy(enemy)`，不要写死 `enemy.type === "boss"`。正式波次的首领目前是尸潮领主，其他首领只进图鉴与测试场。
- 分裂与阈值召唤一律写入 `S.pendingSpawns`，由 `Game.flushPendingSpawns` 在更新末尾统一生成，不能在遍历中直接改 `S.enemies`。
- 寒霜兽类单位的 `blocksProjectiles` 会让弹道命中即止；狂暴冲锋、冻结回血、撞线爆炸等机制分别使用既有配置字段和入口，不要复制实现。
- 炸弹僵尸的低血加速、撞线爆炸和 `wallExplosionTriggered` 规则详见 `config.enemies` 与 README；任何移动或落点预判都必须使用统一速度接口。
- 新增特殊外观时同步更新 `render.js` 的类型判断；完整自定义身体绘制完成后尽早 `return`，不要继续叠加通用僵尸部件。
- 关卡与波次只配置在 `config.levels` / `waves` 中；`Game.reset` 后逻辑与 HUD 只读 `S.session.waves`。

## 常见扩展流程

### 新增敌人

1. 在 `config.enemies` 添加基础字段：`hp/speed/radius/damage/xp/color/accent`。
2. 添加 `codexCategory`（`minion` / `elite` / `boss`）、`description`、`tactics`。
3. 精英同步配置对应小怪和数值；特殊机制优先使用可选字段。
4. 在 `render.js` 补充外观分支，并按需更新测试场、图鉴与检查脚本。

### 新增核心技能

1. 在 `config.skillDefaults` 添加数值，在 `coreSkills` 添加图鉴条目、`range` 与 `element`。
2. 在 `config.skillTraits` 添加 `unlocksSkill: true` 的解锁词条和强化词条。
3. 在 `combat.js` 实现生成 / 命中 / 效果，在 `update.js` 接入推进，在 `render.js` 补充绘制。
4. 保持未解锁时不触发，并为伤害实体快照 `element` 与 `damageSource`。

### 新增关卡

1. 在 `config.js` 定义波次数组，每波包含 `total`、`interval`、`mix`，按需添加 `elite`、`elitePool`、`boss`、`hpScale`。
2. 向 `config.levels` 添加关卡数据，必填 `brief`，并校准 `hpScale` / `xpScale`。
3. 用 `tmp/check-level*.js`、`tmp/check-hp-budget.js`、`tmp/check-xp.js` 和关卡简介回放验证。

### 调整画面与输入

- 尺寸、锚点和挂点集中在 `config.sprites` / `config.skillRing`；改人物 PNG 后同步更新裁切图和锚点。
- 逻辑宽度固定为 `config.width`；`resizeCanvas` 会按显示比例重算高度并夹在合理范围。
- 所有点击区域必须与绘制共用同一套几何函数；修改 HUD、弹窗、技能槽或列表布局时同步检查 `input.js`。
- 画面改动必须通过 `trace-draw.js` + `replay-draw.py` 真实回放核对。

## 账户与后端

- SQLite 是账户、进度和资源数据的唯一来源；前端不得再用 `localStorage` 保存进度。
- 未登录或离线时只允许使用会话内缓存，刷新即失效，且必须明确提示“成绩未保存”。
- 前端访问账户数据的唯一入口是 `Game.accounts`；渲染层同步读取缓存，不直接发请求。
- 密码只存 PBKDF2-SHA256 哈希；会话 token 只存 SHA-256 摘要，使用 HttpOnly + SameSite=Strict Cookie。
- 服务只绑定 `127.0.0.1`；静态服务只暴露 `index.html`、`src/`、`styles/`、`assets/`、`pictures/`，绝不能暴露 `server/` 或 `data/`。
- `schema_version` 不是自动迁移机制。新增表可依赖 `create_all()`，新增字段必须手写兼容迁移。
- 账户技能进度由 `skill_progress(account_id, skill_id, level)` 保存，`/api/me` 幂等补齐 12 行；技能图纸是独立资源，不与部位图纸通用。
- 前端可提示格式问题，但用户名、密码、装备、城墙、宝石和奖励的最终校验必须在服务端。
- `/api/me/resources`、`/api/me/gems/grant` 和 `/api/me/rewards` 目前是调试 / 本地单机接口，缺少幂等或额度保护，不要视为可信的正式产出通道。

## React 前端

- 生产入口由 FastAPI 返回 `frontend/dist/index.html`；`/app-assets/` 只托管构建产物，`/assets/` 与 `/pictures/` 继续托管游戏素材。
- `frontend/src/game/engine.js` 是旧引擎导入顺序的唯一来源；新增旧模块时同步维护该文件。
- `Game.mount()` / `Game.destroy()` 必须保持幂等：挂载只允许一个 RAF 循环；卸载必须取消 RAF、定时器、窗口与 Canvas 监听。
- `render.js` 在 `Game.uiMode === "react"` 时只绘制战场；React 已接管的菜单、HUD、暂停、升级和结算不得回退到 Canvas 绑定。
- 新页面先通过 `actions.js` 定义命令，再由 `ui-store.js` 提供快照；不要在组件内直接写 `Game.state` 或请求 `/api`。
- 账户、装备、城墙、宝石、奖励仍以 `Game.accounts` 与 FastAPI 为权威数据源；React 只展示缓存和执行命令。
- Vite 构建资源目录固定为 `app-assets`，不要改回 `assets`，以免覆盖游戏素材。
- React 页面至少人工检查竖屏手机、桌面、滚动、弹窗层级、输入法、长按取消、点击穿透和离线状态。
- `#root` 必须保持全屏 Flex 居中；宽屏下游戏主体与测试场面板整体居中，不能贴左或依赖固定左边距。

## 已知限制

- 尚未实现针对玩家本人的投掷攻击、音效、联网和多设备同步。
- 账户是本地单机形态；换机器需要手动迁移 `data/blockline.db`。
- 钻石与零件目前没有正式产出。
- 人物和步枪使用 `assets/` 下的 PNG；敌人、装甲车、城墙和幻形仍由 Canvas 绘制。

## 文档同步

- 可玩内容或规则有变化：更新 `README.md`。
- 系统设计、数据层或验收方式有变化：更新 `DEVELOPMENT_PLAN.md`。
- 完成一轮开发：在 `DEVELOPMENT_LOG.md` 记录日期、改动和验证结果。
- `config`、README、开发计划与测试脚本之间存在重复数值时，必须一起核对。
