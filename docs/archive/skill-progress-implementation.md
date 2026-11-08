# 技能图纸与技能等级实现文档

本文档用于把“技能图纸与技能等级”一次性实现到当前仓库。目标模型是 DeepSeek V4.1 Flash。实现时必须严格沿用现有 FastAPI、SQLite、旧 Canvas 引擎和 React 并行层的边界，不能重写战斗系统，也不能把账户养成等级混入局内词条等级。

## 0. 执行规则

- 先完整阅读 `AGENTS.md`、`README.md`、`DEVELOPMENT_PLAN.md`、本文档，再修改代码。
- 一次完成数据层、后端、战斗接入、Canvas 界面、React 并行层、检查脚本和文档同步。
- 旧引擎文件继续使用 IIFE、`"use strict"`、`var` 和 ES5 语法，禁止可选链、空值合并、箭头函数、`const`、`let`、模板字符串。
- React 文件可以继续使用现有 ES Module 与 JSX 风格。
- 不新增 npm 依赖、测试框架、Redux、TypeScript 或运行时库。
- 不把进度写入 `localStorage`。SQLite 是唯一持久化来源。
- 服务端是等级、价格、扣费和发奖的唯一权威。前端只显示服务端返回的 `nextCost`。
- 所有伤害仍必须进入 `Game.damageEnemy`。所有负面状态仍必须使用现有 `applySlow`、`applyFreeze`、`applyBurn`、`applyFrostbite`、`applyStun`、`applyParalysis`、`applyWound`。
- 不直接写 `enemy.slow`、`enemy.control`、`enemy.hp` 或敌人坐标。
- 护甲、状态免疫、状态时长缩放、狂暴和硬控规则保持现有入口。
- 注释只保留现有模块头注释。不要新增解释性注释。
- 玩家可见文案使用简体中文。

## 1. 必须保持的现有概念

局内技能等级和账户技能等级是两套数据：

- `player.skills[id].level` 是局内词条等级。解锁词条把它设为 1，后续局内专属词条继续加 1。它重开即重置，不能持久化。
- 新增的账户技能等级范围是 1 到 31，保存在 SQLite。它影响暴击率、技能伤害、技能冷却和高级增益。
- HUD 上现有的 `Lv.N` 继续表示局内词条等级，不能改成账户等级。
- 测试场不读取、不修改账户技能等级，也不结算技能图纸。

当前 12 个核心技能 id 固定为：

`bombardment`、`thermobaric`、`dryIce`、`armoredCar`、`electromagnetic`、`highEnergyBeam`、`whirlwindCannon`、`hailGenerator`、`fuelBomb`、`airBlade`、`drone`、`chainLightning`。

高级增益只在账户等级达到 2、7、12、18、22、26 时解锁。每个技能正好 6 个节点。Lv.1 与 Lv.31 都没有高级增益节点。

## 2. 数据库与迁移

把 `server/app/config.py` 的 `SCHEMA_VERSION` 从 6 改为 7。

在 `server/app/models.py` 新增：

- 表名：`skill_progress`
- 字段：`account_id`、`skill_id`、`level`
- 主键：`(account_id, skill_id)`
- `account_id` 外键指向 `accounts.id`，`ondelete="CASCADE"`
- `skill_id` 使用 `String(32)`
- `level` 使用整数，默认 1

`create_all()` 可以创建新表。由于目标表是全新表，不需要手写 `ALTER TABLE`，但必须在数据库检查中验证旧 schema 6 数据库打开后能自动补出该表。

`GET /api/me` 必须调用技能进度补齐函数。新账户和缺少部分技能行的旧账户都要补齐 12 行，初始等级全部为 1。补齐必须幂等。

删除账户继续依赖数据库外键级联，不在删除路由里逐表手写删除。

## 3. 后端配置

在 `server/app/config.py` 增加技能常量，数值不能散落在路由中。

