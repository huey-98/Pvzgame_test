# 技能超级词条实现文档

本文档用于把「技能超级词条」一次性实现到当前仓库。超级词条是**局内升级池的稀有卡**，不进账户养成、不落库、不改后端。实现时必须严格沿用现有 FastAPI、SQLite、旧 Canvas 引擎和 React 并行层的边界，不能重写战斗系统，也不能把超级词条混入账户技能等级。

## 0. 执行规则

- 先完整阅读 `AGENTS.md`、`README.md`、`DEVELOPMENT_PLAN.md`、`SKILL_PROGRESS_IMPLEMENTATION.md` 与本文档，再修改代码。
- 一次完成配置、战斗接入、Canvas 界面、React 并行层、检查脚本和文档同步。
- 旧引擎文件继续使用 IIFE、`"use strict"`、`var` 和 ES5 语法，禁止可选链、空值合并、箭头函数、`const`、`let`、模板字符串。
- React 文件可以继续使用现有 ES Module 与 JSX 风格。
- 不新增 npm 依赖、测试框架、Redux、TypeScript 或运行时库。
- 不改后端：`server/` 不动，`SCHEMA_VERSION` 保持 7，不新增表、不新增接口。
- 所有伤害仍必须进入 `Game.damageEnemy`，并快照 `element` 与 `damageSource` / `progressSkillId`。
- 所有负面状态仍必须使用现有公开入口 `applySlow`、`applyKnockback`、`applyPull`、`applyStun`、`applyFreeze`、`applyParalysis`、`applyBurn`、`applyFrostbite`、`applyWound`。
- 不直接写 `enemy.slow`、`enemy.control`、`enemy.hp` 或敌人坐标。护甲、状态免疫、状态时长缩放、狂暴和硬控规则保持现有入口。
- 贴地限制统一走 `Game.canHitEnemy`，索敌与落点统一走既有打分 / 过滤函数。
- 注释只保留现有模块头注释。不要新增解释性注释。
- 玩家可见文案使用简体中文。

## 1. 必须保持的现有概念

- 超级词条属于**局内词条**：每局重置，不持久化，不影响账户等级、`skill_progress` 与 HUD 的局内 `Lv.N` 语义。
- **每个技能的超级词条局内最多获取一次**（`max: 1`），**没有等级成长**，获取即满额效果。
- 不同技能的超级词条可以各获取一次，一局最多集齐 12 条。
- **选择超级词条后 `p.skills[skillId].level` 同样 +1**，与其它专属词条一致。
- 超级词条进入 `config.skillTraits`，用 `super: true` 标记，通过 `skillId` 绑定具体技能；`Game.getSkillGroups` 会自动把它收进技能图鉴。
- 账户高级节点（Lv.2/7/12/18/22/26 共 72 个）与超级词条的机制**不得重复**，两者可叠加。

## 2. 数据模型

### 2.1 超级词条条目

全部 12 条写进 `src/config.js` 的 `skillTraits`，结构：

```javascript
{ id: "superThermo", skillId: "thermobaric", super: true, max: 1,
  name: "殉爆", rarity: "超级", icon: "✷",
  desc: "命中首个目标时弹射一颗强化温压弹",
  detail: "温压弹命中首个目标时，向最近的另一名敌人弹射 1 颗强化温压弹：冲击与爆炸伤害 ×1.3、爆炸半径 ×1.2、穿透 1、保留燃烧与击退。弹射出的炮弹不再触发殉爆，场上没有其它目标时不弹射。前置：爆炸增伤、爆炸范围增大、击退强化。",
  requires: ["thermoBlast", "thermoRadius", "thermoKnockback"],
  apply: function (p) { p.skills.thermobaric.sacrificeEnabled = true; } }
```

字段约定：

| 字段 | 含义 |
| --- | --- |
| `super: true` | 超级词条标记：进入超级卡分档、前置判定与概率抽取 |
| `max: 1` | 只能获取一次；获取后 `p.traits[id] === 1`，被 `rollTraits` 现有满级过滤自动挡掉 |
| `rarity: "超级"` | 第三档稀有度（普通 / 稀有 / 超级），渲染按档配色 |
| `requires` | 3 个前置词条 id（不含解锁词条），各 ≥1 级即可，不设等级要求 |
| `apply` | 只做一次性开关与数值写入，不做递归成长 |

