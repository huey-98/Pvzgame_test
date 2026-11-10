# 街区警戒线 · 开发手册

本手册按子系统说明「怎么做」，是日常开发的主要依据。规则红线见 `AGENTS.md`，玩家可见内容见 `README.md`，历史记录见 `DEVELOPMENT_LOG.md`。

## 0. 使用说明

### 0.1 手册定位

- 本手册只写**开发方式**：数据放在哪、由哪个函数负责、改动要同步什么、怎么验证。
- 具体数值以 `src/config.js` 与 `server/app/config.py` 为准，手册不复述可变的数字。
- 历史实现记录不在本手册，见 `DEVELOPMENT_LOG.md` 与 `docs/archive/`。

### 0.2 任务索引

| 任务 | 章节 |
| --- | --- |
| 新增敌人 / 精英 / 首领 | §18 |
| 新增核心技能 | §19 |
| 新增词条 / 超级词条 | §20 |
| 新增关卡 | §21 |
| 新增资源或通用功能 | §22 |
| 修改画面 / 输入 | §23 |
| 改伤害、状态规则 | §4、§5 |
| 改敌人机制 | §6 |
| 改技能行为 | §7、§8 |
| 改关卡节奏或数值 | §10 |
| 改账户 / 后端接口 | §15、§16、§17 |
| 性能优化 | §24 |
| 验收与归档 | §25、§26 |

### 0.3 新功能标准流程

1. 在 `docs/features/<slug>.md` 写临时开发计划（模板见 `docs/features/_template.md`）。
2. 按本手册对应章节实现，先改 `config`，再接战斗 / 界面。
3. 运行 §2 的必跑检查与对应专项脚本。
4. 更新对应文档：玩家可见内容改 `README.md`，开发方式改本手册，改动事实写入 `DEVELOPMENT_LOG.md`。
5. 计划完成后移入 `docs/archive/features/`，并在 `docs/README.md` 登记。
6. 运行 `node tmp/check-docs.js` 收尾。

### 0.4 文档分工

| 文档 | 职责 |
| --- | --- |
| `AGENTS.md` | 必须遵守的规则、验证入口、章节索引 |
| `DEVELOPMENT_PLAN.md` | 本手册：各部分开发方式 |
| `README.md` | 玩家可见的功能、运行方式与限制 |
| `DEVELOPMENT_LOG.md` | 每轮改动的事实记录 |
| `docs/features/` | 进行中的临时计划 |
| `docs/archive/` | 已完成计划与历史记录 |

## 1. 项目结构与启动

### 1.1 技术栈

- 前端：React + Vite + Canvas 2D。React 负责低频界面，Canvas 负责高频战斗。
- 后端：Python 3.13 + FastAPI + SQLAlchemy + SQLite，依赖见 `server/requirements.txt`。
- 旧引擎模块挂在 `window.Game` 上，React 通过 `frontend/src/game/engine.js` 按固定顺序导入。

### 1.2 目录结构

```text
index.html                 旧版免构建入口（离线回退）
src/                       旧引擎模块（ES5）
frontend/                  React + Vite 应用
server/                    FastAPI 服务
data/                      SQLite 数据库（不入库）
assets/ pictures/ styles/  素材与样式
tmp/                       调试与检查脚本（除 check-docs.js 外不入库）
docs/                      文档索引、临时计划与归档
```

### 1.3 旧引擎模块与加载顺序

`config → attributes → equipment → wall → gems → skills → rifle → accounts → utils → state → combat → update → sprites → render → input → lifecycle`

- `index.html` 与 `frontend/src/game/engine.js` 必须保持同一顺序。
- 新增旧模块时同步修改这两处。

| 文件 | 职责 |
| --- | --- |
| `src/config.js` | 静态数据、数值、界面几何、关卡与图鉴配置 |
| `src/attributes.js` | 角色属性与外部修正的唯一计算层 |
| `src/equipment.js` / `wall.js` / `gems.js` | 装备、城墙、宝石的只读数据层 |
| `src/skills.js` | 账户技能等级与高级节点（`Game.skillProgress`） |
| `src/rifle.js` | 步枪账户等级与节点（`Game.rifleProgress`） |
| `src/accounts.js` | 账户缓存、异步请求与持久化入口 |
| `src/utils.js` / `state.js` | 工具函数、单局状态与界面切换 |
| `src/combat.js` | 生成、瞄准、射击、碰撞、伤害、词条、技能效果 |
| `src/update.js` | 主循环、实体推进、波次和技能更新 |
| `src/sprites.js` / `render.js` | 资源加载与 Canvas 绘制 |
| `src/input.js` / `lifecycle.js` | 输入绑定 / 清理、引擎挂载与动画循环 |
| `frontend/src/game/ui-store.js` | 10 Hz 不可变 UI 快照 |
| `frontend/src/game/actions.js` | React 进入游戏命令层的唯一入口 |
| `frontend/src/game/GameCanvas.jsx` | Canvas 主机与引擎生命周期 |
| `frontend/src/features/` | 首页、账户、关卡、图鉴、角色与战斗浮层 |

### 1.4 数据与状态的边界

- 数据进 `config`，状态进 `state`，战斗规则进 `combat` / `update`，绘制只进 `render`，输入只进 `input`。
- React 不直接修改 `Game.state`，不持有敌人、弹体、粒子或技能实体数组。
- `render.js` 只读状态与账户缓存，不发请求、不改战斗状态。
- 后端路由只做请求解析与响应组装，数据访问统一经 SQLAlchemy 会话。

## 2. 运行与验证

### 2.1 启动

```powershell
# 生产模式
npm --prefix frontend run build
.venv\Scripts\python server\run.py          # http://127.0.0.1:8787

# React 开发模式（后端保持 8787）
npm --prefix frontend run dev               # http://127.0.0.1:5173

# 旧版离线回退
# 直接打开 index.html
```

### 2.2 必跑检查