```python
SKILL_IDS = (
    "bombardment",
    "thermobaric",
    "dryIce",
    "armoredCar",
    "electromagnetic",
    "highEnergyBeam",
    "whirlwindCannon",
    "hailGenerator",
    "fuelBomb",
    "airBlade",
    "drone",
    "chainLightning",
)
SKILL_MAX_LEVEL = 31
SKILL_CRIT_PER_LEVEL = 0.005
SKILL_DAMAGE_PER_LEVEL = 0.08
SKILL_COOLDOWN_PER_LEVEL = 0.015
SKILL_MILESTONES = (2, 7, 12, 18, 22, 26)
SKILL_COIN_BASE = 150
SKILL_COIN_PER_LEVEL = 50
SKILL_BLUEPRINT_PER_LEVEL = 10
```

图纸资源 id：

```python
SKILL_BLUEPRINTS = {
    "bombardment": "skillBlueprintBombardment",
    "thermobaric": "skillBlueprintThermobaric",
    "dryIce": "skillBlueprintDryIce",
    "armoredCar": "skillBlueprintArmoredCar",
    "electromagnetic": "skillBlueprintElectromagnetic",
    "highEnergyBeam": "skillBlueprintHighEnergyBeam",
    "whirlwindCannon": "skillBlueprintWhirlwindCannon",
    "hailGenerator": "skillBlueprintHailGenerator",
    "fuelBomb": "skillBlueprintFuelBomb",
    "airBlade": "skillBlueprintAirBlade",
    "drone": "skillBlueprintDrone",
    "chainLightning": "skillBlueprintChainLightning",
}
```

把这 12 个 id 追加到 `RESOURCE_IDS`。不要替换现有装备图纸 id。

价格函数：

```python
def cost_for(level, skill_id):
    current = max(1, min(SKILL_MAX_LEVEL, int(level)))
    if current >= SKILL_MAX_LEVEL:
        return None
    return {
        "coin": SKILL_COIN_BASE + SKILL_COIN_PER_LEVEL * (current - 1),
        SKILL_BLUEPRINTS[skill_id]: SKILL_BLUEPRINT_PER_LEVEL * current,
    }
```

关键价格：

- Lv.1 到 Lv.2：150 金币 + 10 张专属图纸。
- Lv.30 到 Lv.31：1600 金币 + 300 张专属图纸。
- 单个技能升满累计 26250 金币 + 4650 张专属图纸。
- 12 个技能全部升满累计 315000 金币。
- 图纸不通用。

## 4. 后端接口

新增 `server/app/skills.py`，职责对齐 `server/app/equipment.py`：

- `ensure_rows(db, account_id)`
- `cost_for(level, skill_id)`
- `payload(rows)`
- `upgrade(db, account_id, skill_id)`

`payload` 每个技能返回：

```json
{
  "skillId": "dryIce",
  "level": 1,
  "maxLevel": 31,
  "blueprintId": "skillBlueprintDryIce",
  "critBonus": 0,
  "damageBonus": 0,
  "cooldownReduction": 0,
  "nextCost": {"coin": 150, "skillBlueprintDryIce": 10},
  "milestones": [2, 7, 12, 18, 22, 26],
  "unlockedMilestones": []
}
```

等级换算：

- `steps = level - 1`
- `critBonus = steps * 0.005`
- `damageBonus = steps * 0.08`
- `cooldownReduction = 1 - pow(0.985, steps)`
- Lv.1 的三项都为 0。
- Lv.31 的 `nextCost` 为 `null`。

`upgrade` 在一个事务内完成：

1. 校验 `skill_id`。
2. 补齐技能行。
3. 满级返回 `422 max_skill_level`。
4. 计算服务端价格。
5. 金币或专属图纸不足返回 `422 not_enough_resources`。
6. 扣除资源、等级加 1、提交。
7. 返回该技能、全部 `skills` 和全部 `resources`。