`detail` 必须写清效果与「前置：A、B、C」，图鉴直接展示。

### 2.2 前置词条 id 对照（`config.skillTraits` 现有条目）

| 技能 | 超级词条 | 超级词条 id | `requires` |
| --- | --- | --- | --- |
| 温压弹 | 殉爆 | `superThermo` | `thermoBlast`、`thermoRadius`、`thermoKnockback` |
| 干冰弹 | 极寒大冰弹 | `superDryIce` | `iceDamage`、`iceFreeze`、`iceSplit` |
| 装甲车 | 钢铁洪流 | `superArmoredCar` | `armoredCarDamage`、`armoredCarChassis`、`armoredCarReinforcement` |
| 空投轰炸 | 集束炸弹 | `superBombardment` | `bombardmentExtra`、`bombardmentRadius`、`bombardmentPrecision` |
| 电磁穿刺 | 核能电磁 | `superElectromagnetic` | `electromagneticSplit`、`electromagneticDamage`、`electromagneticExplosion` |
| 高能射线 | 灼蚀聚焦 | `superHighEnergyBeam` | `highEnergyBeamDamage`、`highEnergyBeamCripple`、`highEnergyBeamCharge` |
| 旋风加农 | 风暴之眼 | `superWhirlwind` | `whirlwindDamage`、`whirlwindPull`、`whirlwindTurbo` |
| 冰雹发生器 | 冰川领域 | `superHail` | `hailFrostbite`、`hailRadius`、`hailDuration` |
| 燃油弹 | 凝固汽油 | `superFuel` | `fuelRadius`、`fuelSlow`、`fuelBlast` |
| 压缩气刃 | 乱刃流 | `superAirBlade` | `airBladeVolley`、`airBladeDamage`、`airBladeBurst` |
| 无人机 | 蜂群协议 | `superDrone` | `droneDamage`、`droneSize`、`droneBlade` |
| 跃迁电子 | 永动电子 | `superChain` | `chainBounce`、`chainBurn`、`chainExtra` |

名称对照（避免与配置文案歧义）：`iceDamage` = 干冰弹增伤、`armoredCarReinforcement` = 车辆增援、`airBladeBurst` = 气刃连发、`hailFrostbite` = 冰雹冻伤。

### 2.3 技能默认值新增字段

`config.skillDefaults` 为每个技能补一次性布尔开关，`testClearBuild` 与局内初始化按键复制自动带上、自动清空：

```javascript
thermobaric: { ..., sacrificeEnabled: false },
dryIce: { ..., bigIceEnabled: false },
armoredCar: { ..., steelSurgeEnabled: false },
bombardment: { ..., clusterEnabled: false },
electromagnetic: { ..., nuclearEnabled: false },
highEnergyBeam: { ..., scorchEnabled: false },
whirlwindCannon: { ..., stormEyeEnabled: false },
hailGenerator: { ..., glacierEnabled: false },
fuelBomb: { ..., napalmEnabled: false },
airBlade: { ..., chaosBladeEnabled: false },
drone: { ..., swarmEnabled: false },
chainLightning: { ..., tempestEnabled: false }
```

敌人侧只在 `Game.spawnEnemy` 的初始化对象上补三个计时字段：`scorchStacks: 0`、`scorchTimer: 0`、`napalmMark: 0`（默认 0，狂暴开始时与其它负面字段一起清空）。

### 2.4 概率常量

`src/config.js` 新增 `superTraitChance: .2`（与 `maxSkillSlots` 同级或独立配置块）。固定 20%，不递减。

## 3. 出现规则

- 候选条件（缺一不可）：`super: true`、`p.traits[id]` 未拥有、`requires` 中 3 条前置词条全部 ≥1 级、对应技能 `p.skills[skillId].unlocked` 为真。
- 每次 `Game.rollTraits`：先按 `config.superTraitChance` 决定是否抽超级卡；候选为空则跳过；抽出 1 张后其余 2 张照旧从普通池随机。
- **一轮最多 1 张超级卡，三张卡不重复**。
- 12 条集齐后自然回落到纯普通池，不需要特判。

`Game.rollTraits`（`src/combat.js`）实现要点：