每次改完代码至少执行：

```powershell
npm --prefix frontend run build
node tmp\check-react-ssr.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
node tmp\check-docs.js
git diff --check
```

### 2.3 专项脚本

按改动范围追加，脚本全部在 `tmp/`：

| 范围 | 脚本 |
| --- | --- |
| 后端 | `.venv\Scripts\python -m compileall server` |
| 数据层 / 接口 | `tmp\check_db.py`、`tmp\check_api.py <url>`、`check-accounts.js` |
| 角色 / 装备 / 城墙 / 宝石 / 奖励 | `check-character.js`、`check-equipment.js`、`check-wall.js`、`check-gems.js`、`check-rewards.js` |
| 技能 / 步枪 | `check-skills.js`、`check-rifle.js`、`check-super-traits.js` |
| 敌人机制 | `check-boss-update.js`、`check-bomber.js`、`trace-boss.js` |
| 单关 | `check-level<N>.js` |
| 数值 | `check-hp-budget.js`、`check-xp.js` |
| 文档 | `check-docs.js` |

- 逻辑回归优先写成一次性 `node -e`；Canvas 可用 `Proxy` 桩模拟 `getContext("2d")`。
- 不引入测试框架、Redux、TypeScript 或新的运行时依赖。

### 2.4 画面回放

本机不能用无头浏览器做画面验证：

1. `node tmp/trace-draw.js <场景>` 把绘制指令写入 `tmp/draw-ops.json`。
2. `python tmp/replay-draw.py` 回放成 PNG 后人工核对。

`trace-draw.js` 支持 `enemies`、`status`、`wasp`、`wheelchair`、`frostBeast`、`lizard`、`bomber`、`flameMaster`、`stormVanguard`、`mechanicalPioneer`、`bosses`、`deepSeaVolley`、`codex ...`、`account ...` 等场景。

### 2.5 本机限制

- 不能截图 DOM 浮层：用脚本断言元素、绑定与文案，再在浏览器里人工确认一次。
- 调试脚本、日志、截图与导出数据一律放在 `tmp/`。

## 3. 代码风格与命名

- 旧引擎保持 IIFE 严格模式：`(function (Game) { "use strict"; ... })(window.Game = window.Game || {});`，使用 `var`、函数表达式与 ES5。
- 新 React 代码使用 ES Module + JSX。
- 常用缩写：旧引擎用 `C = Game.config`、`S = Game.state`、`U = Game.utils`。
- 公共游戏函数挂到 `Game.*`；React 不复制战斗规则。
- 不添加注释，除非用户明确要求；文案使用简体中文。
- 提交信息使用单段纯文本。

## 4. 伤害管线

### 4.1 六种属性

`physical / energy / electric / ice / fire / wind`，定义在 `config.elements`。

- 技能属性唯一来源是 `config.coreSkills[].element`，不要写进 `skillDefaults`。
- 步枪属性由 `Game.getRifleElement(player)` 从 `bulletType` 推导。
- 读取统一走 `Game.getSkillElement(id)`、`Game.getRifleElement(p)`、`Game.getDamageElement(source)`。
- 生成弹体或伤害实体时把 `element` 与 `damageSource` 快照到实体上，飞行途中改词条不影响已出手的弹丸。

### 4.2 伤害入口

所有伤害必须走 `Game.damageEnemy`，不要在别处直接减 `enemy.hp`。

### 4.3 结算顺序

护甲格挡 → 属性 / 来源 / 致伤倍率 → 扣血。

- 护甲格挡时不记录 `lastHitElement`，也不结算倍率。
- 属性倍率与致伤射线的 `damageTakenMultiplier` 相乘。

### 4.4 属性克制

- 抗性写在 `config.enemies[].damageTakenByElement`：`1.5` 弱点、`.5` 减免、`0` 免疫，缺省 1。
- 唯一读取入口 `Game.getElementDamageScale(enemy, element)`，只在 `Game.damageEnemy` 内使用。

### 4.5 来源减伤

- 写在 `config.enemies[].damageTakenBySource`：伤害来源 id → 倍率。
- 唯一入口 `Game.getDamageSourceScale(enemy, source)`，同样只在 `damageEnemy` 内使用。
- 弹道来源 id 为 `rifle / dryIce / thermobaric / airBlade`。

### 4.6 持续伤害

- 燃烧与冻伤的每秒伤害不走属性倍率。
- 燃烧在 `update.js` 按 `dt` 结算；冻伤按来源分层叠层，入口是 `Game.applyFrostbite`。
- 新增加持续伤害时，在施加时应用账户等级倍率并保存来源。

### 4.7 展示约束

属性与抗性信息只显示在技能 / 僵尸图鉴，不显示在 HUD、伤害数字或特效中。

## 5. 状态系统

### 5.1 状态分类

统一使用 `config.statusEffects`：

| 类别 | 状态 |
| --- | --- |
| 伤害性 | 燃烧 `burn`、冻伤 `frostbite` |
| 软控 | 减速 `slow`、击退 `knockback`、牵引 `pull` |
| 硬控 | 眩晕 `stun`、冻结 `freeze`、麻痹 `paralysis` |
| 削弱 | 重伤 `wound` |

### 5.2 硬控

- 三者机制等价：被控期间不能移动也不能攻击。
- 共用 `enemy.control` / `enemy.controlType`，写入口是 `Game.applyHardControl`，语义包装为 `applyStun` / `applyFreeze` / `applyParalysis`。
- 判断统一用 `Game.isHardControlled`，不要读取 `enemy.stun`。

### 5.3 软控

- `Game.applySlow(enemy, duration, factor)` 只压移速。
- `Game.applyKnockback(enemy, sourceX, sourceY, distance)` 是瞬时位移。
- `Game.applyPull(enemy, sourceX, sourceY, distance)` 把目标拉向来源。
- 击退倍率表示距离，牵引倍率表示速度。

### 5.4 伤害性状态