未知技能返回 `422 unknown_skill`。

在 `server/app/schemas.py` 新增：

```python
class SkillUpgrade(BaseModel):
    skillId: str = ""
```

在 `server/app/routers/me.py` 新增：

`POST /api/me/skills/upgrade`

`GET /api/me` 增加 `skills` 字段。`/api/health` 的 `schemaVersion` 必须变为 7。

## 5. 奖励产出

只增加技能图纸产出，不改变现有金币、装备图纸、钢材、稀土、宝石和装备掉落。

在 `server/app/config.py` 增加：

```python
REWARD_SKILL_BLUEPRINT_LEVEL_UP = 2
REWARD_SKILL_BLUEPRINTS = (6, 12)
REWARD_SKILL_BLUEPRINT_CLEAR = 4
```

奖励规则：

- tier 0：不发技能图纸。
- tier 1，即达到 Lv.2 但未通关：2 张。
- tier 2，即达到 Lv.5 但未通关：6 到 12 张。
- tier 3，即通关：10 到 16 张，实现为 tier 2 的 6 到 12 张再加 4 张。

每张独立调用 `rng.choice(SKILL_IDS)`，再映射到专属资源 id。奖励返回继续放在 `rewards.resources` 中，不新增奖励数组。

## 6. 前端配置

在 `src/config.js` 的 `resources` 追加 12 项。每项包含 id、名称、颜色、描述、用途和获取方式。

名称示例：

- `skillBlueprintThermobaric`：温压弹图纸
- `skillBlueprintDryIce`：干冰弹图纸
- `skillBlueprintArmoredCar`：装甲车图纸
- `skillBlueprintBombardment`：空投轰炸图纸
- `skillBlueprintElectromagnetic`：电磁穿刺图纸
- `skillBlueprintHighEnergyBeam`：高能射线图纸
- `skillBlueprintWhirlwindCannon`：旋风加农图纸
- `skillBlueprintHailGenerator`：冰雹发生器图纸
- `skillBlueprintFuelBomb`：燃油弹图纸
- `skillBlueprintAirBlade`：压缩气刃图纸
- `skillBlueprintDrone`：无人机图纸
- `skillBlueprintChainLightning`：跃迁电子图纸

新增 `config.skillProgress`，包含与后端完全相同的技能顺序、等级上限、三项成长、里程碑和图纸映射。前端不得用这些值自行计算扣费，只能用于展示基础说明。

新增 `config.skillProgressTraits`。结构必须按技能 id 和等级节点索引：

```javascript
skillProgressTraits: {
  thermobaric: {
    2: { name: "温压扩爆", detail: "爆炸半径 +15%。" },
    7: { name: "延烧", detail: "燃烧时间 +1 秒。" }
  }
}
```

12 个技能的 6 个节点都要完整写入，名称和效果以本文第 9 节为准。

资源图标沿用现有图纸绘制方法，但中央图标使用 `drawSkillGlyph(skillId, ...)`，不要画装备轮廓。

## 7. 前端账户层与只读数据层

在 `src/accounts.js` 的账户缓存中新增 `skills`。登录和 `/api/me` 成功时保存；登出、401 和账户遗忘时清空。

新增：

`Game.accounts.upgradeSkill(skillId)`

行为对齐 `upgradeEquipment`：

- 未登录返回“登录后才能强化技能”。
- busy 防重复请求。
- 请求 `POST /api/me/skills/upgrade`。
- 成功后更新资源与技能缓存，调用 `Game.skillProgress.applyAccount`。
- 401 进入 guest 并清空缓存。
- 网络失败提示“未连接数据库”。

新增 `src/skills.js`，对外名称使用 `Game.skillProgress`，避免与战斗中的 `player.skills` 混淆。

公开方法至少包括：