```javascript
Game.isSuperTraitReady = function (trait) {
  var p = S.player;
  if (!trait || !trait.super || !trait.skillId) return false;
  if ((p.traits[trait.id] || 0) > 0) return false;
  if (!p.skills[trait.skillId] || !p.skills[trait.skillId].unlocked) return false;
  var needs = trait.requires || [];
  for (var i = 0; i < needs.length; i++) if (!(p.traits[needs[i]] > 0)) return false;
  return true;
};
```

- 现有过滤 `if ((p.traits[trait.id] || 0) >= trait.max) return false;` 对超级词条自动生效（`max: 1`），不需要新增「已拥有」分支。
- 超级词条不设 `unlocksSkill`，不参与技能槽满时的解锁词条剔除逻辑。
- `Game.chooseTrait` 不需要改动：`trait.apply(p)` + `p.skills[trait.skillId].level++` 已满足「+1 局内技能等级」。
- 测试场 `Game.testApplyTrait` 按技能循环列出专属词条，会自动包含超级词条；测试场允许无视 `requires` 强制应用，不需要额外前置校验。

## 4. 12 条超级词条精确规格

通用约束：新伤害一律 `Game.damageEnemy` 并快照 `element` / `damageSource` / `progressSkillId`（继承所属技能，账户伤害倍率照常生效）；新减速 / 麻痹走 `applySlow` / `applyParalysis`；贴地判定走 `Game.canHitEnemy`；护甲格挡、状态免疫、狂暴拒绝伤害全部照旧。**二次产物（弹射弹、分裂弹、子弹药、小火场、追踪弹）不再触发本效果**，防止无限刷屏。

### 殉爆（`superThermo`）

- 温压弹**首次冲击命中**时触发：向距离最近的**其它**敌人抛出 1 颗强化温压弹。
- 强化弹：冲击与爆炸伤害 ×1.3、爆炸半径 ×1.2、穿透 1，保留燃烧、击退与属性（火）。
- 弹射弹标记 `fromSacrifice: true`，不再触发殉爆；场上无其它目标时不弹射。
- 与「温压弹连发」「温压弹穿透」「二次爆轰」共存：只有首次冲击命中触发一次，穿透后的后续命中不重复触发。

### 极寒大冰弹（`superDryIce`）

- 干冰弹本体半径 ×1.8、伤害 ×1.5。
- **每次命中**向周围均匀射出 3 枚强化干冰弹（角度均分 120°，方向随弹体朝向）：伤害 = 本体当前伤害 ×0.45、穿透 1、继承本体的减速 / 冻结 / 冻伤配置。
- 分裂弹标记 `fromBigIce: true`，不再触发本效果。
- 与「分裂小冰弹」并存：本体命中后的原有分裂照常结算，两套分裂互不干扰。

### 钢铁洪流（`superArmoredCar`）

- 每轮派遣改为**一排铺满全宽**：按 `config.width` 均匀排布 **12 辆**同时出发（间距 ≈ 30 像素），取消车道随机。
- 车辆数值沿用当前装甲车配置（含词条与账户节点的加成）。
- 「车辆增援」每级再插入 1 辆（13 / 14 辆），间距自动收紧；「重型底盘」照常放大车身。

### 集束炸弹（`superBombardment`）

- 每枚炸弹落地分裂 **3 枚子弹药**，均匀落在 60% 爆炸半径的圆周上。
- 子弹药各造成 35% 爆炸伤害，**无击退、无中心加成、不再分裂**（`cluster: true`）。
- 子弹药复用 `S.bombDrops`，来源仍为 `bombardment`；热核轰炸对子弹药不生效。

### 核能电磁（`superElectromagnetic`）

- 电磁穿刺伤害 **×3**（一次性满额，只乘本次闪电直伤，不改爆炸 / 矩阵 / 电链）。
- **闪电直接击杀目标**（本次直伤致死）时，在该目标位置再释放一次同规格电磁穿刺：同样享受分流目标、麻痹、电磁爆炸 / 矩阵与本次 ×3。
- 再次造成击杀则继续，**连锁安全上限 6 段**，超出后停止；连锁段每段都是 ×3 基准，不叠乘。
- 连锁的后续段不再触发新的连锁判定之外的额外效果复制（麻痹、爆炸照常）。

### 灼蚀聚焦（`superHighEnergyBeam`）