- 燃烧：`Game.applyBurn`，写 `enemy.burn` / `enemy.burnDps`。
- 冻伤：`Game.applyFrostbite(enemy, source, dps, duration, maxStacks)`，按来源分层记录并各自计时。

### 5.5 削弱

`Game.applyWound(enemy, duration, factor, extraDuration, extraFactor)` 只压制回血。

### 5.6 抗性与缩放

- `statusImmune`：状态 id → `true` 完全免疫。
- `statusDurationScale`：状态 id → 倍率（击退为距离倍率、牵引为速度倍率）。
- 唯一入口 `Game.getStatusScale(enemy, status)`；免疫判定先于护甲消耗。

### 5.7 入口对照

| 操作 | 入口 |
| --- | --- |
| 减速 | `Game.applySlow` |
| 击退 | `Game.applyKnockback` |
| 牵引 | `Game.applyPull` |
| 眩晕 / 冻结 / 麻痹 | `Game.applyStun` / `applyFreeze` / `applyParalysis` |
| 燃烧 / 冻伤 | `Game.applyBurn` / `applyFrostbite` |
| 重伤 | `Game.applyWound` |
| 回血 | 乘 `Game.getHealScale` |
| 移速 | `Game.getEnemyMoveSpeed` |
| 护甲扣层 | `Game.blockWithArmor` |
| 狂暴 | `Game.isRaging` / `Game.tryStartRage` |

## 6. 敌人系统

### 6.1 配置字段

敌人在 `config.enemies`，基础字段 `hp / speed / radius / damage / xp / color / accent`，图鉴字段 `codexCategory`（`minion` / `elite` / `boss`）、`description`、`tactics`、`codexHidden`。

可选机制字段：

| 机制 | 字段 |
| --- | --- |
| 护甲 | `armorCharges` |
| 属性抗性 | `damageTakenByElement` |
| 来源减伤 | `damageTakenBySource` |
| 状态免疫 / 缩放 | `statusImmune` / `statusDurationScale` |
| 远程 | `ranged { standoff, interval, projectileSpeed, projectileRadius, damage, shot, action }` |
| 齐射 | `ranged.salvo` / `salvoInterval` / `spread` |
| 飞行 | `flying` |
| 阻挡弹道 | `blocksProjectiles` |
| 分裂 / 召唤 | `splitInto` / `splitCount` / `summonHpRatios` / `summonType` |
| 回血 | `regenPerSecond` / `regenBelowHpRatio` |
| 狂暴 | `rageHpRatio` / `rageDuration` / `rageSpeedMultiplier` / `rageRecoveryDuration` |
| 低血加速 | `speedBoostBelowHpRatio` / `speedBoostMultiplier` |
| 撞线爆炸 | `wallExplosionDamage` / `wallExplosionRadius` |
| 冻结回血 | `freezeHealPerSecond` |

新增机制优先用可选字段表达，避免在 `spawnEnemy` / `update` 里堆 `type` 判断。

### 6.2 生成与波次

- 关卡与波次只配置在 `config.levels[].waves`。
- `Game.reset` 后逻辑与 HUD 只读 `S.session.waves`。
- 分裂与阈值召唤一律写入 `S.pendingSpawns`，由 `Game.flushPendingSpawns` 在更新末尾统一生成，不能在遍历中直接改 `S.enemies`。

### 6.3 移动与停步

- 近战、远程、飞行的停步位置统一由 `Game.getEnemyHoldY(info)` 给出。
- 敌人移动速度只通过 `Game.getEnemyMoveSpeed` 计算，它统一处理硬控、减速、狂暴与低血加速。
- 任何落点预判都必须使用同一速度接口。

### 6.4 远程、飞行与贴地

- 远程字段是 `ranged`，飞行字段是 `flying`；两者都有时 `ranged` 优先。
- 贴地技能在 `skillDefaults[].groundOnly` 标记，命中判断统一走 `Game.canHitEnemy`。
- 当前贴地技能只有装甲车与燃油弹。

### 6.5 精英与首领

- 每种小怪都应有对应精英；精英固定在第 4 波，每局 1 只，可用 `elitePool` 随机选择。
- 首领判断统一用 `Game.isBossEnemy(enemy)`，不要写死 `enemy.type === "boss"`。
- 波次用可选字段 `bossType` 指定首领，缺省为尸潮领主。
- 首领与小怪同场：本波常规小怪投放到一半时首领登场，剩余小怪继续投放。
- 首领血条为 `config.bossHealth.bars` 条（当前 5），精英复用同一套宽血条但只有 ×1。
- 所有首领局内模型乘 `config.bossModelScale`；图鉴用 `noBossScale` 保持原尺寸，缩放不改变碰撞半径。

### 6.6 特殊机制索引

| 机制 | 代表单位 | 实现位置 |
| --- | --- | --- |
| 护甲格挡 | 护甲僵尸 | `Game.blockWithArmor` |
| 远程投掷 | 篮球僵尸 / 傀儡 | `ranged` + `Game.throwEnemyShot` |
| 齐射 | 深海巨兽 / 机械垦荒者 | `ranged.salvo` |
| 飞行 + 贴地免疫 | 飞鸟 / 毒蜂 | `flying` + `canHitEnemy` |
| 阻挡弹道 | 寒霜兽 | `blocksProjectiles` |
| 分裂 | 分裂僵尸 | `splitInto` + `flushPendingSpawns` |
| 阈值召唤 | 傀儡僵尸 | `summonHpRatios` |
| 条件回血 | 轮椅僵尸 | `regenPerSecond` + `regenBelowHpRatio` |
| 冻结回血 | 深海巨兽 | `freezeHealPerSecond` |
| 狂暴冲锋 | 电锯僵尸 | `tryStartRage` |
| 低血加速 | 炸弹僵尸 | `speedBoost*` |
| 撞线爆炸 | 炸弹僵尸 | `wallExplosion*` |

### 6.7 图鉴与测试场

