# AGENTS.md

面向后续开发者的协作说明。修改代码前请先阅读本文件，并保持与 `README.md`、`DEVELOPMENT_PLAN.md` 同步。

## 项目概览

- 项目：`街区警戒线`，9:16 竖屏单手 Roguelite 僵尸生存射击游戏。
- 技术：原生 JavaScript + Canvas 2D，**无构建工具、无依赖、无包管理**。
- 运行：直接双击 `index.html`，或用任意静态服务器托管。所有脚本通过 `index.html` 按固定顺序加载，共享单一 `window.Game` 命名空间。

## 运行与验证

无需安装依赖。改完代码后至少执行：

```powershell
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

- `node --check`：语法校验，必须全部通过。
- `git diff --check`：空白字符校验。Windows 下出现的 `LF will be replaced by CRLF` 只是换行符提示，不是错误。
- 逻辑回归优先用一次性 `node -e` 冒烟测试；需要模拟 Canvas 时，用 `Proxy` 桩实现 `document.getElementById("game").getContext("2d")`。
- 不要引入测试框架、构建器或运行时依赖，除非用户明确要求。

## 代码结构与职责

脚本加载顺序（见 `index.html`）：`config → utils → state → combat → update → sprites → render → input → main`。

| 文件 | 职责 | 备注 |
| --- | --- | --- |
| `src/config.js` | 全部静态数据：尺寸、精灵、颜色、敌人、词条、技能、波次、关卡 | 调平衡/加内容优先改这里 |
| `src/utils.js` | 数学、随机、绘制、文本工具 | `Game.utils` |
| `src/state.js` | `Game.state` 单局状态、`Game.reset`、界面切换 | 只存数据，不写绘制逻辑 |
| `src/combat.js` | 生成、瞄准、射击、碰撞、伤害、经验、词条、技能效果 | 战斗规则集中于此 |
| `src/update.js` | 主循环推进、实体移动、波次、技能更新 | 只调用 combat 接口 |
| `src/sprites.js` | PNG 加载，多路径回退 | `Game.sprites.images.*` |
| `src/render.js` | 所有 Canvas 绘制、HUD、菜单、图鉴、结算 | 只读 `Game.state` |
| `src/input.js` | 鼠标/触控/键盘，界面点击区域 | 调用 `state`/`combat` 的公开函数 |
| `src/main.js` | 初始化与 `requestAnimationFrame` 主循环 | 精灵就绪后启动，含超时保护 |

**分层原则**：数据进 `config`，状态进 `state`，战斗规则进 `combat`/`update`，绘制只进 `render`，输入只进 `input`。不要把战斗逻辑写进 `render`。

## 命名与代码风格

- IIFE 模块包裹，严格模式：`(function (Game) { "use strict"; ... })(window.Game = window.Game || {});`
- 使用 `var`、函数表达式、ES5 语法，保持与现有代码一致；不要混入 ES Module 或可选链等新语法。
- 变量缩写约定：`C = Game.config`，`S = Game.state`，`U = Game.utils`。
- 函数挂在 `Game.*` 上，供其它模块调用。
- **不添加注释，除非用户明确要求。** 现有注释仅出现在配置和模块头部。
- 文本、界面文案与文档使用简体中文。

## 关键机制约定

- **瞄准**：自动索敌用预判 + 武器实际挂点（`Game.getWeaponMount`）；齐射时锁定一条真实弹道，用 `Game.getAimAngleForShot`，不要用两条弹道的角平分线。
- **弹药**：每个基础攻击周期只扣 1 发；齐射/连发额外弹丸不额外扣弹；最后一发连发完成后才换弹。
- **齐射**：相邻弹道角间隔为 `config.spreadAngle`（当前 0.2 弧度）。
- **连发**：沿同一锁定方向按短间隔依次发射，子弹前后排列而非横向并排。
- **技能解锁**：温压弹、干冰弹默认 `unlocked: false`，必须通过局内解锁词条获得；解锁时 `level = 1`，之后每个同技能专属词条 `level++`。未解锁时 `Game.updateSkills` 不得发射。
- **词条池**：`Game.rollTraits` 会过滤已满级词条、未满足解锁条件的技能词条、以及已解锁技能的解锁词条；不出现重复。
- **精英/首领规则**：每种小怪都要有对应精英（体型大、数值不弱于基础）；精英固定第 4 波每局 1 只；首领是独立类别、固定第 7 波每局 1 只。当前原型只有 5 波，首领暂在第 5 波。
- **HUD 技能槽**：右上枪械图标下方固定两个技能槽，未解锁显示空槽，解锁后显示图标 + `Lv.N`。

## 常见扩展路径

**新增敌人**
1. 在 `config.enemies` 增加条目，设置 `hp/speed/radius/damage/xp/color/accent`。
2. 必须带 `codexCategory`（`minion`/`elite`/`boss`）、`description`、`tactics`，图鉴会自动收录。
3. 精英需同时规划对应小怪；如需新行为，在 `combat.spawnEnemy` 或 `update.js` 补充。

**新增步枪词条**
1. 在 `config.traits` 增加条目：`id/name/rarity/max/icon/desc/detail/apply(p)`。
2. `apply` 直接修改玩家对象 `p`；升级池与技能图鉴自动收录。
3. `id` 与 `player.traits[id]` 计数器绑定，改名时注意兼容。

**新增核心技能**
1. 在 `config.skillDefaults` 加技能数值（含 `unlocked:false, level:0`），`coreSkills` 加图鉴条目。
2. 在 `config.skillTraits` 加一个 `unlocksSkill:true` 的解锁词条，以及若干 `skillId` 关联的强化词条。
3. 在 `combat.js` 实现发射/碰撞/效果，`update.js` 接入 `updateSkills`/弹丸推进，`render.js` 绘制弹丸与效果。
4. 在 `combat.updateSkills` 保持 `if (!skill.unlocked) return;` 守卫。

**调整人物/步枪/幻形**
- 精灵尺寸、锚点、挂载点都在 `config.sprites`；`muzzleDistance` 应等于枪口到握把锚点的距离；幻形位置改 `config.skillRing.offsetX/offsetY`。
- 替换人物：更新 `assets/man.png` 后生成透明裁切图（`player-man.png`/`player-body.png`），再按比例调锚点。

**调整分辨率**
- 只改 `config.width`/`config.height`；渲染按设备像素比自动缩放，逻辑坐标不变。

## 文档同步要求

- 功能或规则变更后，必须同步更新 `README.md`（当前已实现、限制）和 `DEVELOPMENT_PLAN.md`（系统设计、验收记录）。
- 提交信息使用单段纯文本，风格与近期提交保持一致。

## 已知限制

- 第 2、3 关仅有锁定入口，无实际内容。
- 区域轰炸、装甲车等核心技能尚未接入战斗。
- 分裂僵尸、投掷僵尸、音效、长期养成、联网等均未实现。
- 人物与步枪使用 `assets/` PNG，敌人、城墙、幻形仍为 Canvas 程序化绘制。