- 射线每 0.5 秒给命中目标叠 1 层灼蚀：每层**受到伤害 +5%**，持续 5 秒、最多 5 层。
- 与「致残射线」共用 `enemy.damageTakenTimer` / `damageTakenMultiplier`：**取更强者并刷新计时**，不叠加倍率（灼蚀 5 层 = +25%，与致残 +25% 取强者，不变成 +50%）。
- 层数记录在 `enemy.scorchStacks` / `enemy.scorchTimer`，到期整体清零。

### 风暴之眼（`superWhirlwind`）

- 每个龙卷风四周附带 **4 个小旋风**，绕主风眼公转（公转周期约 1.2 秒）。
- 小旋风：半径 = 主风眼 ×35%、命中伤害 = 主风眼 ×40%、牵引 = 主风眼 ×0.6，命中节奏与主风眼共用 0.35 秒，独立记 `contacts`。
- 小旋风**非贴地**，飞鸟 / 毒蜂照常被卷入、掉血并被牵引。
- 「双重旋风」的额外龙卷与「风暴聚集」的静止大龙卷各自带 4 个小旋风；主龙卷消失时小旋风一并消失。
- 小旋风伤害来源仍是 `whirlwindCannon`。

### 冰川领域（`superHail`）

- 冰雹消失时在原地留下 **3 秒冰面**，半径 = 该冰雹当前半径。
- 冰面内敌人每 0.5 秒受 30% 单次砸击伤害，并被 `applySlow(enemy, 1, .6)` 减速 40%（可刷新）。
- 多个冰面可重叠、各自计时；冰面非贴地，飞行单位照常受影响。

### 凝固汽油（`superFuel`）

- 被任意火场灼烧过的敌人打上 4 秒标记（`enemy.napalmMark`）。
- 标记期间死亡时在原地生成小火场：半径 30、持续 1 秒、每 0.25 秒造成 60% 单次灼烧伤害。
- 小火场**不再打标记**（不连锁）；小火场 `groundOnly`，飞鸟免疫。
- 触发判定在击杀结算处（`killEnemy` 或对应火场结算路径）检查标记，来源仍为 `fuelBomb`。

### 乱刃流（`superAirBlade`）

- 齐射 **+2**、连发 **+2**（`skill.spread += 2`、`skill.burst += 2`，与已有词条叠加）。
- 释放时每道气刃方向改为**围绕幻形 360° 随机均匀散布**（不再从核心朝目标方向成扇形）；连发每轮重新随机方向。
- 仍需 `Game.isSkillRangeEngaged("airBlade")` 为真才释放；穿透、击退、重伤与账户节点照常。

### 蜂群协议（`superDrone`）

- 每次撞击敌人 **30% 概率**在撞点投放 1 枚追踪弹：飞向最近敌人，半径 26 的小爆炸，伤害 = 本次撞击伤害 ×150%。
- 追踪弹标记 `fromSwarm: true`，不再触发蜂群；追踪弹伤害来源仍为 `drone`。

### 永动电子（`superChain`）

- `extraChains + 2`（每轮共 3 条链，`taken` 列表优先把目标分摊给不同的链，候选耗尽才复用）。
- `bounces + 3`（基础 5 次 + 词条 + 局内多重越导 + 本次 3 次）。
- 其余沿用现有电链结算（节点伤害、麻痹、跃迁燃烧、复合电子、无强化电链规则不变）。

## 5. 实现落点

| 文件 | 改动 |
| --- | --- |
| `src/config.js` | 12 条超级词条进 `skillTraits`；`skillDefaults` 补 12 个布尔开关；`superTraitChance: .2` |
| `src/combat.js` | `Game.isSuperTraitReady`；`Game.rollTraits` 加 20% 抽卡与候选过滤；12 条效果接入（生成 / 命中 / 结算）；`spawnEnemy` 补三个敌人计时字段 |
| `src/update.js` | 小旋风公转、冰面与小火场推进结算、灼蚀与凝固汽油标记计时 |
| `src/render.js` | 升级卡三档稀有度分色与前置小字；图鉴详情超级词条（徽标 + 前置行）；战场特效（弹射弹、大冰弹、战车排、子弹药、连锁闪电、小旋风、冰面、小火场、追踪弹） |
| `src/input.js` | 图鉴详情新增行的滚动手势与点击矩形同步；三选一仍为固定 3 卡布局 |
| `frontend/src/game/ui-store.js` | `upgradeCards` 快照补 `rarity` / `super` / `requires` |
| `frontend/src/features/CodexScreens.jsx` | 图鉴展示超级词条与前置 |
| `server/` | **不改** |