- `applyAccount(payload)`
- `clear()`
- `get(skillId)`
- `getAll()`
- `getLevel(skillId)`
- `getCritBonus()`
- `getDamageBonus(skillId)`
- `getCooldownRate(skillId)`
- `hasMilestone(skillId, level)`
- `getView(skillId)`

`getCooldownRate(skillId)` 返回 `pow(0.985, level - 1)`。Lv.1 返回 1。

`src/attributes.js` 新增独立的 `skillModifiers` 和 `setSkillModifiers`、`clearSkillModifiers`。它只接收技能养成提供的暴击率总和，不能写入装备 modifiers 或宝石 modifiers。

暴击率继续走现有公式和 95% 上限：

`base.critRate + equipment + gems + skillProgress`

## 8. 战斗接入

开局时把账户技能快照写入 `player.accountSkills`。快照内容仅包括等级、伤害倍率、冷却速率和已解锁节点。战斗中不读取 `Game.accounts`。

账户伤害倍率：

`1 + 0.08 * (level - 1)`

只在 `Game.damageEnemy` 中应用，并且只在 `damageSource` 或现有实体上的 `progressSkillId` 属于 12 个核心技能时应用。来源不明时倍率为 1。

以下伤害都要带上正确来源：

- 技能直伤、爆炸、持续伤害、额外弹和高级增益产生的新伤害。
- 温压弹冲击与爆炸都归属 `thermobaric`。
- 干冰弹分裂弹归属 `dryIce`。
- 电磁穿刺触发的电链、小冰弹和灼烧区域归属 `electromagnetic`。
- 旋风触发的纯伤害气刃归属 `whirlwindCannon`，但它的数值读取压缩气刃当前局内伤害。
- 无人机触发的气刃保持现有归属规则，不因本次改动改成风属性。

账户冷却倍率在 `Game.updateSkills` 推进对应 `fireTimer` 时相乘。不能修改 `skill.fireInterval` 原始值，否则局内“超能过载 +50%”会被覆盖或重复缩放。实际效果是：

`fireTimer -= dt * accountCooldownRate * existingCooldownRate`

Lv.31 的账户冷却速率是 `pow(0.985, 30)`，约 0.6355，即基础间隔缩短约 36.45%。

测试场构造玩家时，账户技能快照全部使用 Lv.1。

## 9. 高级增益精确规格

增益与局内词条叠加，不覆盖词条。所有新状态和伤害都要经过现有公共入口。

### 温压弹

- Lv.2：爆炸半径 ×1.15。
- Lv.7：`burnDuration + 1`。
- Lv.12：`impactKnockback` 与 `explosionKnockback` 各 ×1.2。
- Lv.18：`pierce + 1`；穿透路径上的冲击命中也调用 `applyBurn`。
- Lv.22：主爆炸 0.6 秒后生成第二枚爆炸，伤害为当前爆炸伤害 ×0.45，半径 ×0.7，来源仍为温压弹。
- Lv.26：仅忽略目标的 `burn` 状态免疫；火系伤害倍率仍由 `getElementDamageScale` 结算。实现时给本次温压弹的 `applyBurn` 增加一个局部选项，不能全局关闭燃烧免疫。

### 干冰弹

- Lv.2：命中调用 `applySlow(enemy, 0.8, 0.5)`。
- Lv.7：若局内已拥有 `iceFreeze` 词条，则该词条产生的 `freezeDuration` 额外 +0.5；没有该词条时不产生冻结。
- Lv.12：`pierce + 1`；分裂小冰弹继承本体当前减速与冻结配置。
- Lv.18：干冰弹自己的 `frostbiteDuration × 1.25`。
- Lv.22：首次命中时 `splitCount + 2`，新分裂弹伤害沿用现有分裂弹比例。
- Lv.26：干冰弹自己的 `frostbiteMaxStacks + 20`。

### 装甲车

