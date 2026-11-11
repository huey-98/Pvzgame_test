# 宝石词条扩充：防线格挡与四类条件增伤

> 临时开发计划。完成后把结论并入 `DEVELOPMENT_PLAN.md` §17.4，本文件移入 `docs/archive/features/`。

## 目标

新增 5 种宝石词条，全部为「已镶嵌才生效」的被动效果：

1. **防线格挡**：防线受到攻击时优先消耗格挡次数，完全抵消该次伤害。
2. **首领增伤**：对首领与精英造成的直接伤害提高。
3. **负面增伤**：对处于持久负面状态的目标造成的直接伤害提高。
4. **枪械增伤**：步枪弹造成的伤害提高。
5. **低血增伤**：防线血量低于阈值时，所有直接伤害提高。

验收口径：

- 新词条可正常掉落、调试注入、镶嵌、锁定与五合一；同部位同词条唯一规则不变。
- 只有已镶嵌宝石提供效果，卸下后立即失效。
- 不改变现有护甲、属性抗性、来源减伤、状态缩放与致残易伤规则。
- 不新增数据库表或字段，旧账户无需迁移。
- 画面上能看清防线格挡余量、格挡触发提示与属性面板中的条件增伤。

## 影响文件

| 文件 | 改动 |
| --- | --- |
| `server/app/config.py` | `GEM_AFFIXES` 增加 5 条词条；`affix_payload` 支持可选 `suffix` |
| `src/config.js` | `config.gems.lowWallHpThreshold`；`config.attributesUI` 增加宝石特效行几何 |
| `src/gems.js` | `emptyTotals` / `getTotals` 增加 5 个字段 |
| `src/attributes.js` | `compute` 计算 5 个字段；`applyPlayer` 写入玩家；`applyWall` 写入格挡次数 |
| `src/state.js` | 重置城墙时初始化 `blockMax` / `blockCharges`；测试场恢复时补满格挡 |
| `src/combat.js` | 新增 `isEliteOrBossEnemy`、`hasNegativeStatus`、`getGemDamageScale`、`damageWall`；`damageEnemy` 接入条件倍率；远程弹改走 `damageWall` |
| `src/update.js` | 近战与炸弹爆炸改走 `damageWall` |
| `src/render.js` | 城墙耐久条显示格挡余量；属性面板显示宝石特效 |
| `src/input.js` | 无新增点击区域，预期不改 |
| `tmp/check-gems.js` | 同步词条表，补宝石汇总、属性与格挡断言 |
| `tmp/check-gem-combat.js` | 新增一次性战斗规则断言脚本 |
| `DEVELOPMENT_PLAN.md` | §17.4 补机制；§17.1 补伤害顺序；§27 补常见坑 |
| `AGENTS.md` | 铁律补「防线受伤必须走 `Game.damageWall`」 |
| `README.md` | 玩家可见的 5 种新词条说明，不写可变数值 |
| `DEVELOPMENT_LOG.md` | 实现完成后追加一条事实记录 |

## 配置与数据变更

### 服务端 `server/app/config.py`

在 `GEM_AFFIXES` 增加以下条目（首轮建议值，最终以配置为准）：

| affix id | 名称 | kind | 灰 / 绿 / 蓝 / 紫 / 红 | percent | suffix |
| --- | --- | --- | --- | --- | --- |
| `wallBlock` | 防线格挡 | `wallBlock` | 1 / 2 / 3 / 4 / 5 次 | 否 | ` 次` |
| `eliteDamage` | 首领增伤 | `eliteDamage` | 10% / 20% / 30% / 40% / 50% | 是 | — |
| `debuffDamage` | 负面增伤 | `debuffDamage` | 10% / 20% / 30% / 40% / 50% | 是 | — |
| `rifleDamage` | 枪械增伤 | `rifleDamage` | 5% / 10% / 15% / 20% / 25% | 是 | — |
| `lowWallDamage` | 低血增伤 | `lowWallDamage` | 10% / 20% / 30% / 40% / 50% | 是 | — |

- `affix_id` 均不超过 `String(32)`，无需改表。
- `affix_payload` 的文本拼装增加可选 `suffix`，用于「防线格挡 +3 次」。
- 新词条自动进入 `random_affix` 掉落池，不需要改 `rewards.py`。
- `/api/me/gems/grant` 的 `affixId` 白名单直接复用 `GEM_AFFIXES`，无需新接口。

### 客户端 `src/config.js`

- `config.gems.lowWallHpThreshold`：低血增伤阈值，首轮建议 `0.35`，与城墙低血变色阈值共用，避免两处硬编码漂移。
- `config.attributesUI.gemTraitY` / `gemTraitNoteY`：属性面板新增「宝石特效」行与说明行的位置。

### 数据库

- 不新增表、不新增字段；`gems.affix_id` 已能容纳新 ID。
- `schema_version` 不需要升级。