- 图鉴按 `codexCategory` 分类，派生单位用 `codexHidden: true` 排除。
- 新增特殊外观时同步更新 `render.js` 的类型判断；完整自定义身体绘制完成后尽早 `return`。
- 测试场与首领图鉴按 `codexCategory === "boss"` 自动收录首领。

## 7. 技能与词条

### 7.1 数据位置

| 数据 | 配置 |
| --- | --- |
| 技能基础数值 | `config.skillDefaults` |
| 图鉴条目、属性、范围、图标 | `config.coreSkills` |
| 技能专属词条 | `config.skillTraits`（通过 `skillId` 关联） |
| 步枪词条 | `config.traits` |
| 超级词条 | `config.skillTraits` 中 `super: true` 的条目 |

### 7.2 技能槽

- 上限由 `config.maxSkillSlots` 控制（当前 4）。
- 已获得技能记录在 `player.skillOrder`，只进不出。
- `Game.canUnlockSkill()` 判断是否还能解锁；满槽后 `Game.rollTraits` 过滤所有 `unlocksSkill` 词条。
- `Game.unlockSkill(id, force)` 是唯一解锁入口；常规流程不传 `force`，测试场才允许强制解锁。

### 7.3 交战距离

- 距离基准是城墙攻击线，配置在 `config.ranges`（远 / 中 / 近）。
- 归属写在 `config.coreSkills[].range`；步枪用 `config.rifleRange`。
- 判定入口 `Game.isSkillRangeEngaged(id)`；冷却就绪但未进入射程时保持在 0，不空转进入冷却。
- 索敌也必须过滤未进入距离的敌人；已释放的实体不受距离限制。

### 7.4 索敌与射击

- 自动索敌要考虑预判、真实武器挂点和敌人停步位置。
- 齐射锁一条真实弹道，使用 `Game.getAimAngleForShot`。
- 每个基础攻击周期只扣 1 发；齐射与连发的额外弹丸不额外扣弹，最后一发连发完成后才换弹。

### 7.5 词条池

- `Game.rollTraits` 必须过滤满级、未满足条件、已解锁和满槽时的解锁词条；三张卡不能重复。
- 词条按稀有度分层；已满级的词条不再进入随机池。

### 7.6 超级词条

- 局内升级池的稀有卡，每局重置、不落库、不影响账户等级。
- 每个技能一局最多获取一次，`max: 1`、`rarity: "超级"`，需要 3 条前置词条。
- `Game.isSuperTraitReady(trait)` 判定可用；`rollTraits` 先按 `config.superTraitChance` 抽 1 张，再从普通池补足。
- 新伤害继续走 `Game.damageEnemy` 并快照 `element` / `damageSource` / `progressSkillId`；二次产物不触发超级效果。

## 8. 技能账户等级与图纸

- 12 个核心技能各有 Lv.1–31 账户等级，保存在 `skill_progress`，由 `Game.skillProgress` 读取。
- `player.skills[id].level` 只表示局内词条等级，禁止与账户等级混写。
- 每级提供暴击率 +0.5%、对应技能伤害 +8%、冷却间隔 ×0.985；暴击受 95% 上限。
- 高级节点固定在 Lv.2/7/12/18/22/26，12 个技能共 72 个节点，配置在 `config.skillProgressTraits`。
- 升级价格、图纸校验与扣费只由服务端 `server/app/skills.py` 计算，客户端只展示 `nextCost`。
- 开局把账户等级快照到 `player.accountSkills`，战斗中不读取 `Game.accounts`；测试场固定 Lv.1。
- 新增技能时必须同步 `config.skillProgress`、`config.skillProgressTraits`、前端图纸资源与服务端映射。

## 9. 步枪系统

- 账户等级保存在 `rifle_progress`，由 `Game.rifleProgress` 读取。
- 等级下限 Lv.1，不设上限；每级 +5 点步枪最终伤害。
- 升级由服务端 `server/app/rifle.py` 计算与扣费。
- 六个节点：Lv.4 分裂子弹、Lv.14 快速换弹、Lv.24 射速解锁、Lv.36 火力同步、Lv.44 子弹弹射、Lv.52 战术穿透。
- 节点分两类：直接生效（换弹、射速、穿透）与只解锁词条（分裂子弹、子弹弹射、射速词条）。
- 局内词条 `player.rifleSplit` / `player.rifleRicochet` 才是实际效果来源，不要从账户等级直接读取。

## 10. 关卡与波次

### 10.1 配置结构

- 关卡写在 `config.levels`，必填 `id`、`name`、`subtitle`、`brief`、`unlocked`、`hpScale`、`xpScale`、`waves`。
- 每波包含 `total`、`interval`、`mix`，按需添加 `elite`、`elitePool`、`boss`、`bossType`、`hpScale`。
- `hpScale` 作用于 `hp/maxHp`，不改伤害、速度、经验与回血；波次级 `hpScale` 再乘在关卡倍率之上。

### 10.2 波次设计与预算校准

- 波次、间隔、精英波与首领波位置只由配置推导，关卡简介自动同步。
- 精英固定第 4 波，首领固定第 7 波（第 1 关首领在第 5 波）。
- 新关卡统一规格：第 21 关起 20 波、2988 只；早期 5–13 波，中期 14–15 波。
- `xpScale` 按「满级落在倒数两波」逐关校准，不是单调递减。
- 用 `tmp/check-hp-budget.js` 看等效血量预算，相邻关卡一般控制在 1.1–1.4 倍；用 `tmp/check-xp.js` 看满级落点。
- 局内等级上限 LV.20，LV.2～LV.20 共 19 次升级每次都要进入三选一，清场补级同样逐级发放。

### 10.3 现有关卡参数表