- Lv.2：`extraCars + 1`。
- Lv.7：`slowDuration + 0.6`。
- Lv.12：`stunChance + 0.15`，`stunDuration = max(stunDuration, 0.5)`。
- Lv.18：尺寸倍率额外 ×1.25，与局内 `sizeLevel` 叠加。
- Lv.22：`stunChance + 0.10`，`slowDuration + 1`。因此同时拥有 Lv.12 与 Lv.22 时，账户部分提供 25% 眩晕和 1.6 秒减速，再与局内词条叠加。
- Lv.26：每辆车每行驶 1 秒，在车辆当前位置生成一次范围伤害。半径 42，伤害为当前碾压单段伤害 ×2.5，来源 `armoredCar`，不附加减速或眩晕。

### 空投轰炸

- Lv.2：`extraBombs + 1`。
- Lv.7：爆炸命中 `applyStun(enemy, 0.8)`。
- Lv.12：`blastRadius × 1.3`。
- Lv.18：命中 `applyBurn(enemy, damage * 0.12, 2)`。
- Lv.22：`centerDamageMultiplier + 0.8`。
- Lv.26：每枚炸弹落地 0.8 秒后余爆，伤害 ×0.4，半径 ×0.6。

### 电磁穿刺

- Lv.2：`extraTargets + 1`。
- Lv.7：`stunDuration + 0.8`。
- Lv.12：闪电命中后释放一条归属电磁穿刺的电链，弹射 2 个目标，伤害为当前电磁伤害 ×0.45。
- Lv.18：该电链弹射数变为 4。
- Lv.22：如果主目标 `controlType === "freeze"` 且仍处于硬控，发射 4 颗小冰弹。每颗伤害为电磁伤害 ×0.25，并 `applyFreeze(enemy, 0.5)`。
- Lv.26：如果主目标 `burn > 0`，在目标脚下生成半径 38 的区域，持续 1 秒，每 0.25 秒造成电磁伤害 ×0.2 的伤害，并 `applySlow(enemy, 1, 0.6)`。

### 高能射线

- Lv.2：`bonusDamageHits + 5`，并复用现有 `damageHits` 重算逻辑。
- Lv.7：命中 `applySlow(enemy, 0.8, 0.3)`。
- Lv.12：命中后使目标 4 秒内受到伤害 +15%，复用现有 `damageTakenMultiplier` 机制。
- Lv.18：射线到达逻辑战场边界后折返一次。折返只改变覆盖方向，不增加持续时间和伤害次数。
- Lv.22：`beamWidth × 1.25`。
- Lv.26：额外选择另一条方向发射第二道射线，同时 `duration × 0.6`。两条射线不能使用同一目标方向；只有一个可用目标时，第二条偏移一个最小安全角。

### 旋风加农

- Lv.2：`duration + 2`。
- Lv.7：`pullSpeed × 1.25`。
- Lv.12：`extraTornadoes + 1`。
- Lv.18：`radius × 1.2`。
- Lv.22：每次实际命中敌人后释放一道穿透 0 的纯伤害气刃，不击退、不重伤、不附加状态。伤害读取当前 `player.skills.airBlade.damage`，但 `damageSource` 与 `progressSkillId` 仍是 `whirlwindCannon`。
- Lv.26：每个龙卷风结束时在消失位置留下 1.5 秒静止大龙卷风，半径 ×1.45，牵引 ×1.15。

### 冰雹发生器

- Lv.2：`freezeDuration + 0.25`。
- Lv.7：`radius × 1.25`。
- Lv.12：`duration + 0.75`。
- Lv.18：每次砸击 `applyFrostbite(enemy, "hailGenerator", 1.2, 5, 10)`。
- Lv.22：同一来源层数上限改为 15。
- Lv.26：半径再 ×1.2，冻结时间再 +0.25。

### 燃油弹