## 规则设计

### 1. 防线格挡

- 数值：每颗宝石提供 1～5 次，按品质提升；六个部位都镶满红色时每局最多 30 次。
- 计数粒度：**每局一次**，开局由 `Game.attributes.applyWall` 写入 `wall.blockMax` 与 `wall.blockCharges`，不随波次刷新。
- 消耗顺序：受到任意一次防线伤害时，若 `blockCharges > 0`，先扣 1 次并完全抵消该次伤害；否则正常扣防线血量。
- 覆盖范围：近战攻击、远程弹命中、炸弹撞线爆炸，共 3 条现有路径。
- 统一入口：新增 `Game.damageWall(amount, x, y)`，三条路径全部改走它；禁止再直接写 `wall.hp -=`。
- 返回结果：`{ blocked, dead }`，调用方只负责爆炸、火花等非血量表现与后续流程。
- 触发表现：被格挡时在受击点显示「格挡」，不显示伤害数字；仍播放原有爆炸或火花效果。
- 防线耐久条上方显示「格挡 N / M」，`blockMax` 为 0 时不显示。
- 测试场：沿用其他宝石加成的做法，测试场也继承格挡次数；`Game.testRestore` 时把 `blockCharges` 恢复到 `blockMax`。

### 2. 首领增伤

- 判定：`Game.isBossEnemy(enemy)` 为真，或 `C.enemies[enemy.type].codexCategory === "elite"`。
- 新增辅助 `Game.isEliteOrBossEnemy(enemy)`，避免在各处重复写判定。
- 倍率：`1 + p.eliteDamage`，只作用于 `Game.damageEnemy` 的直接伤害。
- 召唤物与分裂子体按自身类型判定；首领召唤出的小怪不继承首领增伤。

### 3. 负面增伤

- 判定：新增 `Game.hasNegativeStatus(enemy)`，以下任一持久状态存在即成立：
  - 燃烧 `enemy.burn > 0`
  - 冻伤 `Game.getFrostbiteStacks(enemy) > 0`
  - 减速 `enemy.slow > 0`
  - 硬控 `enemy.control > 0`（眩晕 / 冻结 / 麻痹）
  - 重伤 `enemy.wound > 0` 或 `enemy.woundExtra > 0`
- 不纳入：击退与牵引是瞬时位移；`damageTakenTimer`、`scorchStacks`、`napalmMark` 属于技能标记，不按 `config.statusEffects` 的负面状态处理。
- 倍率：`1 + p.debuffDamage`，只作用于 `Game.damageEnemy` 的直接伤害。
- 燃烧与冻伤的每秒伤害在 `update.js` 直接扣血，不经过 `damageEnemy`，因此**不吃负面增伤**；这与手册「持续伤害不走属性倍率」的既有约定一致。
- 同一次命中先结算伤害、后施加负面状态，所以「打出第一个负面状态的那一击」不吃加成，后续命中才吃。

### 4. 枪械增伤

- 判定：伤害来源快照的 `damageSource === "rifle"`，包括步枪分裂弹与弹射弹；技能弹、装甲车、燃烧/冻伤不吃。
- 倍率：`1 + p.rifleDamage`，在 `Game.damageEnemy` 内乘算。
- 与暴击的关系：暴击已在 `Game.fireShot` 生成子弹时乘进 `bullet.damage`，枪械增伤在命中时再乘，二者相乘。
- 不修改步枪基础伤害 `p.damage`，避免属性重复应用或中途重算累积。

### 5. 低血增伤

- 判定：`S.wall` 存在且 `S.wall.hp > 0` 且 `S.wall.hp / S.wall.maxHp <= C.gems.lowWallHpThreshold`。
- 倍率：`1 + p.lowWallDamage`，作用于所有直接伤害，不限来源。
- 阈值首轮建议 35%，与城墙低血变色阈值一致；最终读取 `config.gems.lowWallHpThreshold`。
- 只按当前血量比例判定，不缓存「曾经低血」状态；防线回血后加成立即消失。

### 伤害顺序

`Game.damageEnemy` 改为：

```text
护甲格挡
→ 攻击倍率
→ 元素倍率
→ 技能账户倍率
→ 宝石条件增伤（首领 / 负面 / 枪械 / 低血）
→ 敌人属性抗性
→ 来源减伤
→ 致残易伤
→ 扣血
```

条件增伤之间为乘算；同类词条跨部位相加后再乘。上限方面沿用「攻击力无上限」的思路，不加额外 cap；结构上同部位同词条唯一，最多 6 颗，首领 / 负面 / 低血最高 +300%，枪械最高 +150%。

### 属性与展示

- `Game.attributes.compute()` 增加：
  - `wallBlockCharges`
  - `eliteDamage`
  - `debuffDamage`
  - `rifleDamage`
  - `lowWallDamage`