| 关卡 | 名称 | 波数 | 投放 | 阵容（按登场顺序） | 第 4 波精英 | 第 7 波首领 | hpScale | xpScale |
| ---: | --- | ---: | ---: | --- | --- | --- | ---: | ---: |
| 1 | 街区警戒线 | 5 | 104 | 普通僵尸 / 快跑僵尸 / 分裂僵尸 | — | 尸潮领主（第 5 波） | 1 | 1.76 |
| 2 | 地铁入口 | 10 | 258 | 普通僵尸 / 快跑僵尸 / 分裂僵尸 | 快跑僵尸精英 | 尸潮领主（第 7 波） | 1 | 0.63 |
| 3 | 封锁工厂 | 10 | 358 | 普通僵尸 / 快跑僵尸 / 分裂僵尸 | 分裂僵尸精英 | 尸潮领主（第 7 波） | 1.35 | 0.43 |
| 4 | 熔炉核心 | 10 | 427 | 普通僵尸 / 快跑僵尸 / 分裂僵尸 | 分裂僵尸精英 | 尸潮领主（第 7 波） | 1.35 | 0.34 |
| 5 | 废弃球馆 | 10 | 459 | 普通僵尸 / 快跑僵尸 / 篮球僵尸 / 分裂僵尸 | 篮球僵尸精英 | 尸潮领主（第 7 波） | 1.6 | 0.32 |
| 6 | 隔离区 | 11 | 380 | 篮球僵尸 / 分裂僵尸 / 护甲僵尸 | 篮球僵尸精英 | 尸潮领主（第 7 波） | 1.68 | 0.29 |
| 7 | 装甲坟场 | 12 | 456 | 普通僵尸 / 分裂僵尸 / 护甲僵尸 | 护甲僵尸精英 | 尸潮领主（第 7 波） | 1.75 | 0.26 |
| 8 | 环城高架 | 12 | 898 | 快跑僵尸 / 篮球僵尸 / 飞鸟僵尸 | 飞鸟僵尸精英 | 尸潮领主（第 7 波） | 2 | 0.165 |
| 9 | 焦土防线 | 11 | 776 | 快跑僵尸 / 护甲僵尸 / 火焰僵尸 | 火焰僵尸精英 | 尸潮领主（第 7 波） | 2.1 | 0.21 |
| 10 | 冰火交界 | 11 | 744 | 普通僵尸 / 火焰僵尸 / 雪人僵尸 | 雪人僵尸精英 | 尸潮领主（第 7 波） | 2.2 | 0.22 |
| 11 | 高压电厂 | 12 | 686 | 火焰僵尸 / 雪人僵尸 / 雷电僵尸 | 雷电僵尸精英 | 尸潮领主（第 7 波） | 2.35 | 0.2 |
| 12 | 旧城疗养院 | 12 | 618 | 护甲僵尸 / 火焰僵尸 / 轮椅僵尸 | 轮椅僵尸精英 | 尸潮领主（第 7 波） | 2.5 | 0.19 |
| 13 | 蜂巢天台 | 13 | 924 | 飞鸟僵尸 / 护甲僵尸 / 毒蜂 | 毒蜂精英 | 尸潮领主（第 7 波） | 2.75 | 0.16 |
| 14 | 冻土前线 | 14 | 842 | 普通僵尸 / 分裂僵尸 / 寒霜兽 | 寒霜兽精英 | 尸潮领主（第 7 波） | 2.9 | 0.14 |
| 15 | 熔毒荒原 | 15 | 1348 | 毒蜂 / 火焰僵尸 / 蜥蜴僵尸 | 蜥蜴僵尸精英 | 尸潮领主（第 7 波） | 3 | 0.12 |
| 16 | 断线鸟巢 | 15 | 1348 | 蜥蜴僵尸 / 飞鸟僵尸 / 傀儡僵尸 | 傀儡僵尸精英 | 尸潮领主（第 7 波） | 3.1 | 0.1 |
| 17 | 寒蜂裂谷 | 15 | 1348 | 蜥蜴僵尸 / 毒蜂 / 寒霜兽 | 毒蜂精英 | 尸潮领主（第 7 波） | 3.2 | 0.1 |
| 18 | 霜影裂谷 | 15 | 1348 | 蜥蜴僵尸 / 毒蜂 / 寒霜兽 | 寒霜兽精英 | 尸潮领主（第 7 波） | 3.2 | 0.1 |
| 19 | 傀儡雪原 | 15 | 1348 | 雪人僵尸 / 蜥蜴僵尸 / 傀儡僵尸 | 傀儡僵尸精英 | 尸潮领主（第 7 波） | 3.3 | 0.09 |
| 20 | 蜂球傀儡馆 | 15 | 1348 | 篮球僵尸 / 傀儡僵尸 / 毒蜂 | 毒蜂精英 | 尸潮领主（第 7 波） | 3.4 | 0.08 |
| 21 | 焦土盛宴 | 20 | 2988 | 普通僵尸 / 快跑僵尸 / 火焰僵尸 | 火焰僵尸精英 | 暴食者（第 7 波） | 3.15 | 0.12 |
| 22 | 沉没码头 | 20 | 2988 | 盾牌僵尸 / 炸弹僵尸 / 蜥蜴僵尸 | 盾牌僵尸精英 | 深海巨兽（第 7 波） | 1.3 | 0.06 |
| 23 | 断罪工坊 | 20 | 2988 | 电锯僵尸 / 盾牌僵尸 / 护甲僵尸 | 电锯僵尸精英 | 看守者（第 7 波） | 1.52 | 0.06 |
| 24 | 雷暴空港 | 20 | 2988 | 飞鸟僵尸 / 毒蜂 / 雷电僵尸 | 雷电僵尸精英 | 尸潮领主（第 7 波） | 4.02 | 0.085 |
| 25 | 腐殖温室 | 20 | 2988 | 火焰僵尸 / 雪人僵尸 / 傀儡僵尸 | 傀儡僵尸精英 | 暴食者（第 7 波） | 2.12 | 0.07 |
| 26 | 风暴禁区 | 20 | 2988 | 雷电僵尸 / 毒蜂 / 炸弹僵尸 | 雷电僵尸精英 | 风暴先锋（第 7 波） | 2.7 | 0.07 |
| 27 | 熔火王座 | 20 | 2988 | 火焰僵尸 / 电锯僵尸 / 盾牌僵尸 | 火焰僵尸精英 | 烈焰掌控者（第 7 波） | 2.7 | 0.065 |
| 28 | 霜狱回廊 | 20 | 2988 | 寒霜兽 / 雪人僵尸 / 轮椅僵尸 | 寒霜兽精英 | 看守者（第 7 波） | 2.2 | 0.059 |
| 29 | 废墟工坊 | 20 | 2988 | 傀儡僵尸 / 篮球僵尸 / 分裂僵尸 | 傀儡僵尸精英 | 暴食者（第 7 波） | 3.4 | 0.059 |
| 30 | 钢铁荒原 | 20 | 2988 | 护甲僵尸 / 电锯僵尸 / 炸弹僵尸 | 护甲僵尸精英 | 机械垦荒者（第 7 波） | 4.2 | 0.059 |
| 31 | 极夜霜原 | 20 | 2988 | 飞鸟僵尸 / 快跑僵尸 / 蜥蜴僵尸 | 飞鸟僵尸精英 | 深海巨兽（第 7 波） | 12.8 | 0.059 |
| 32 | 锈蚀码头 | 20 | 2988 | 盾牌僵尸 / 轮椅僵尸 / 雷电僵尸 | 盾牌僵尸精英 | 风暴先锋（第 7 波） | 7 | 0.059 |
| 33 | 霜噬地窟 | 20 | 2988 | 寒霜兽 / 雪人僵尸 / 毒蜂 | 寒霜兽精英 | 暴食者（第 7 波） | 6.3 | 0.059 |
| 34 | 熔渣熔炉 | 20 | 2988 | 火焰僵尸 / 电锯僵尸 / 炸弹僵尸 | 火焰僵尸精英 | 烈焰掌控者（第 7 波） | 7.9 | 0.059 |
| 35 | 终焉工事 | 20 | 2988 | 护甲僵尸 / 分裂僵尸 / 傀儡僵尸 | 护甲僵尸精英 | 看守者（第 7 波） | 8.8 | 0.059 |
| 36 | 冰封球场 | 20 | 2988 | 篮球僵尸 / 寒霜兽 / 电锯僵尸 | 篮球僵尸精英 | 机械垦荒者（第 7 波） | 8.2 | 0.055 |
| 37 | 冻湖栈道 | 20 | 2988 | 盾牌僵尸 / 雷电僵尸 / 雪人僵尸 | 盾牌僵尸精英 | 深海巨兽（第 7 波） | 17.6 | 0.067 |
| 38 | 断翼病院 | 20 | 2988 | 护甲僵尸 / 毒蜂 / 轮椅僵尸 | 毒蜂精英 | 风暴先锋（第 7 波） | 20.8 | 0.067 |
| 39 | 残垣闹市 | 20 | 2988 | 普通僵尸 / 护甲僵尸 / 炸弹僵尸 | 护甲僵尸精英 | 暴食者（第 7 波） | 22 | 0.073 |
| 40 | 裂翼长桥 | 20 | 2988 | 飞鸟僵尸 / 分裂僵尸 / 寒霜兽 | 飞鸟僵尸精英 | 尸潮领主（第 7 波） | 15.4 | 0.059 |
| 41 | 焦骸剧场 | 20 | 2988 | 火焰僵尸 / 傀儡僵尸 / 雷电僵尸 | 火焰僵尸精英 | 烈焰掌控者（第 7 波） | 27.8 | 0.065 |