- Lv.2：`radius × 1.2`。
- Lv.7：`duration + 0.5`。
- Lv.12：火场内 `applySlow(enemy, 1, 0.65)`。
- Lv.18：`radius × 1.1`。
- Lv.22：结束爆炸伤害为当前单次灼烧伤害 ×1.8，半径沿用现有结束爆炸比例。
- Lv.26：处于火场内的敌人调用 `applyStun(enemy, 1)`。重复命中可以刷新。护甲和硬控免疫仍有效。

### 压缩气刃

- Lv.2：`pierce + 1`。
- Lv.7：`knockback × 1.25`。
- Lv.12：`pierce + 3`。
- Lv.18：`projectileRadius × 1.3`。
- Lv.22：`spread + 1`。
- Lv.26：调用 `applyWound(enemy, 0, 0, 1, 0.1)`，即额外 1 秒、90% 治疗压制。若现有重伤接口对额外系数的定义不同，先核对 `applyWound` 实现后再使用能够产生“额外治疗系数 0.1”的参数，不能写错成 90% 治疗。

### 无人机

- Lv.2：`duration + 1.5`。
- Lv.7：尺寸倍率额外 ×1.15。
- Lv.12：命中后使目标 5 秒内受到伤害 +30%，复用现有受伤增加机制。
- Lv.18：`speed × 1.15`。
- Lv.22：额外生成 1 架无人机，第二架伤害 ×0.7。
- Lv.26：撞击 `applyStun(enemy, 0.6)`。

### 跃迁电子

- Lv.2：`bounces + 2`。
- Lv.7：`stunDuration + 0.4`。
- Lv.12：目标 `burn > 0` 时，本次电链伤害 ×1.35。
- Lv.18：目标处于冻结硬控时，本次电链伤害 ×1.35。两个条件同时满足时只乘一次 1.35，不要乘两次。
- Lv.22：额外 1 条电链，伤害 ×0.7，继承其他账户增益。
- Lv.26：每次命中独立有 20% 概率释放一条无强化电链。该电链固定弹射 5 次，不继承账户高级增益、局内词条、伤害加成和麻痹强化；基础伤害使用技能默认值。

## 10. Canvas 界面

当前生产界面由 Canvas 绘制，必须完整实现以下界面。

### 技能图鉴详情

在 `drawSkillGroupDetail` 中，步枪分组不显示账户强化。

核心技能详情显示：

- 账户等级 `Lv.N / 31`
- 暴击率加成
- 当前技能伤害加成
- 当前技能冷却缩减
- 已获得的高级增益名称
- 下一高级增益预览
- 服务端返回的金币和专属图纸消耗
- “强化”按钮

未登录或离线时显示“登录后保存技能等级”，按钮不可触发请求。材料不足、满级和 busy 状态要有明确文案。

新增几何必须放进 `config.skillCodexUI` 或独立的 `config.skillProgressUI`。`render.js` 与 `input.js` 必须调用同一组矩形函数。浮层打开时要吞掉下层点击。

### 角色页

在角色页中部增加“技能强化”入口。现有装备与城墙入口可以缩小或改为三入口，但点击矩形、绘制矩形和返回路径必须一致。

技能强化页显示 12 个技能行或分页卡片：

- 技能名、账户等级、伤害和冷却加成
- 当前图纸数量与升级消耗
- 下一节点
- 强化按钮

返回必须回到角色页。

### 资源与结算

账户中心资源区要能容纳新增资源。现有固定 4×3 不足以显示 23 项资源，改为分页或可滚动网格，不能让资源重叠。

角色背包资源页继续隐藏数量为 0 的资源。超过一页时必须允许翻页，不能再把超过 12 项的资源截掉。

结算界面的“图纸”汇总必须把技能图纸与装备图纸分开，避免玩家误以为获得的是部位图纸。

## 11. React 并行层

当前 `frontend/src/app/App.jsx` 不是实际游戏界面，但并行层必须保持可用。

修改：