- `applyPlayer` 写入 `p.eliteDamage`、`p.debuffDamage`、`p.rifleDamage`、`p.lowWallDamage`。
- `applyWall` 写入 `wall.blockMax` / `wall.blockCharges`。
- 属性面板在元素区与说明区之间增加一行「宝石特效」，只列出非零项：
  - `格挡 N 次/局`
  - `首领 +X%`
  - `负面 +X%`
  - `枪械 +X%`
  - `低血 +X%`
- 存在低血增伤时，下方补一句「防线血量低于阈值时生效」，阈值读配置。
- 宝石背包格、槽位行、详情与合成弹窗继续使用服务端 `affix.text`，无需为 5 条词条单独写绘制分支。

## 实现步骤

1. 在 `server/app/config.py` 增加 5 条 `GEM_AFFIXES`，扩展 `affix_payload` 的 `suffix` 拼装。
2. 在 `src/config.js` 增加低血阈值与属性面板几何。
3. 在 `src/gems.js` 的 `emptyTotals` / `getTotals` 接入 5 个 `kind`。
4. 在 `src/attributes.js` 的 `compute` / `applyPlayer` / `applyWall` 接入字段。
5. 在 `src/state.js` 初始化城墙格挡字段；测试场恢复时补满。
6. 在 `src/combat.js` 增加 4 个辅助函数，并把条件倍率接进 `damageEnemy`。
7. 把 `src/combat.js` 的远程弹、`src/update.js` 的近战与炸弹爆炸改为 `Game.damageWall`。
8. 在 `src/render.js` 增加城墙格挡显示与属性面板宝石特效行。
9. 同步 `tmp/check-gems.js`，补 `tmp/check-gem-combat.js`。
10. 更新 `AGENTS.md`、`DEVELOPMENT_PLAN.md`、`README.md`、`DEVELOPMENT_LOG.md`，归档本计划。

## 验证方式

### 必跑

```powershell
npm --prefix frontend run build
node tmp\check-react-ssr.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
node tmp\check-docs.js
git diff --check
```

```powershell
.venv\Scripts\python -m compileall server
.venv\Scripts\python tmp\check_db.py
.venv\Scripts\python tmp\check_api.py http://127.0.0.1:8787
```

### 专项

- `node tmp\check-gems.js`：新词条进入背包、锁定、合成与属性汇总。
- `node tmp\check-gem-combat.js`：
  - 格挡先扣次数、不扣血；次数耗尽后正常扣血；三条防线伤害路径都会消耗次数。
  - 首领与精英吃首领增伤，小怪不吃。
  - 燃烧 / 冻伤 / 减速 / 硬控 / 重伤目标吃负面增伤；无负面状态与第一击不吃。
  - 步枪弹吃枪械增伤，技能弹与持续伤害不吃。
  - 防线低于阈值吃低血增伤，回血后失效。
  - 燃烧与冻伤每秒伤害不吃条件增伤。
- 服务端：`gems.payload` 的 `text` 对 5 条新词条格式正确，`/api/me/gems/grant` 可注入指定 `affixId`。
- 画面回放：
  - `node tmp\trace-draw.js account characterGems` 与 `characterGemDetail` 核对新词条文本。
  - `node tmp\trace-draw.js enemies` 核对城墙格挡余量与「格挡」浮字。
  - `python tmp\replay-draw.py` 出图人工核对。

### 人工检查

- 六个部位分别镶嵌新词条，确认同词条唯一与高品质替换行为不变。
- 进入战斗后确认格挡次数只在开局初始化、不会被波次刷新。
- 防线残血时确认伤害数字变化，回血后恢复。
- 首领 / 精英与小怪分别受击，确认首领增伤只作用于前两者。
- 未登录或离线时宝石操作仍被禁用，不引入 `localStorage`。

## 待确认

1. **枪械增伤**首轮按百分比处理；如果要「固定伤害数值」，改为平铺 `+N` 并把 `kind` 改成 `rifleFlat`。
2. **负面增伤**只覆盖 `damageEnemy` 的直接伤害；如果要把燃烧 / 冻伤每秒伤害也算进去，需要在 `update.js` 的 DoT 结算另接倍率。
3. **防线格挡**按每局固定次数、完全抵消单次伤害处理；如果希望每波刷新，或只抵消不超过上限的伤害，需要另定规则。
4. **低血阈值**首轮 35%；如果希望与城墙变色阈值解耦，单独加配置字段。
5. 品质数值为首轮建议，实施后用现有检查脚本做一轮平衡复核。

## 文档同步清单

- [ ] `DEVELOPMENT_PLAN.md` §17.4、§17.1、§27
- [ ] `AGENTS.md` 铁律：防线受伤必须走 `Game.damageWall`
- [ ] `README.md` 玩家可见的新词条说明
- [ ] `DEVELOPMENT_LOG.md` 追加一条
- [ ] `docs/README.md` 登记归档