> 数值以 `config.levels` 为准；本表由配置生成，用于快速定位阵容与节奏。

### 10.4 简介与列表

- `levels[].brief` 由关卡简介面板展示，长度控制在两行内。
- 阵容不写死：`Game.getLevelRoster(levelId)` 从 `waves` 的 `mix` / `elite` / `elitePool` / `boss` 现场推导。
- 关卡列表为固定行高滚动列表，绘制与点击共用 `Game.getLevelRowRect` / `Game.getLevelInfoRect`。

## 11. 渲染层

- 所有 Canvas 绘制放在 `render.js`，只读状态与账户缓存。
- `Game.draw` 按固定顺序绘制：地面单位 → 远程投掷物 → 装甲车 → 龙卷风 → 冰雹 → 火场 → 无人机 → 飞行单位 → 城墙 → 幻形 → 燃油弹 → 弹丸。
- 敌人分层用 `Game.drawEnemies(singleEnemy, layer)` 的 `"ground"` / `"air"`。
- 完整自定义身体绘制完成后尽早 `return`，不要继续叠加通用僵尸部件。
- 尺寸、锚点与挂点集中在 `config.sprites` / `config.skillRing`；逻辑宽度固定为 `config.width`。
- `Game.uiMode === "react"` 时只绘制战场，React 已接管的菜单、HUD、暂停、升级与结算不回退到 Canvas。

## 12. 输入层

- 输入只进 `input.js`；所有点击区域必须与绘制共用同一套几何函数。
- 修改 HUD、弹窗、技能槽或列表布局时同步检查 `input.js`。
- 长按预览状态只存于 `S.skillRangePreview`，暂停与重置时清空。
- React 浮层打开时阻止事件穿透到 Canvas；战场瞄准与坐标相关操作留在 Canvas。

## 13. React 前端

- 生产入口由 FastAPI 返回 `frontend/dist/index.html`；`/app-assets/` 只托管构建产物，`/assets/`、`/pictures/` 托管游戏素材。
- `frontend/src/game/engine.js` 是旧引擎导入顺序的唯一来源。
- `Game.mount()` / `Game.destroy()` 必须幂等：只允许一个 RAF 循环；卸载必须取消 RAF、定时器与全部监听。
- 新页面先通过 `actions.js` 定义命令，再由 `ui-store.js` 提供快照；不要在组件内直接写 `Game.state` 或请求 `/api`。
- Vite 构建资源目录固定为 `app-assets`，不要改回 `assets`。
- `#root` 保持全屏 Flex 居中。
- 人工检查：竖屏手机、桌面、滚动、弹窗层级、输入法、长按取消、点击穿透与离线状态。