- `frontend/src/game/actions.js`
- `frontend/src/game/ui-store.js`
- `frontend/src/features/CodexScreens.jsx`
- `frontend/src/features/CharacterScreens.jsx`
- `frontend/src/features/AccountScreens.jsx`
- `frontend/src/features/BattleOverlays.jsx`

React 不直接请求 `/api`，不直接写 `Game.state`。升级命令只调用 `Game.accounts.upgradeSkill` 或对应 action。

## 12. 验证脚本与命令

新增或扩展：

- `tmp/check_db.py`
- `tmp/check_api.py`
- `tmp/check-accounts.js`
- `tmp/check-rewards.js`
- `tmp/check-skills.js`

至少覆盖：

- schema 7 与 `skill_progress` 建表。
- 新账户 12 行 Lv.1。
- 缺行账户幂等补齐。
- 删除账户后技能行级联删除。
- Lv.1 到 Lv.2 扣 150 金币和 10 张对应图纸。
- 其他技能图纸不可替代。
- 材料不足不改等级和资源。
- 连续升级到 31 后返回满级错误。
- 重新登录保持等级。
- tier 0 无技能图纸。
- tier 1 正好 2 张。
- tier 2 为 6 到 12 张。
- tier 3 为 10 到 16 张。
- 账户 Lv.31 的暴击、伤害、冷却计算。
- 暴击率达到 95% 后不再增加。
- 测试场不应用账户等级。
- 干冰 Lv.7 没有局内冰冻词条时不产生冻结。
- 跃迁电子燃烧和冻结条件同时满足时伤害只 ×1.35 一次。
- 温压弹 Lv.26 可以给燃烧免疫目标施加燃烧，但火系伤害倍率不变。
- 未登录点击强化不发请求。

完成后执行：

```powershell
npm --prefix frontend run build
node tmp\check-react-ssr.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
.venv\Scripts\python -m compileall server
.venv\Scripts\python tmp\check_db.py
.venv\Scripts\python tmp\check_api.py http://127.0.0.1:8787
node tmp\check-accounts.js
node tmp\check-rewards.js
node tmp\check-skills.js
git diff --check
```

如果本地 8787 服务未运行，先启动项目现有服务后再执行 API 检查；不要新建第二个持久服务进程。

画面核对使用现有 `tmp/trace-draw.js` 与 `tmp/replay-draw.py`。至少输出技能图鉴详情、技能强化页、资源翻页和结算奖励四种场景。

## 13. 文档同步

实现完成后更新：

- `README.md`：新增技能等级、图纸、价格、奖励和界面说明。
- `DEVELOPMENT_PLAN.md`：新增一节“技能图纸与技能等级（已实现）”。
- `DEVELOPMENT_LOG.md`：记录实现日期、文件、规则和实际验证结果。
- `AGENTS.md`：补充技能账户等级与局内等级的边界。

## 14. 完成标准

- 12 个技能均可从 Lv.1 持久化升级到 Lv.31。
- 价格、扣费、发奖均由服务端权威计算。
- 账户等级不影响局内词条等级和 HUD 的局内 `Lv.N`。
- 暴击、伤害、冷却和 72 个高级增益节点全部生效。
- 未登录、离线、材料不足、满级、错误图纸和重复请求都不会造成错误扣费。
- 旧账户打开后自动获得 12 个 Lv.1 技能行。
- 构建、语法检查、数据层、接口、前端脚本和 `git diff --check` 均通过。

## 15. DeepSeek V4.1 Flash 提示词

把以下提示词完整交给实现模型。