实现顺序：配置数据 → 池与前置判定 → 逐技能效果（先数值类：核能电磁 / 乱刃流 / 永动电子 / 极寒大冰弹，再实体类：殉爆 / 钢铁洪流 / 集束 / 风暴之眼 / 冰川领域 / 凝固汽油 / 蜂群协议）→ update / render / input → React 并行层 → 检查脚本 → 文档同步。

## 6. 界面

- **升级三选一**（`drawUpgrade`）：三档稀有度分色，超级词条用金橙 `#ffb84d` 卡面与描边光晕；卡面文案「超级 · Lv.1 / 1」，卡片底部加一行前置小字（例如「前置：爆炸增伤 · 爆炸范围增大 · 击退强化」）；已满级的普通词条卡保持现状。
- **技能图鉴详情**：超级词条排在该技能词条列表末尾，带「超级」徽标、前置行与一次性说明；列表行的稀有度判断（当前 `稀有 / 史诗`）增加第三分支。
- **战场**：弹射弹、大冰弹、战车排、子弹药、连锁闪电、小旋风、冰面、小火场、追踪弹各有可辨识特效，配色按技能属性；伤害数字与属性标记规则不变（不在 HUD / 特效显示属性）。
- 新增几何必须放进 `config.skillCodexUI` 或独立配置块，`render.js` 与 `input.js` 调用同一组矩形函数；浮层打开时吞掉下层点击。

## 7. 验证脚本与命令

新增 `tmp/check-super-traits.js`，至少覆盖：

- 前置未满足不出现在池中；满足前置 + 技能已解锁后按 20% 概率出现（测试内强制概率 1 验证效果）。
- 一轮最多 1 张超级卡，三张卡不重复。
- **每条只可获取一次**：获取后 `p.traits[id] === 1` 且不再进池；不同技能可各拿一次，最多 12 条。
- 选择超级词条后 `p.skills[skillId].level` **+1**。
- 机制逐条冒烟：
  - 殉爆弹射 1 颗强化弹，弹射弹不再触发，无其它目标不弹射。
  - 极寒大冰弹本体伤害 / 半径提升，每次命中 3 枚分裂弹，分裂弹不再触发，与「分裂小冰弹」并存。
  - 钢铁洪流每轮 12 辆铺满全宽，车辆增援每级 +1 辆。
  - 集束炸弹 3 枚子弹药各 35% 伤害，不复裂、无击退。
  - 核能电磁伤害 ×3；连锁在未击杀处停止；连锁段数不超过 6；段间不叠乘。
  - 灼蚀每 0.5 秒叠层、上限 5 层、与致残射线取强者、到期清零。
  - 风暴之眼每个龙卷 4 个小旋风，伤害 / 牵引 / 半径比例正确，随主龙卷消失。
  - 冰川领域留下 3 秒冰面，跳伤与减速生效。
  - 凝固汽油标记后死亡生成小火场，小火场不打标记，飞鸟不受影响。
  - 乱刃流齐射 +2、连发 +2，方向为全向散布，仍受射程限制。
  - 蜂群协议 30% 追踪弹，追踪弹不触发蜂群。
  - 永动电子每轮 3 条链、弹射次数 +3。
- 断言所有新伤害都经 `Game.damageEnemy` 且 `damageSource` / `progressSkillId` 为所属技能。
- 与账户高级节点叠加抽查：温压弹 Lv.22 二次爆轰 + 殉爆、电磁 Lv.12 电链 + 核能电磁不重复 / 不冲突。

回归与画面：

```powershell
npm --prefix frontend run build
node tmp\check-react-ssr.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
node tmp\check-super-traits.js
node tmp\check-skills.js
node tmp\check-bomber.js
node tmp\check-accounts.js
git diff --check
```

画面核对用现有 `tmp/trace-draw.js` + `tmp/replay-draw.py`，至少输出四种场景：升级三选一（含超级卡）、技能图鉴详情（含超级词条）、殉爆 / 大冰弹战场、钢铁洪流 / 集束战场。

后端无需改动，不执行后端检查。

## 8. 文档同步

实现完成后更新：