## 14. 界面与图鉴

- 战斗 HUD：关卡名、暂停、等级、经验条、波次、弹药与技能槽。
- 暂停界面：继续战斗或退出；退出进入撤离结算。
- 关卡选择：滚动列表 + `?` 简介面板；所有关卡开放。
- 僵尸图鉴：按小怪 / 精英 / 首领分类，详情页展示属性、背景与应对建议。
- 技能图鉴：按技能分组，详情页展示说明、专属词条、账户等级与节点。
- 角色界面：装备、城墙、技能强化入口与背包三页签（宝石 / 装备 / 资源）。
- 结算界面：胜利 / 失败 / 撤离、用时、击杀、最终等级与本局奖励。
- 新增界面状态统一放 `S`，几何统一放 `config.*UI`，绘制与输入共用 getter。

## 15. 数据库与模型

- SQLite 是账户、进度与资源数据的唯一来源。
- 表：`accounts`、`sessions`、`level_progress`、`resources`、`equipment`、`equipment_bag`、`wall_state`、`gems`、`skill_progress`、`rifle_progress`、`schema_version`。
- 建表用 `Base.metadata.create_all()`；`schema_version` 只是标记，不是迁移机制。
- 新增表可依赖 `create_all()`；新增字段必须手写兼容迁移（`ALTER TABLE` 或在启动时补逻辑）。
- 密码只存 PBKDF2-SHA256 哈希（随机盐）；会话 token 只存 SHA-256 摘要。
- 未登录或离线只允许会话内缓存，刷新即失效，并提示「成绩未保存」。

## 16. API 与鉴权

- 全部接口挂在 `/api` 下，JSON 收发，鉴权走 HttpOnly + SameSite=Strict Cookie。
- 主要接口：`/api/health`、`/api/auth/*`、`/api/me`、`/api/me/progress`、`/api/me/rewards`、`/api/me/equipment/*`、`/api/me/wall/upgrade`、`/api/me/gems/*`、`/api/me/skills/upgrade`、`/api/me/rifle/upgrade`。
- 统一错误体 `{"error": {"code", "message"}}`；写接口只接受 `POST` / `DELETE` 并校验同源。
- 服务只绑定 `127.0.0.1`；静态服务只暴露 `index.html`、`src/`、`styles/`、`assets/`、`pictures/`，绝不暴露 `server/` 或 `data/`。
- 前端可提示格式问题，但用户名、密码、装备、城墙、宝石与奖励的最终校验必须在服务端。
- `/api/me/resources`、`/api/me/gems/grant`、`/api/me/rewards` 是调试 / 本地单机接口，缺少幂等或额度保护，不可信。

## 17. 养成系统

### 17.1 角色属性

- `Game.attributes` 是唯一计算层：基础值来自 `config.attributes.base`，装备 / 城墙 / 宝石 / 技能各自提供修正。
- 攻击力与六系攻击为数值制、无上限；冷却、暴击、暴伤与负面时间有上限。
- 伤害结算顺序：护甲格挡 → 攻击倍率 → 元素倍率 → 敌人属性抗性 → 致残易伤。

### 17.2 装备

- 六部位，每部位一件已装备；元素首次创建时随机且之后不变；强化等级属于部位。
- 数据存 `equipment` 与 `equipment_bag`；换装只交换元素，不改等级。
- 成长与价格由服务端 `server/app/equipment.py` 计算，前端只展示 `nextCost`。

### 17.3 城墙

- 等级与血量成长由服务端 `server/app/wall.py` 计算；钢材升级，稀土在每 10 级节点突破。
- 突破本身不加属性，只解除后续等级限制。
- 前端 `Game.wall` 只读缓存；测试场城墙固定 9999。

### 17.4 宝石

- 六部位 × 六槽位，宝石按部位绑定；只有已镶嵌宝石计入属性。
- 品质五档，词条数值随品质提高；同部位同品质 5 颗可合成高一档。
- 锁定宝石不参与一键合成；同词条唯一约束由服务端 `server/app/gems.py` 权威判定。
- 前端 `Game.gems.planSocket` 只用于按钮文案，服务端是最终裁判。

### 17.5 关卡奖励

- 每局结束按「达到的最高等级 + 是否通关」结算一档，只发最高档。
- 奖励包含金币、钢材、稀土、图纸、宝石、装备与技能 / 步枪图纸。
- 服务端 `server/app/rewards.py` 唯一计算；未登录 / 离线 / 测试场不结算。

### 17.6 角色界面

- 角色界面是养成内容的唯一入口；属性面板退回只读。
- 装备方块弹宝石浮层；背包分宝石 / 装备 / 资源三页签。
- 浮层优先级：合成确认 > 宝石详情 > 装备详情 > 资源详情 > 宝石浮层 > 常规。
- 所有几何集中在 `config.characterUI`，绘制与输入共用 getter。

## 18. 新增敌人

1. 在 `config.enemies` 添加基础字段：`hp / speed / radius / damage / xp / color / accent`。
2. 添加 `codexCategory`、`description`、`tactics`；派生单位加 `codexHidden: true`。
3. 同步配置对应精英，数值不弱于小怪；特殊机制优先用 §6.1 的可选字段。
4. 在 `render.js` 补充外观分支，完整自定义身体绘制后尽早 `return`。
5. 按需更新测试场、图鉴、`trace-draw.js` 场景与检查脚本。
6. 用 `node tmp/check-<unit>.js` 或一次性脚本验证抗性、状态、移动与图鉴。

## 19. 新增核心技能