```text
你在 E:\vs_python\folder\Pvzgame_test 中实现“技能图纸与技能等级”。先完整阅读 AGENTS.md、README.md、DEVELOPMENT_PLAN.md 和 SKILL_PROGRESS_IMPLEMENTATION.md。以 SKILL_PROGRESS_IMPLEMENTATION.md 为唯一实现规格；如果它与旧文档的未来计划表述冲突，以该规格为准，但不得违反 AGENTS.md 的战斗、账户和代码边界。

严格实现，不要重写战斗系统，不要新增依赖，不要把账户技能等级写入 player.skills[id].level。player.skills[id].level 永远只表示局内词条等级，HUD 的 Lv.N 也保持原义。

后端使用现有 FastAPI、SQLAlchemy 和 SQLite 模式：
- SCHEMA_VERSION 升到 7。
- 新增 skill_progress(account_id, skill_id, level)，复合主键，账户外键级联删除。
- 12 个现有核心技能各一行，新账户和旧账户在 GET /api/me 时幂等补齐为 Lv.1。
- 新增 12 种专属技能图纸资源，追加到 RESOURCE_IDS 和前端 config.resources。
- 升级价格只由服务端计算：金币 150 + 50 × (currentLevel - 1)，图纸 10 × currentLevel。Lv.1→2 为 150 金币 + 10 图纸，Lv.30→31 为 1600 金币 + 300 图纸。
- 新增 POST /api/me/skills/upgrade。满级返回 max_skill_level，资源不足返回 not_enough_resources，未知技能返回 unknown_skill。扣费和升级必须在同一事务内。
- 奖励只增加技能图纸：tier 1 为 2 张，tier 2 为 6–12 张，tier 3 为 10–16 张。每张独立随机到 12 个技能之一。不要改变现有金币、装备图纸、材料、宝石和装备奖励。

前端沿用账户缓存和命令边界：
- src/accounts.js 缓存 skills，并提供 upgradeSkill。
- 新增 src/skills.js，对外为 Game.skillProgress；它是只读账户数据层。
- src/attributes.js 使用独立 skillModifiers 汇总暴击率，不影响装备和宝石修正。
- 每级提供暴击率 +0.5%、对应技能伤害 +8%、对应技能冷却间隔 ×0.985。Lv.31 合计暴击 +15%、伤害 +240%、冷却速率 pow(0.985, 30)。
- 暴击仍受 95% 上限约束。冷却只在 updateSkills 推进 fireTimer 时乘算，不改 fireInterval 原始值。
- 伤害倍率只在 Game.damageEnemy 中按 progressSkillId 或核心技能 damageSource 应用。
- 开局把账户数据快照到 player.accountSkills；战斗中不读取 Game.accounts。测试场固定使用 Lv.1 空快照。

高级增益只能在账户等级 2、7、12、18、22、26 解锁，规格中的 72 个节点必须全部实现。特别注意：
- 温压弹 Lv.26 只忽略燃烧状态免疫，不改变火系伤害倍率。
- 干冰弹 Lv.7 只有已获得局内 iceFreeze 词条时才额外增加 0.5 秒冻结。
- 装甲车不缩短 0.12 秒命中间隔。
- 电磁穿刺的电链、小冰弹和灼烧区域归属 electromagnetic。
- 旋风触发的纯伤害气刃读取压缩气刃当前伤害，但伤害来源仍是 whirlwindCannon。
- 跃迁电子燃烧与冻结加成同时满足时只乘一次 1.35。
- Lv.26 的无强化电链不继承任何账户增益或局内强化。
- 所有状态必须走现有 apply* 入口，所有伤害必须走 damageEnemy。

界面必须同时更新实际 Canvas 生产界面和 React 并行层。技能图鉴详情与角色页技能强化界面显示等级、加成、下一节点、服务端 nextCost 和强化按钮。render.js 与 input.js 共用几何。账户资源区改为分页或可滚动，角色资源页不能截掉超过 12 项的资源。结算界面分开汇总装备图纸和技能图纸。

完成后更新 README.md、DEVELOPMENT_PLAN.md、DEVELOPMENT_LOG.md、AGENTS.md，并执行文档中的全部验证命令。最后报告修改文件、实际验证结果、未执行的检查和原因。不要声称未运行的命令已通过。
```