- `README.md`：新增「技能超级词条」一节（规则 + 12 条效果表）。
- `DEVELOPMENT_PLAN.md`：第 7 节新增「技能超级词条」小节。
- `DEVELOPMENT_LOG.md`：记录实现日期、文件、规则和实际验证结果。
- `AGENTS.md`：如有公共入口签名变化（预期无）需同步；否则不动。

## 9. 完成标准

- 12 条超级词条全部可获取，每条局内只获取一次、无成长，获取后技能等级 +1。
- 前置为 3 条该技能专属词条，不设等级要求；出现概率固定 20%、不递减；一轮最多 1 张。
- 12 条机制全部生效，且二次产物不触发本效果（无无限连锁）。
- 所有新伤害走 `Game.damageEnemy` 并正确快照来源，所有新状态走公开入口，护甲 / 免疫 / 狂暴规则不变。
- 账户等级、技能图纸、后端与数据库完全不受影响。
- 升级卡三档稀有度显示正确，图鉴展示超级词条与前置，点击区域与绘制一致。
- 构建、语法检查、`check-super-traits.js`、回归脚本与 `git diff --check` 均通过。

## 10. 实现模型提示词

把以下提示词完整交给实现模型。

```text
你在 E:\vs_python\folder\Pvzgame_test 中实现“技能超级词条”。先完整阅读 AGENTS.md、README.md、DEVELOPMENT_PLAN.md、SKILL_PROGRESS_IMPLEMENTATION.md 和 SKILL_SUPER_TRAITS_PLAN.md。以 SKILL_SUPER_TRAITS_PLAN.md 为唯一实现规格；不得违反 AGENTS.md 的战斗、账户和代码边界。

严格实现，不要重写战斗系统，不要新增依赖，不要改后端（SCHEMA_VERSION 保持 7，不新增表和接口）。超级词条是局内词条：每局重置、每个技能最多获取一次、无等级成长、获取后 p.skills[skillId].level +1，不影响账户等级与 HUD 的 Lv.N 语义。

配置层：
- 12 条超级词条写入 config.skillTraits，字段 super: true、max: 1、rarity: "超级"、requires: [3 个前置词条 id]。
- skillDefaults 为 12 个技能各补一个一次性布尔开关；spawnEnemy 初始化补 scorchStacks、scorchTimer、napalmMark。
- 新增 config.superTraitChance = .2。

升级池：
- 新增 Game.isSuperTraitReady(trait)：未拥有 + 3 条前置全部 ≥1 级 + 技能已解锁。
- Game.rollTraits 按 20% 概率抽 1 张超级卡，其余 2 张照旧随机；一轮最多 1 张、三张不重复；已拥有由 max: 1 的满级过滤自动挡掉。
- Game.chooseTrait 不改动。

12 条效果按文档第 4 节精确实现，通用约束：新伤害一律 Game.damageEnemy 并快照 element / damageSource / progressSkillId；新状态走 applySlow / applyParalysis 等公开入口；贴地判定走 Game.canHitEnemy；护甲、免疫、狂暴规则不变；弹射弹、分裂弹、子弹药、小火场、追踪弹等二次产物不再触发本效果。

特别注意：
- 核能电磁伤害 ×3，直接击杀时在原地再放一次同规格电磁穿刺，连锁上限 6 段、段间不叠乘。
- 灼蚀与致残射线共用 damageTakenTimer / damageTakenMultiplier，取强者并刷新，不叠加倍率。
- 钢铁洪流是每轮一排 12 辆铺满全宽，取消车道随机，车辆增援每级再 +1 辆。
- 风暴之眼的 4 个小旋风绕主风眼公转，非贴地，随主龙卷消失。
- 乱刃流的齐射 +2、连发 +2 与已有词条叠加，方向为围绕幻形 360° 随机均匀散布，仍需 isSkillRangeEngaged。

界面必须同时更新 Canvas 生产界面与 React 并行层：升级卡三档稀有度分色（超级金橙）、卡片底部前置小字、图鉴详情超级词条徽标与前置行、战场特效。render.js 与 input.js 共用几何。

完成后新增 tmp/check-super-traits.js 并执行文档第 7 节的全部命令，更新 README.md、DEVELOPMENT_PLAN.md、DEVELOPMENT_LOG.md。最后报告修改文件、实际验证结果、未执行的检查和原因。不要声称未运行的命令已通过。
```