1. 在 `config.skillDefaults` 添加数值，在 `config.coreSkills` 添加图鉴条目、`range`、`element`、`icon`、`color`。
2. 在 `config.skillTraits` 添加 `unlocksSkill: true` 的解锁词条与强化词条。
3. 在 `combat.js` 实现生成 / 命中 / 效果，在 `update.js` 接入推进，在 `render.js` 补充绘制。
4. 保持未解锁时不触发；伤害实体快照 `element` 与 `damageSource`；所有伤害走 `Game.damageEnemy`。
5. 负面效果只走 §5.7 的公开入口。
6. 技能释放前接 `Game.isSkillRangeEngaged`；索敌过滤射程外敌人。
7. 同步账户等级相关配置（§8）与图鉴详情。
8. 更新 `check-skills.js` 与画面回放。

## 20. 新增词条与超级词条

### 20.1 普通词条

1. 步枪词条写入 `config.traits`，技能词条写入 `config.skillTraits` 并用 `skillId` 关联。
2. 字段：`id`、`name`、`rarity`、`max`、`desc`、`detail`、`apply`；解锁词条加 `unlocksSkill: true`。
3. 确认 `Game.rollTraits` 的过滤条件仍成立（满级、条件、已解锁、满槽）。

### 20.2 超级词条

1. 写入 `config.skillTraits`，带 `super: true`、`max: 1`、`rarity: "超级"`、`requires`（3 条前置）与 `apply`。
2. 在 `config.skillDefaults` 补一次性布尔开关。
3. 效果接入现有生成 / 命中 / 结算路径，二次产物不触发。
4. 更新技能图鉴的超级徽标与前置弹层。

## 21. 新增关卡

1. 在 `config.js` 定义波次数组，每波包含 `total`、`interval`、`mix`，按需添加 `elite`、`elitePool`、`boss`、`bossType`、`hpScale`。
2. 向 `config.levels` 添加关卡，必填 `brief`，并校准 `hpScale` / `xpScale`。
3. 遵循 §10.2 的规格：第 21 关起 20 波；精英第 4 波；首领第 7 波。
4. 运行 `tmp/check-hp-budget.js` 与 `tmp/check-xp.js` 校准预算与满级落点。
5. 新增 `tmp/check-level<N>.js`，覆盖阵容、精英、首领、20 波、滚动列表与简介。
6. 更新 `README.md` 的关卡条目与本手册 §10.3 的参数表。
7. 用关卡选择回放确认列表与简介面板不重叠。

## 22. 新增资源与通用功能

1. 资源目录只改 `config.resources`，并同步服务端 `RESOURCE_IDS`。
2. 新资源要有图标绘制分支（`drawResourceIcon`）与图鉴 / 结算展示。
3. 新接口按 §16 的约定：路由只解析，领域逻辑进 `server/app/<domain>.py`。
4. 前端只经 `Game.accounts` 访问，新增缓存字段与命令要在 `forgetAccount` / 401 / 登出时清理。
5. 新增表或字段按 §15 的迁移约定处理。
6. 更新检查脚本与文档。

## 23. 修改画面与输入

- 尺寸、锚点、挂点集中在 `config.sprites` / `config.skillRing`；换人物 PNG 后同步裁切图与锚点。
- 所有点击区域与绘制共用几何函数；改布局时同步检查 `input.js`。
- 画面改动必须通过 `trace-draw.js` + `replay-draw.py` 回放核对。
- React 页面改动至少人工检查竖屏手机、桌面、滚动、弹窗层级与点击穿透。

## 24. 性能优化

- 现有措施：`config.performance` 控制 DPR 上限、粒子 / 文字上限与裁剪边距。
- 已知瓶颈是敌人身体逐帧光栅化；根本方案是离屏精灵缓存，尚未实施。
- 优化前先用 `tmp/perf-harness.js` 复现压力场景，记录 `draw` / `flush` 耗时。
- 不要为了性能绕过 §4 / §5 的结算入口。

## 25. 验收标准

- 可完整进入、游玩、胜利或失败并重开一局。
- 升级时战斗严格暂停；LV.2～LV.20 每次升级都显示三张不重复词条。
- 满级本身不结算；最后一波投放完成、首领（若有）与全部子体清空后才胜利。
- 满级后城墙失守仍判失败。
- 奖励只发最高档；未登录 / 离线 / 测试场不写库。
- 新增核心技能不需要改写步枪与词条基础系统。
- `node tmp/check-docs.js` 无失败项。

## 26. 临时开发计划与归档

- 模板：`docs/features/_template.md`。
- 命名：`docs/features/<slug>.md`，slug 用小写英文与连字符。
- 完成后：

1. 把结论并入本手册对应章节（写开发方式，不写流水账）。
2. 更新 `README.md`（仅玩家可见内容）。
3. 在 `DEVELOPMENT_LOG.md` 追加一条。
4. 把计划文件移入 `docs/archive/features/`，并在 `docs/README.md` 登记。
5. 运行 `node tmp/check-docs.js`。

## 27. 常见坑

- 数值写在多份文档里必然漂移：只在 `config` 改，文档描述机制。
- 关卡总数、等级上限、图鉴数量被写死在校验脚本里：新增关卡后检查脚本要用配置推导。
- 关卡列表的滚动断言依赖「最后一关」会随关卡数失效：先滚动到目标行再断言。
- 关卡简介超过两行会与「小怪」标题重叠：控制在 40 字左右。
- 旧引擎不要用可选链、箭头函数、`const` / `let` 或模板字符串。
- 新增状态或伤害绕过公开入口会导致护甲、抗性与缩放失效。
- 新增旧模块后忘记同步 `engine.js` 与 `index.html` 的顺序会导致运行时缺函数。
- 修改 `render.js` 的几何后不同步 `input.js` 会造成点击错位。
- `tmp/` 下的脚本默认不入库，只有 `check-docs.js` 例外。
