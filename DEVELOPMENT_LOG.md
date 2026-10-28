# 开发日志：分裂僵尸、精英与装甲车支援

> 这是一份**按日期记录的历史日志**（最后一篇停在 2026-10-03），每条记录只描述当时的实现与数值，其中被后续改动覆盖的数字不会回填。**当前生效的规则与数值以 `README.md`、`DEVELOPMENT_PLAN.md`、`AGENTS.md` 与 `src/config.js` 为准**；新增功能时优先同步这三份文档，本日志仅在需要留档时追加。

## 2026-09-29 · 阶段 A 已实现（分裂僵尸与精英）

阶段 A（分裂僵尸、分裂僵尸精英）已按下方计划实现并验证；阶段 B（装甲车支援）已于 2026-10-02 实现并完成冒烟验证。

## 2026-10-02 · 阶段 B 已实现（装甲车支援）

- 新增局内解锁的装甲车技能与 5 种专属强化：增伤、车辆增援、减速延长、眩晕冲撞、重型底盘；技能图鉴和升级池自动收录。
- 装甲车按 7 秒冷却从城墙前随机车道驶向屏幕上方；基础车身 34 × 64、速度 140、每 0.16 秒对同一目标造成 4 点伤害。多车分散车道，车辆离屏后移除。
- 碾压施加 0.55 倍移动速度、持续 1.2 秒的减速；眩晕每车对每个目标只判定一次，默认概率为 0、持续 0.6 秒。车身升级同步扩大碰撞尺寸。
- 车辆伤害使用统一伤害和击杀流程，但不继承步枪燃烧/冰冻词条；被撞死的分裂僵尸正常生成待处理幼体。眩晕时敌人不移动、不攻击城墙，仍可受伤、燃烧和回血；自动索敌预判将眩晕敌人视为静止。
- 单局状态增加车辆列表，重开和退出时清空；HUD 扩展为三个技能槽，敌人绘制以蓝色环表示减速、金色虚线环和“晕”标记表示眩晕。
- 验证：全部脚本 `node --check` 通过；冒烟测试覆盖解锁、增援数量与车道间隔、多段伤害、眩晕/减速、步枪状态隔离及分裂击杀。

实现结果：

- `config.enemies` 新增 `splitter`、`splitterChild`、`splitterElite`、`splitterEliteChild`，采用建议首轮数值；精英类型带 `regenPerSecond`。
- `Game.spawnEnemy(type, options)` 支持指定坐标与静默生成；`Game.queueSplitSpawns` + `Game.flushPendingSpawns` 在安全时机统一入队子体，避免遍历中改数组。
- `Game.killEnemy` 统一触发分裂，精英幼体生成不再重复播报“精英来袭”。
- `update.js` 在燃烧结算之后按 `regenPerSecond * dt` 回血并限制在最大生命。
- 第一关第 3、4 波 mix 加入 `splitter`；第 4 波改用 `elitePool` 从普通、快跑、分裂精英中随机登场 1 只。
- `render.js` 新增 `drawZombieHead`，双头分裂僵尸共用身体绘制两个头，幼体单头更小；精英与幼体保留金色识别环，并加入克制的回血光圈。
- 图鉴调整：分裂幼体标记 `codexHidden: true`，`Game.getCodexEnemyIds` 统一过滤，幼体不再进入僵尸图鉴列表；仅本体精英与普通分裂僵尸入册。
- 验证：`node --check` 全部通过；冒烟测试覆盖分裂数量、子体不再分裂、精英回血上限、燃烧致死不回血、精英池、渲染与整局跑通（14 只普通分裂僵尸恰好产生 28 只幼体，最终胜利）。

## 2026-09-27 · 阶段 B 原始开发计划

本条其余部分记录阶段 B 的原始实施方案；阶段 A 已按上节实现，阶段 B 已于 2026-10-02 完成。下方首轮数值为实施前建议值，最终值以本文件的阶段 B 完成记录与配置为准。

### 一、目标和现有约束

- 新增**两个头共用一个身体**的分裂僵尸及其精英：普通个体死亡后生成两只小僵尸；精英死亡后也生成两只，且精英本体与其分裂体均持续回复生命。
- 新增局内词条解锁的**装甲车支援**：从防线前方随机位置出发，沿屏幕向上行驶，持续碾压路径上的僵尸，造成多段低伤害和减速；提供增伤、车辆数量、减速时间、眩晕概率、体型五类强化词条。
- 现有 `Game.killEnemy` 汇总击杀、经验与移除；`Game.update` 包含波次判定、燃烧和敌人移动；`Game.updateSkills` 只处理已解锁技能；新增逻辑应沿用这些入口，不把战斗计算放入渲染层。
- 当前第 1 关共 5 波，第 4 波只生成一只精英，第 5 波生成首领；扩展至 7 波时仍遵循第 4 波一只精英、第 7 波一只首领。精英分裂出的子体属于这一只精英的衍生单位，**不算新增的波次精英生成次数**。
- 右上角枪械图标下只有温压弹、干冰弹两个固定技能槽；加入装甲车时需容纳第三槽，未解锁时仍显示空槽，解锁后显示图标和 `Lv.N`。

### 二、阶段 A：分裂僵尸与分裂僵尸精英

#### A1. 静态数据与图鉴

在 `src/config.js` 的 `enemies` 中规划四种独立敌人类型（标识为暂定名称，实施时保持命名一致）：

| 类型 ID | 图鉴分类 | 形态和行为 | 死亡后 |
| --- | --- | --- | --- |
| `splitter` | `minion` | 双头、单身体的分裂僵尸 | 生成 2 只 `splitterChild` |
| `splitterChild` | `minion` | 单头、体型更小的分裂体 | 正常死亡，不再分裂 |
| `splitterElite` | `elite` | 更大的双头单身体；持续自愈 | 生成 2 只 `splitterEliteChild` |
| `splitterEliteChild` | `elite` | 比精英本体小、仍保留精英识别特征；持续自愈 | 正常死亡，不再分裂 |

- 为每个类型填写 `hp/speed/radius/damage/xp/color/accent/codexCategory/description/tactics`；双头视觉不靠名称区分，由模型直接呈现。精英本体生命、速度、伤害和体型均不弱于普通分裂僵尸；精英分裂体相对普通分裂体也应更强。
- 数据字段可采用 `splitInto/splitCount/regenPerSecond` 等，明确父体的目标子类型与回血数值；子体不配置 `splitInto`，从数据层阻断递归分裂。所有回血速率和分裂偏移放进配置，不散落为魔法数字。
- **首轮平衡建议，非最终数值**：普通本体生命 60、速度 27、半径 16、墙伤 10、经验 12；普通子体生命 18、速度 38、半径 9、墙伤 5、经验 3；精英本体生命 620、速度 34、半径 25、墙伤 22、经验 55、每秒回血 8；精英子体生命 100、速度 42、半径 12、墙伤 10、经验 10、每秒回血 3。回血不超过自身最大生命，按实际 `dt` 计算并在体验测试后调平衡。
- 僵尸图鉴自动收录新类型；补齐四种形态的描述与应对建议。最终决定：分裂幼体不单独收录，通过 `codexHidden` 过滤，图鉴只显示分裂僵尸本体与分裂僵尸精英。

#### A2. 生成、受击、死亡与回血

1. `Game.spawnEnemy` 支持在指定坐标创建分裂体，坐标以父体死亡点为中心左右错开，并按子体半径限制在画面边缘与防线范围内；子体不得被误判为新一轮从屏幕顶部投放的敌人。
2. 在 `Game.killEnemy` 统一处理分裂：普通本体只生成 2 只普通子体，精英本体只生成 2 只会回血的精英子体；击杀本体正常结算一次经验/击杀，击杀各子体再分别结算，重复命中或多种伤害源同时击杀不得重复分裂和重复计奖。
3. 鉴于步枪弹、技能弹、爆炸和燃烧分别在不同循环中删除敌人，建议先记录待生成子体，再于安全时机统一入队，避免循环中修改 `S.enemies` 导致跳过目标、同一帧重复命中或数组下标错乱。波次完成判断须在子体入队后执行。
4. `src/update.js` 对精英本体与精英子体在存活期间按 `regenPerSecond * dt` 回血，结果限制在 `[0, maxHp]`；致死攻击直接进入死亡分裂/移除流程，不能被该帧回血“复活”。燃烧与回血的先后顺序明确为先结算燃烧致死、再对幸存目标回血。
5. 普通分裂体与精英分裂体都正常参与瞄准、伤害、城墙攻击、经验、清波和胜负判定；精英子体生成时只展示分裂效果，不重复播报“精英来袭”。当前首领在 `killEnemy` 中有直接胜利分支，实施时核对其与场上残留分裂体是否冲突，避免提前结算。

#### A3. 波次、模型和效果

- 在当前**可玩的第 1 关**把普通分裂僵尸加入后期波次的 `mix`（建议第 3、4 波逐步引入），确保无需开放第 2 关也能实际遇到它；不要改变当前首领的第 5 波位置。
- 第 4 波仍只由波次调度生成 **1 只**精英。建议将原先固定的 `normalElite` 扩展为精英候选池（普通、快跑、分裂精英可选），每局选中一个；保留已有精英登场机会，同时让分裂精英可在第一关遇到。分裂子体不增加 `spawnCount`，但在消灭前会阻止清波。
- `src/render.js` 为 `splitter` / `splitterElite` 绘制清晰可辨的**两个头、一个身体**（共享躯干、左右两个头和各自眼睛）；子体只显示单头且比例更小。精英本体与子体保留金色精英识别，回血用克制的视觉反馈；分裂时可加入粒子或短暂提示。
- 调整 `drawCodexEnemyModel` 的缩放/裁剪适配双头外形，确保战斗画面、图鉴卡片和详情页都能完整显示，不与血条挤在一起。

#### A4. 阶段验收

- 任何伤害来源（步枪、温压弹冲击/爆炸/燃烧、干冰弹等）击杀普通/精英本体后，均恰好产生对应两只子体；子体死亡不再分裂。
- 精英本体与精英子体持续回血，普通本体与普通子体不回血；回血不越过最大生命，死亡不能被回血撤销。
- 第 4 波调度仍每局只产生一只精英本体；击败精英本体后，两个子体活着时不能清波。四种形态的模型与图鉴可区分，边缘死亡也不会生成越界子体。

### 三、阶段 B：装甲车支援技能

#### B1. 解锁、静态数值与词条

- 在 `src/config.js` 的 `skillDefaults.armoredCar` 配置 `unlocked: false, level: 0`，独立冷却、基础每次放车数量、行驶速度、车身尺寸、单次伤害、同目标受击间隔、减速倍率与时长、眩晕概率与时长；`coreSkills` 中将现有“筹备中”条目在实现完成后改为“已实装”并补充说明。
- 增加 `skillId: "armoredCar"`、`unlocksSkill: true`、`max: 1` 的专用解锁词条；解锁时成为 `Lv.1`，未解锁不得出现强化项也不得放车。后续每获得一个装甲车专属词条，沿用 `Game.chooseTrait` 的逻辑使技能总等级 `+1`；满级词条不再出现。
- 五种强化按用户要求设计为下表；“**增上**”暂按“**增伤**”理解，实施前可确认用词：

| 词条 | 计划效果 | 建议词条上限（可调） |
| --- | --- | --- |
| 装甲车增伤 | 每级提升每次碾压造成的低数值伤害，保留多段命中机制 | 5 |
| 车辆增援 | 每次释放的装甲车数量 `+1`，每辆独立随机选取防线前出发位置 | 2 |
| 减速延长 | 碾压附加的减速持续时间增加，重复命中可刷新持续时间 | 4 |
| 眩晕冲撞 | 每次与某辆车首次接触时，按词条等级判定一次眩晕概率；不按帧重复抽奖 | 3 |
| 重型底盘 | 每级增加车身宽度与长度，碰撞范围与视觉大小同步提升 | 3 |

- **首轮平衡建议，非最终数值**：基础冷却 7 秒、每轮 1 辆、速度每秒 140 逻辑像素、车身约宽 34 × 长 64、每次碾压伤害 4、同一敌人受击间隔 0.16 秒、减速倍率 0.55、减速 1.2 秒；增伤每级 `+20%`、减速延长每级 `+0.4` 秒、眩晕每级 `+10` 个百分点且成功时眩晕 `0.6` 秒、体型每级 `+15%`。所有数值在密集尸潮与 Boss 场景下复测。

#### B2. 发车与碰撞规则

1. 装甲车是**独立的移动实体**，从 `S.wall` 顶边前方的随机横坐标生成，沿竖直方向向上行驶；生成范围须考虑车宽和屏幕边界，多车同轮尽量错开车道，不能从幻形枪口发射，也不消耗步枪弹药。
2. 在 `Game.updateSkills` 为 `armoredCar` 分支处理冷却与发车；当前 `getSkillTargetAngle` / `launchSkillVolley` 的通用弹丸逻辑依赖 `projectileSpeed/projectileRadius`，不能直接把装甲车落入干冰弹分支。车辆实例单独存入单局状态，重开/退出时清空。
3. 车辆沿途用车身矩形与敌人圆形检测接触；对同一辆车、同一敌人按独立的计时器多次造成**低伤害**，而不是每帧扣血，也不能用普通子弹的“一次命中后永久忽略目标”逻辑。车辆离开屏幕上沿后移除，随之清理目标计时数据。
4. 每次有效碾压都施加/刷新减速，强度不覆盖已有更强冰冻效果；首次与该车接触时可判定一次眩晕。眩晕期间敌人停止移动、停止攻击城墙，但仍可受伤、燃烧和回血；结束后恢复原有行动，减速剩余时间按正常规则处理。自动索敌的预判也要考虑减速/眩晕，避免提前量异常。
5. 当前 `Game.damageEnemy` 会对所有伤害应用玩家步枪燃烧/冰冻属性；接入装甲车时区分伤害来源，以免装甲车的每段伤害意外继承步枪词条。敌人被撞死仍统一走 `Game.killEnemy`，触发分裂、经验与击杀计数。

#### B3. 表现、图鉴和布局

- `src/render.js` 为装甲车绘制自防线驶向尸潮的顶部视角车身/轮胎/装甲，随体型升级放大；命中提供轻量碾压反馈，减速与眩晕应有不同视觉提示，并能与现有僵尸血条和精英光环共存。
- `src/state.js` 初始化车辆列表并在 `Game.reset` 清理；`src/update.js` 推进车辆位置、分段命中、眩晕计时及状态恢复；`src/combat.js` 保存解锁/发车/伤害规则，避免渲染代码改动战斗状态。
- 右上 HUD 从两个固定技能槽扩展为**三个**，保留温压弹、干冰弹原有的空槽/等级显示，再加入装甲车图标与 `Lv.N`；适配 360 × 640 画面，避免与弹药数、经验条、波次和 Boss 提示重叠。
- 技能图鉴由 `coreSkills` 和 `skillTraits.skillId` 自动分组；装甲车介绍页显示解锁词条和五种强化，不将新词条散列到其他技能下面。

#### B4. 阶段验收

- 未解锁时不发车；在装甲车相关词条中仅解锁词条有资格进入升级池。解锁时显示 `Lv.1` 并开始按冷却放车，之后任一装甲车强化词条使技能等级 `+1`。
- 车辆每轮数量正确、从防线前有效范围随机出发、向上行驶直至离屏；同一目标受多段低伤害但不会每帧暴涨，减速和眩晕时长准确，尺寸强化同步改变绘制与碰撞范围。
- 车辆碰上普通分裂僵尸/精英时，击杀能触发正确子体；眩晕中的精英仍能回血但不能移动或攻击；车辆与温压弹、干冰弹、步枪燃烧/冰冻同时存在时效果不互相误覆盖。
- 三个技能槽在锁定、单个解锁、全部解锁以及多位数 `Lv.N` 状态下均可辨认；升级池与技能图鉴分页、返回交互正常。

### 四、实施顺序与验证安排

1. 完成敌人静态数据、统一分裂/回血逻辑和子体生成；用 `node -e` 冒烟验证四种敌人及多伤害来源的死亡行为。
2. 接入第一关波次、双头/单头 Canvas 模型及图鉴；手动玩到第 4 波核对只出现一只波次精英，并验证分裂后清波与首领结算。
3. 增加装甲车默认值、解锁及五种词条；验证词条池过滤和升级计数，再实现车辆更新、重复碰撞与眩晕/减速。
4. 完成装甲车绘制、第三技能槽和图鉴说明；模拟多车、密集敌人、重开/退出与跨波次场景检查清理和性能。
5. 实际实现后更新 `README.md`（已实现内容与限制）、`DEVELOPMENT_PLAN.md`（技能/敌人规则与验收记录）及 `AGENTS.md` 中“两技能槽”和“未实装”的旧表述，并在本日志记录最终数值与完成结果。

实现阶段的基础校验：

```powershell
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

阶段 B 已按上述验收方向完成代码接入和基础冒烟验证；浏览器内的视觉体验、密集尸潮平衡与长时间性能仍需后续人工试玩确认。

---

## 2026-09-29 · 第二关「地铁入口」已实现

本方案已实现并验证。实现结果：

- **通关判定（两关统一）**：移除 `Game.killEnemy` 中首领死亡直接通关；改为 `Game.gainXp` 升到 `maxLevel` 时调用 `Game.winLevel()`；末波清空残余后由 `update.js` 兜底调用 `Game.winLevel()`。首领击杀不再结束关卡。
- **波次按关卡存储**：`config.js` 用 `levelOneWaves`/`levelTwoWaves` 定义，写入 `levels[].waves`；`Game.reset` 将当前关波次存入 `S.session.waves`，`update.js` 与 `render.js`（HUD 波次）统一读取 `session.waves`。
- **经验校准**：新增 `levels[].xpScale`，在 `Game.gainXp` 中缩放获得经验；模拟整局校准后第 1 关取 `1.76`、第 2 关取 `0.63`，两关击杀全部敌人后经验均达到满级所需的 1735 点。
- **关卡解锁**：新增 `Game.isLevelUnlocked`/`isLevelCompleted`/`markLevelComplete`/`getLatestUnlockedLevel`/`winLevel`；进度写入 `localStorage`（键 `blockline.progress`），并带会话内内存回退。选关界面按动态解锁渲染，菜单“开始战斗”进入最新已解锁关卡。
- **第 2 关内容**：10 波，小怪普通/快跑/分裂，第 4 波快跑僵尸精英，第 7 波首领；总量约 258 只。
- **验证**：`node --check` 全量通过；冒烟覆盖波次隔离、解锁流程、满级通关、首领不直接通关、清场兜底、失败路径、HUD/选关/结算渲染与选关/菜单点击；整局模拟第 1 关在第 5 波满级通关、第 2 关在第 10 波满级通关，均达 10 级。

### 原始方案（已按上述结果实施）

### 一、需求与现状差距

- 需求：第 2 关共 **10 个波次**；小怪为**分裂僵尸、普通僵尸、快跑僵尸**；精英为**快跑僵尸精英**（`runnerElite`，按既有精英规则登场）。
- 现状差距（本次必须先解决的结构问题）：
  1. `C.waves` 是全局单一波次表，所有关卡共用；`update.js`（生成、推进、胜利判定）与 `render.js`（HUD 波次显示）直接引用它。
  2. `C.levels` 只有静态 `unlocked` 标志，第 2、3 关恒为 `false`，**没有任何解锁机制**（不通关就永远无法进入）。
  3. `input.js` 选关界面点击区硬编码只响应第 1 关（`if (point.y >= 180 && point.y <= 262) Game.start(1)`）。
  4. `Game.start` 只校验静态 `level.unlocked`；菜单“开始战斗”按钮也硬编码 `Game.start(1)`。
  5. 通关判定需要改造：当前为“击杀首领直接通关”（`Game.killEnemy`）与“清完所有波次通关”（`update.js`）两条路径，需按用户要求改为“升到满级才通关”，两关统一。
- 已具备的条件：分裂/普通/快跑三种小怪与快跑精英的敌人配置、模型、图鉴均已存在，第 2 关**不需要新增敌人**，只需要按关卡配置波次与解锁。

### 二、待确认的决策点

| 编号 | 决策点 | 默认方案 | 备注 |
| --- | --- | --- | --- |
| D1 | 首领位置（通关判定已改为“升到满级”，首领不再与通关绑定） | **沿用既有规则：首领放第 7 波** | `Game.killEnemy` 中“击杀首领立即通关”的分支将被移除（见第三节），因此首领放第 7 波或第 10 波都不影响通关；默认遵循“首领固定第 7 波”的规则，若希望终局更集中可选第 10 波。 |
| D2 | 精英出现次数：现有规则“第 4 波每局 1 只” | **遵循规则：仅第 4 波 1 只 `runnerElite`** | 10 波偏长，若实测后段太单调，可评估第 8、9 波追加精英；但这会改动既有规则，默认不做。 |
| D3 | 通关第 2 关后第 3 关是否解锁 | 第 3 关有内容后（见第九节）**通关第 2 关即解锁第 3 关**；实现第 3 关前先保持锁定 | 第 3 关内容已纳入本轮计划。 |
| D4 | 解锁进度是否持久化 | **用 `localStorage` 持久化**（如 `blockline.progress`），无存档时按会话内状态 | 若不想引入本地存储，可改为仅会话内解锁；默认持久化体验更好。 |

### 三、通关判定改造（两关统一，优先实现）

用户确认：**不是击杀首领通关，而是经验条满（升到满级）才通关**；打完最后一波后不再出现新怪物，等场上所有敌人被击杀后结算；经验条要按敌人数量设计，使本关全部小怪、精英、首领被击杀后经验刚好达到满级。

- 判定实现：
  1. 移除 `Game.killEnemy` 中首领死亡时置 `S.screen = "victory"` 的分支；首领按普通敌人正常结算击杀与经验。
  2. 在 `Game.gainXp` / 升级流程中，玩家等级达到 `C.maxLevel` 时置 `S.screen = "victory"`（经验条填满即通关）。
  3. 波次侧：所有波次投放完毕后不再生成新敌人；保留“投放完毕且场上敌人清空”作为兜底完成条件，避免经验不足时卡关；正常情况下它与满级同时达成。
  4. 对齐文案：`S.session.message`、结算界面与 HUD 的“LV.MAX · 经验已满”统一表达“通关”。
- **经验预算必须精确**：当前曲线从 1 级升到 10 级累计需要 **1735 XP**（各级 `nextXp` 依次为 50、71、96、127、164、210、266、334、417）。设计上应让“本关全部小怪 + 精英 + 首领（含分裂幼体）的总经验 ≈ 1735”，使击杀最后一个敌人时刚好满级并通关；总量偏高会提前通关，偏低则清场后仍未满级。
- 实现建议：给 `C.levels[]` 增加**每关经验系数** `xpScale`（默认 1），在 `Game.gainXp` 中按当前关卡缩放获得经验；这样无需改动敌人全局 `xp` 即可把两关总量都校准到 1735。或者直接调整各关波次 `total`，二选一。
- 两关自然经验估算（未缩放，含分裂幼体）：
  - 第 1 关（现有 5 波）约 **1000–1100 XP**，低于 1735，需上调（约 ×1.6，或提高波次数量）。
  - 第 2 关（下方 10 波）约 **2800–3000 XP**，高于 1735，需下调（约 ×0.6，或降低波次数量）。
  - 精确数值在实现时核算到 1735 并在体验中复测。

### 四、结构调整计划（先于内容）

1. **波次按关卡存储**：在 `config.js` 中把 `waves` 移到关卡维度，例如 `C.levelWaves = { 1: [...现有 5 波...], 2: [...10 波...] }`（或在每个 `levels` 条目加 `waves` 字段）。保留 `C.waves` 作为第 1 关别名以兼容旧引用，逐步迁移。
2. **统一取波接口**：新增 `Game.getLevelWaves(levelId)`；`Game.reset`/`Game.start` 把当前关卡的波次存入 `S.session.waves`；之后 `update.js`（`spawnWaveEnemy`、主更新、胜利判定）与 `render.js`（HUD“第 N / M 波”）一律读 `S.session.waves`，不再直接读 `C.waves`。（最终未采用 `Game.getLevelWaves`：波次直接用 `config.levels[].waves`，由 `Game.reset` 存入 `S.session.waves`。）
3. **解锁机制**：新增 `Game.isLevelUnlocked(id)` = 静态 `unlocked: true` 或 `localStorage` 记录“前一关已通关”；第 1 关胜利时写入解锁记录。`Game.start` 改用该动态判断。
4. **输入泛化**：选关界面按 `C.levels` 遍历生成点击区，点击已解锁关卡调用 `Game.start(level.id)`；菜单“开始战斗”改为进入**当前已解锁的最新一关**（或仍固定第 1 关，待确认，默认最新已解锁）。
5. **HUD/结算**：波次显示来自当前关卡 `waves.length`；胜利结算追加“已解锁第 3 关（待开放）”之类的提示（按 D3）。

### 五、第 2 关 10 波设计（首轮平衡建议，非最终数值）

> 沿用现有波次字段：`total`（本波数量）、`interval`（生成间隔）、`mix`（小怪类型池）、`elite`/`elitePool`（精英）、`boss: true`（首领波）。第 4 波固定 1 只精英，其余波次不带精英字段。小怪类型只允许 `normal`、`runner`、`splitter`。

| 波次 | total | interval | mix | 特殊 | 设计意图 |
| --- | --- | --- | --- | --- | --- |
| 1 | 12 | .72 | normal | — | 热身，复习自动索敌 |
| 2 | 16 | .68 | normal, runner | — | 引入快跑，考验射速 |
| 3 | 20 | .64 | normal, runner, splitter | — | 引入分裂，考验齐射/穿透 |
| 4 | 24 | .60 | normal, runner, splitter | elite: `runnerElite` | 固定 1 只精英（遵循规则） |
| 5 | 26 | .58 | splitter, runner | — | 分裂+快跑混合压制 |
| 6 | 28 | .56 | normal, splitter, runner | — | 密度上升 |
| 7 | 30 | .54 | runner, splitter | boss: true | 高机动波次 + 首领（按 D1） |
| 8 | 32 | .52 | normal, runner, splitter | — | 高密度 |
| 9 | 34 | .50 | runner, splitter, runner | — | 进一步提升快跑比例 |
| 10 | 36 | .48 | normal, runner, splitter | — | 终局波次，之后不再刷怪 |

- **总量与节奏**：总投放约 258 只，从第 1 关约 104 只提升到约 2.5 倍；生成间隔从 .72 逐步压到 .48。第 10 波打完后不再生成新敌人，清空残余（含分裂幼体）后结算。
- **经验预算**：自然总量约 2800–3000 XP，高于满级所需的 1735 XP；需通过第三节的 `xpScale` 或减少波次 `total` 精确下调，使“清空全部敌人”与“刚好满级通关”同时发生。分裂幼体的经验（每只 3）必须计入预算。
- **城墙压力**：城墙耐久仍为 260，10 波攻击频次更高，属于主要平衡风险；实测后若压力过大，可上调 `wall.maxHp`、缩短后段 `interval` 或降低个别波次 `total`。
- **数值均放入 `config`**，不写死在逻辑层；分裂幼体仍由父体死亡分裂产生，不占 `total`。

### 六、界面与图鉴

- **选关界面**：第 2 关解锁后显示可进入；点击区支持全部 3 张卡片；可加“已通关”角标（可选）。
- **HUD**：显示“第 N / 10 波”，数值来自当前关卡波次长度；满级时“LV.MAX · 经验已满”与通关语义一致。
- **结算**：复用现有胜利/失败结算；胜利后按 D3 提示第 3 关状态。
- **图鉴**：无需新增敌人；确认分裂幼体保持 `codexHidden` 不进图鉴即可。

### 七、验收标准

- **通关判定（两关统一）**：升到满级即通关；击杀首领不再直接通关；打完末波后停止刷怪，清空残余后结算。
- **经验校准**：第 1、2 关各自“全部小怪 + 精英 + 首领 + 分裂幼体”的总经验都校准到约 1735，使清场与满级同时发生；不允许明显提前或滞后。
- **第 1 关回归**：迁移后第 1 关仍为 5 波、第 4 波精英、第 5 波首领，且改为满级通关后仍能正常胜利/失败/重开。
- **解锁**：未通关时第 2 关不可进入且显示锁定；通关第 1 关后第 2 关解锁（刷新页面后仍解锁，若采用持久化）。
- **第 2 关**：恰好 10 波；波次小怪只包含分裂/普通/快跑；第 4 波恰好 1 只快跑精英；首领按 D1 位置出现且每局 1 只；清空末波全部敌人并满级时正确判定胜利。
- **HUD**：显示“第 N / 10 波”。
- **分裂**：分裂幼体正常生成且不阻碍清波；`pendingSpawns` 不影响波次推进与胜负。
- **基础校验**：`node --check` 全量通过、`git diff --check` 通过、`node -e` 冒烟覆盖“双关波次隔离、解锁判断、满级通关触发、10 波清场、第 4 波精英数量、经验总量≈1735”。

### 八、实施顺序

1. 通关判定：移除首领直接通关分支 + 满级触发 victory + 末波停止刷怪与清场结算；先回归第 1 关。
2. 结构：波次按关卡存储 + `getLevelWaves` + 引用点迁移。
3. 经验校准：加入每关 `xpScale`（或调整 `total`），把两关总量校准到 1735，冒烟核算。
4. 解锁：`isLevelUnlocked` + `localStorage` + 选关点击泛化 + 菜单“开始战斗”目标；解锁流程冒烟。
5. 内容：填入第 2 关 10 波配置；整局模拟（高伤害桩）验证满级通关、10 波清场、第 4 波精英、胜负与波次推进。
6. 平衡：实测城墙压力与升级节奏，微调 `total/interval/xpScale/wall.maxHp`。
7. 文档：更新 `README.md`（已实现、限制）、`DEVELOPMENT_PLAN.md`（通关规则修订、关卡 2 设计、验收记录）、`AGENTS.md`（“满级通关”“第 2 关已开放”），并在本日志补记最终结果。

---

## 2026-09-29 · 战斗 UI 自适应高度

- 画布铺满浏览器高度：`styles/main.css` 的 `#game-shell` 改为 `width: min(100vw, 30rem)`，高度 `clamp(width*1.7778, 100vh, width*2.6667)`，在保持无拉伸的前提下尽量拉长。
- 逻辑高度自适应：`render.js` 的 `resizeCanvas` 按画布显示比例把 `C.height` 重算为 `width * 显示高 / 显示宽` 并夹在 640–960；`state.js` 新增 `Game.layoutWorld`，按 `C.height` 重排城墙（`-125`）与人物（`-58`），窗口缩放时自动调用。
- 顶部 HUD 紧凑化：面板高度 86→60，暂停按钮 32→28，经验条、弹药、技能槽同步上移缩小；消息与 Boss 提示下移，减少遮挡。
- 移除 HUD 黑色底板：不再绘制顶部面板，仅保留暂停按钮、文字（加阴影）、经验条与技能槽，避免遮挡战场；首页删除“当前开放：第 1 关”文案。
- 验证：逻辑高度 675 下第 1、2 关仍满级通关，全部界面渲染无异常，`node --check` 与 `git diff --check` 通过。

## 2026-09-29 · 结算按钮与分裂表现修复

- 结算界面（胜利/失败）新增“返回首页”按钮：`render.js` 的 `drawResult` 改为“重新开始 + 返回首页”双按钮，`input.js` 增加对应点击区（重新开始 42–172、返回首页 188–318，y 305–349）。
- 修复分裂幼体不显示的 bug：`Game.queueSplitSpawns` 误用实例上的 `enemy.radius`（实例没有该属性，取自 `C.enemies[type].radius`），导致子体横坐标为 `NaN`、绘制到画布外而不可见。改用 `C.enemies[enemy.type].radius` 计算间距后，子体坐标正常（本体 x 两侧各偏一段距离）。
- 分裂僵尸击杀表现增强：`Game.killEnemy` 在分裂时显示“分裂 ×N”浮字并保留紫色粒子，便于确认分裂已触发。
- 回归验证：整局模拟中分裂僵尸本体数量与幼体数量严格为 1:2，且所有分裂子体坐标均为有限值；第 1、2 关仍分别在满级时通关；`node --check` 与 `git diff --check` 通过。

## 2026-09-29 · 第三关「封锁工厂」已实现

本方案已实现并验证（实现结果见本节末）。除以下差异外，波次数量、通关判定、解锁机制、图鉴、结算等**全部沿用第 2 关的做法**。

### 一、需求

- 第 3 关「封锁工厂」，与第 2 关同样为 **10 个波次**。
- 小怪与第 2 关相同：**分裂僵尸、普通僵尸、快跑僵尸**。
- 精英换为 **分裂僵尸精英**（`splitterElite`），替换第 2 关的快跑精英；第 4 波固定 1 只。
- **怪物数量与血量相比第 2 关提升**；伤害、移速、经验、回血等其余数值保持不变。
- 原 `DEVELOPMENT_PLAN.md` 中第 3 关的“投掷僵尸 / 完整 Boss 战”本次**不做**，敌人与首领与第 2 关保持一致；投掷僵尸留待后续单独规划。

### 二、结构新增：每关血量系数

- 敌人 `hp` 目前是全局配置、各关共用；要让第 3 关更硬，需在 `C.levels[]` 增加 `hpScale`（默认 1），在 `Game.spawnEnemy` 中按 `hp = maxHp = Math.round(info.hp * hpScale)` 生成。
- `hpScale` 只影响生命，不改 `damage`、`speed`、`xp`、`regenPerSecond`（“其他保持不变”）。
- 第 1、2 关 `hpScale` 保持 1，保证前两关回归不变。
- 与第 2 关的 `xpScale` 同属“每关缩放”机制，实现时可一并设计（见第三节通关判定改造）。

### 三、10 波设计（首轮平衡建议，非最终数值）

| 波次 | total | interval | mix | 特殊 | 对比第 2 关 |
| --- | --- | --- | --- | --- | --- |
| 1 | 16 | .66 | normal | — | +4 |
| 2 | 20 | .62 | normal, runner | — | +4 |
| 3 | 26 | .58 | normal, runner, splitter | — | +6 |
| 4 | 30 | .55 | normal, runner, splitter | elite: `splitterElite` | +6，精英换成分裂精英 |
| 5 | 34 | .52 | splitter, runner | — | +8 |
| 6 | 38 | .50 | normal, splitter, runner | — | +10 |
| 7 | 42 | .48 | runner, splitter | boss: true | +12，含首领 |
| 8 | 46 | .46 | normal, runner, splitter | — | +14 |
| 9 | 50 | .45 | runner, splitter, runner | — | +16 |
| 10 | 56 | .42 | normal, runner, splitter | — | +20，之后不再刷怪 |

- 总投放约 **358 只**（第 2 关约 258 只，约 ×1.39）；生成间隔从 .66 压到 .42，整体更密。
- 第 10 波打完后不再生成新敌人，清空残余（含分裂幼体）后结算。

### 四、血量提升

- 建议第 3 关 `hpScale ≈ 1.35`，示例：普通 28→38、快跑 16→22、分裂 60→81、分裂僵尸精英 620→837、首领 3000→4050。
- 精英换成 `splitterElite` 后自带持续回血与死亡分裂，实际难度提升会高于纯血量系数；若实测过难，优先下调 `hpScale` 或精英 `regenPerSecond`，而不是改动伤害/速度。

### 五、经验校准

- 第 3 关敌人更多，自然经验约 **4000+ XP**，需下调 `xpScale`（约 0.42–0.45）使总量仍 ≈ 1735，保证“清场即满级通关”。
- 敌人更肉但每只经验不变，升级会更慢；若体验不佳，可评估提高第 3 关敌人 `xp`（这属于“其他保持不变”的例外，需确认后调整）。默认仅调 `xpScale`。

### 六、解锁

- 实现第 3 关后，通关第 2 关即解锁第 3 关；在实现前第 3 关保持锁定（已更新第 2 关计划的 D3）。
- `Game.isLevelUnlocked` 依 `localStorage` 记录逐关解锁；选关界面显示第 3 关可进入与“已通关”状态。

### 七、验收标准

- 第 3 关恰好 10 波；波次小怪只包含分裂/普通/快跑；第 4 波恰好 1 只**分裂僵尸精英**；首领每局 1 只。
- 第 3 关敌人血量约为第 2 关的 1.35 倍，数量约 1.39 倍；伤害、速度、经验数值与第 2 关一致。
- 末波清场与满级双条件结算正常；经验总量校准到约 1735。
- 第 1、2 关不受 `hpScale` 影响，回归不变。
- 基础校验：`node --check` 全量通过、`git diff --check` 通过、`node -e` 冒烟覆盖“三关波次隔离、hpScale 生效且前两关为 1、第 3 关第 4 波精英类型、满级通关”。

### 八、实施顺序

1. 在第 2 关完成后实现：加 `levels[].hpScale` 并在 `spawnEnemy` 应用，先确认第 1、2 关血量不变。
2. 填入第 3 关 10 波配置与 `hpScale`、`xpScale`；整局模拟核对数量、血量，以及“末波清场 + 满级”双条件结算。
3. 解锁第 3 关并更新选关界面状态。
4. 平衡实测（城墙压力、升级节奏），微调 `total/interval/hpScale/xpScale`。
5. 文档同步 `README.md`、`DEVELOPMENT_PLAN.md`、`AGENTS.md`，并在本日志补记结果。

### 实现结果

- `config.js` 新增 `levelThreeWaves`（10 波、总计 358 只，第 4 波 `elite: "splitterElite"`、第 7 波 `boss: true`）；`levels[2]` 填入 `hpScale: 1.35`、`xpScale: 0.43` 与波次，第 1、2 关补 `hpScale: 1`。
- `state.js` 的 `Game.reset` 把 `levels[].hpScale` 存入 `S.session.hpScale`（默认 1）。
- `combat.js` 的 `Game.spawnEnemy` 改为 `hp = maxHp = Math.round(info.hp * hpScale)`，只影响生命；分裂幼体、精英、首领同样按当前关缩放。
- 经验校准：第 3 关自然总量期望约 4092 XP，`xpScale 0.43` 后约 1760，略高于满级所需的 1735，正常清场即满级；不足时由 `Game.grantMaxLevel` 兜底。
- 血量示例（×1.35 四舍五入）：普通 28→38、快跑 16→22、分裂 60→81、分裂幼体 18→24、分裂僵尸精英 620→837、精英幼体 100→135、首领 3000→4050。
- 验证：`node --check` 全量通过；`git diff --check` 通过；一次性冒烟脚本 **196 项断言全过**，覆盖第 3 关 10 波与总量 358、波次小怪仅普通/快跑/分裂、第 4 波恰好 1 只分裂精英且血量 ×1.35、第 1/2 关血量不变、第 3 关整局在末波清场时满级通关，以及此前的清场胜利、首领同场、分裂幼体、失败优先等场景。

---

## 2026-09-29 · 清场后胜利与首领波混合刷怪（TEMP_CHANGE_PLAN.md 已实施）

按 `TEMP_CHANGE_PLAN.md` 落地，两项需求：

### 一、满级不再立即胜利

- `combat.js` 的 `Game.gainXp` 升到 `maxLevel` 时不再调用 `Game.winLevel()`，只把 `p.xp` 补到 `p.nextXp`（经验条满格）并提示「LV.MAX · 清空剩余尸潮」；继续战斗、不再弹升级词条。
- 新增 `Game.grantMaxLevel()`：从当前等级直接补足到满级，仅在末波已清空但经验不足时由 `update.js` 调用，避免场上无怪可打的软锁。
- `update.js` 的结算改到 `Game.flushPendingSpawns()` 之后统一判定，同时要求：`spawnCount >= plan.total`、`S.enemies.length === 0`、`S.pendingSpawns.length === 0`、首领波的 `bossSpawned` 为真；满足后若是末波才补足经验并 `Game.winLevel()`，否则推进下一波。
- `state.js` 的 `Game.winLevel` 加 `screen === "playing"` 守卫（失败优先），仍作为唯一的结算与解锁入口；新增 `Game.getRemainingEnemyCount()` 统计「已生成 + 待生成分裂体 + 未投放名额 + 未登场首领」。
- `render.js` 的 HUD 满级文案改为「LV.MAX · 剩余 N」，明确满级只是经验完成、不等于清场。

### 二、第 7 波首领与小怪同场

- `update.js` 首领登场条件由 `spawnCount >= plan.total && 场上非首领 < 8` 改为 `spawnCount >= Math.floor(plan.total / 2)`，移除人数限制；`bossSpawned` 保证每局 1 只。
- `plan.total` 仍只计常规名额：第 2 关第 7 波共 30 只常规小怪 + 1 只首领，首领登场后小怪继续按原 `mix`/`interval` 投放；第 1 关第 5 波同样处理。
- `render.js` 调整 HUD 绘制顺序：先画首领徽章与血条，再画波次消息，且有首领时消息下移到 y126，避免「尸潮领主出现！」压住血条。

### 三、验证

- 一次性冒烟脚本 156 项断言全部通过，覆盖：满级后跑完整关、提前满级不在前几波胜利、第 7 波首领半程登场且小怪继续投放、首领先死与后死两种顺序的清波推进、分裂本体满级后仍须清幼体、满级后城墙失守仍判失败且不解锁、末波清场经验不足时补满级再结算、两关正常整局通关（各 8 次升级）、剩余敌人数统计。
- `Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }` 全量通过；`git diff --check` 通过（仅 LF/CRLF 提示）。
- `render.js` HUD 与结算渲染冒烟通过。

---

## 2026-09-29 · 收窄齐射扇面

- `config.spreadAngle` 由 `0.2` 调整为 `0.12` 弧度：步枪齐射与干冰弹齐射共用该值，两者相邻弹道/弹丸角度间隔同步收窄（满级 4 条弹道时扇面由约 34° 收窄到约 21°），自动索敌与锁定弹道的逻辑不变。
- 同步更新 `config.js` 齐射词条说明、`README.md`、`DEVELOPMENT_PLAN.md`、`AGENTS.md` 中「0.2 弧度」的表述。
- 验证：`node --check` 全量通过；`git diff --check` 通过。

---

## 2026-10-02 · 放缓前期尸潮并降低升级门槛

- 第 2 关前 3 波生成间隔调整为 1.2/1.1/1 秒；第 3 关调整为 1.6/1.45/1.3 秒；第 1 关保持不变。
- 初始升级门槛从 50 XP 降至 35 XP；沿用每级 `floor(nextXp * 1.22 + 10)` 的递增规则，升到 10 级累计需求从 1735 降至 1382 XP。
- 各关 `xpScale` 暂未重调，当前经验缩放按旧门槛设计，可能会早于末波清场达到满级。

---

## 2026-10-03 · 降低敌人移速并提高基础伤害

- 所有基础僵尸、分裂幼体、精英和首领的移动速度约降低 20%。
- 人物基础步枪伤害从 18 提升至 28，使第 1、2 关普通僵尸可被基础单发击杀；第 3 关普通僵尸仍需多次命中。
- 验证：`node --check` 全量通过；`git diff --check` 通过。

---

## 2026-10-03 · 实装空投轰炸

- 新增需通过局内词条解锁的空投轰炸核心技能。点击 HUD 技能槽后点选战场落点；冷却 16 秒，炸弹自屏幕上方落下并造成范围伤害与击退。
- 新增轰炸增伤、连续轰炸、轰炸扩张、轰炸震荡、精准打击、热核轰炸六种强化；额外炸弹依次轰击原落点，热核区域持续伤害并减速。
- HUD 扩展为四个技能槽；新增炸弹、持续区域与选区状态在 `Game.reset` 时清理，技能状态同步进入词条池和技能图鉴。
- 验证：`node --check` 全量通过；`git diff --check` 通过；一次性冒烟覆盖解锁、HUD 点选落点、冷却、额外炸弹、中心增伤、眩晕、击退、热核区域伤害/减速、Canvas 绘制与重开清理。

---

## 2026-10-03 · 空投轰炸改为自动索敌

- 移除手动选择落点流程；技能解锁后冷却就绪且场上有敌人时自动释放。
- 按炸弹预计落地时的敌人位置评估轰炸区域，优先选择可覆盖更多普通敌人、精英和首领的位置；连续轰炸仍依次落在该区域。
- 更新技能词条说明、README、开发计划和 AGENTS.md；技能槽仅显示技能等级与冷却状态。
- 验证：全部 JavaScript 语法检查与 `git diff --check` 通过；一次性冒烟确认无敌人时不空放、自动优先选择密集目标、冷却期间不重复触发，且额外炸弹数量正常。

---

## 2026-10-03 · HUD 显示关卡编号

- 战斗 HUD 关卡标题调整为“关卡数字 关卡名称”，例如“3 封锁工厂”。

---

## 2026-10-16 · 账户与数据层（全栈）

- 项目从纯前端单机扩展为全栈：新增 `server/`（FastAPI + SQLAlchemy + SQLite，Python 3.13 的 `.venv`）承载账户、登录会话、关卡进度与每关统计；前端新增 `src/accounts.js` 作为账户数据的唯一入口（内存缓存 + 异步落库），游戏本体仍是零依赖原生 JS。
- 数据库 `data/blockline.db`：`accounts` / `sessions` / `level_progress`（`completed_at`、`best_time`、`best_kills`、`attempts`、`wins`）/ `resources` / `schema_version`；连接统一 `foreign_keys=ON`、WAL、`busy_timeout`。密码用 PBKDF2-SHA256（20 万次迭代 + 16 字节随机盐）哈希，会话 token 只以 sha256 存库、经 HttpOnly + SameSite=Strict Cookie 下发，30 天有效期并滑动续期。
- 接口：`/api/health`、`/api/auth/{register,login,logout}`、`/api/me`、`/api/me/progress`、`/api/me/resources`、`DELETE /api/me`；统一 `{"error":{"code","message"}}` 错误体，写接口校验同源。
- 界面：菜单底部新增「账户：未登录 / 用户名」按钮（菜单几何收进 `config.menu`）；新增登录 / 注册界面与账户中心（用户名、注册时间、通关进度、最近 5 关最佳用时与击杀、资源占位、导入旧进度 / 注销 / 删除账户），表单由 `#account-dialog` DOM 浮层承载；菜单、关卡选择与结算界面显示状态横幅，结算界面标注成绩是否已保存。
- 进度写入从 localStorage 改为账户层：`Game.winLevel` 与失守统一走 `Game.reportRun` / `Game.loseLevel`，通关与失败都会上报（失败只累加尝试次数）；未登录 / 离线时成绩只存在于本次会话、刷新即失效，旧键 `blockline.progress` 仅作为「导入旧进度」的一次性来源。
- 验证：数据层 35 项、接口 45 项、前端账户层 111 项断言全部通过；`tmp/` 下 34 个回归脚本全部通过；画面用 `tmp/trace-draw.js account <界面>` + `tmp/replay-draw.py` 出图核对；真实服务在 `127.0.0.1:8787` 起服后 `/api/health` 为 200，而 `data/` 与 `server/` 下的文件返回 404。

---

## 2026-10-17 · 角色属性系统（第一阶段）

- 新增 `src/attributes.js`（`Game.attributes`）：基础值 + 外部修正，`setModifiers` / `clearModifiers` / `applyPlayer` / `applyWall` / `get` 等接口；`Game.reset` 开局应用，测试场 9999 城墙不被覆盖，测试场「清空构筑」保留属性加成。
- 属性改为：攻击力 100（数值、无上限）、六系攻击力各 100（数值、无上限）、防线血量 1000、暴击率 8%、暴击伤害 150%、冷却缩减 0%（上限 50%）、负面时间 100%（上限 200%）；后续装备直接加数字。
- 伤害结算：护甲格挡 → 攻击倍率 → 元素倍率 → 敌人属性抗性 → 致残易伤；燃烧/冻伤按攻击力与火/冰倍率缩放 DPS，时长乘负面时间；三种硬控、减速与重伤同样吃负面时间。冷却缩减只作用于技能冷却，暴击仍只作用于步枪。
- 首页重排：左上角圆形账户按钮；中间从上到下为标题、开始战斗、选择关卡、进入测试场；底部从左到右为属性面板、技能图鉴、僵尸图鉴；账户横幅移到圆钮右侧并限制宽度。新增只读属性面板，攻击力与六系显示纯数字。
- 验证：新增 `tmp/check-attributes.js` **109 项**断言通过；`tmp/check-accounts.js` 修复回退遗留引用后 **117 项**通过；35 个 `check-*.js`、`tmp/smoke-whirlwind.js`、`node --check`、`git diff --check` 全部通过；数据层 `check_db.py` **36 项**、接口 `check_api.py` **46 项**也按当前 schema 重新通过；画面用 `tmp/trace-draw.js account menu|attributes` + `tmp/replay-draw.py` 出图核对（`tmp/menu-attributes.png`、`tmp/attributes-screen.png`）。
- 本轮不修改 `server/`、数据库 schema、资源产出与账号存档；装备与属性持久化留给下一阶段。

---

## 2026-10-18 · 装备系统（六部位 · 100 级）

- 新增 `equipment` 表与 `server/app/equipment.py`：六部位（手臂 / 衣服 / 头盔 / 裤子 / 鞋子 / 手套）各一件，首次创建时六系洗牌随机、之后元素固定；等级 Lv.1～100，攻击与元素均为 `10 + 5 × (level - 1)`；`schema_version` 升到 2，旧库由 `create_all()` 补建表并在 `/api/me` 补齐装备。
- 新增 `POST /api/me/equipment/upgrade`：服务端校验部位、满级与材料，扣除金币 + 部位专属图纸并升级。金币 `80 + 40 × (当前等级 - 1)`，图纸 `10 × 当前等级`（Lv.1→2 为 80 + 10，Lv.99→100 为 4000 + 990）；`nextCost` 由服务端返回，前端不重复维护价格。
- 新增 `src/equipment.js`（`Game.equipment`）：六件装备的攻击求和、元素按属性分别求和后调用 `Game.attributes.setModifiers`，登录时应用、登出 / 401 时清空；账户层新增装备缓存、busy、错误与升级接口。
- 属性面板底部改为「装备 / 返回」双按钮；新增 2×3 装备卡片界面，显示等级 / 100、攻击、元素、金币与图纸消耗、强化按钮和状态提示；账户中心资源区改为 9 项网格（金币 / 宝石 / 零件 + 六种图纸）。本轮资源产出仍未接入，界面标注「产出待接入」。
- 验证：`tmp/check_db.py` 48 项、`tmp/check_api.py` 64 项、`tmp/check-equipment.js` 76 项、`tmp/check-accounts.js` 130 项全部通过；`check-attributes.js`、`smoke-whirlwind.js` 与既有脚本通过；`node --check`、`git diff --check`、`compileall` 通过；截图 `tmp/equipment-screen.png`、`tmp/account-screen.png`。

---

## 2026-10-19 · 城墙材料系统（钢材 / 稀土 · 200 级）

- 新增 `wall_state` 表与 `server/app/wall.py`：城墙 Lv.1～200，基础血量 1000、每级 +200（Lv.200 为 40,800）；`schema_version` 升到 3，旧库由 `create_all()` 补建表并在 `/api/me` 创建 Lv.1 状态。
- 新增 `POST /api/me/wall/upgrade`：`action: "level"` 消耗 `20 × 当前等级` 钢材并升级；`action: "breakthrough"` 只在 10/20/…/190 节点可用，第 N 次消耗 `2 × N` 稀土，**等级与血量不变**；Lv.200 封顶。错误码覆盖满级、未突破、未到节点、材料不足与非法操作。
- 新增资源 `steel` / `rareEarth`；`src/attributes.js` 增加独立的 `setWallHpBonus`，`src/wall.js` 汇总城墙血量并同步当前城墙（测试场 9999 跳过、战斗中按比例保留）；`src/accounts.js` 增加城墙缓存与 `upgradeWall` / `getWall`，登出 / 401 清空。
- 属性面板底部改为「装备 / 城墙 / 返回」三按钮；新增城墙界面（等级、血量、下一突破节点进度、单一动作卡、材料数量与状态提示）；账户中心资源区扩为 4 列 × 3 行、11 项资源。本轮钢材 / 稀土产出仍未接入，界面标注「产出待接入」。
- 城墙界面加入材料图标：钢材为灰白色长方体、稀土为金色圆锥，顶部资源行、动作卡与按钮统一复用；普通等级只显示「强化」，到达突破节点时同一张动作卡切换为「突破」，不再常驻不可用的突破按钮。
- 验证：`tmp/check_db.py` 62 项、`tmp/check_api.py` 88 项、`tmp/check-wall.js` 62 项、`tmp/check-accounts.js` 139 项、`tmp/check-equipment.js` 76 项全部通过；`check-attributes.js`、`check-wall-hp.js`、`smoke-whirlwind.js` 与既有脚本通过；`node --check`、`git diff --check`、`compileall` 通过；截图 `tmp/wall-screen.png`、`tmp/wall-normal-screen.png`、`tmp/account-screen.png`。

---

## 2026-10-19 · 装备宝石系统（6 部位 × 6 槽位）

- 新增 `gems` 表与 `server/app/gems.py`：`id` / `account_id` / `part_id` / `quality`（0～4）/ `affix_id` / `slot_index`（0～5 或 `NULL`），唯一约束 `(account_id, part_id, slot_index)`；`schema_version` 升到 **4**，旧库由 `create_all()` 自动补表，旧账户宝石为空。
- 六件装备各 6 槽，宝石按部位绑定；只有已镶嵌宝石提供属性。品质灰 / 绿 / 蓝 / 紫 / 红，每颗 1 条随机词条；攻击与元素 +10/+20/+30/+40/+50，冷却与暴击 +1%/+2%/+3%/+4%/+5%，暴伤与负面时间 +10%/+20%/+30%/+40%/+50%，防线血量 +200/+400/+600/+800/+1000。
- 新增 `/api/me/gems/socket`、`/unsocket`、`/synthesize` 与调试用 `/grant`；同部位同品质 5 颗**未镶嵌**宝石自动合成 1 颗高一档同部位宝石，词条重新随机，红色封顶；已镶嵌宝石不参与合成。
- 新增 `src/gems.js`（`Game.gems`）与 `src/attributes.js` 的独立 `setGemModifiers` / `clearGemModifiers`；宝石加成不能写进装备或城墙修正。`src/accounts.js` 增加宝石缓存与 socket / unsocket / synthesize，登出 / 401 清空。
- 属性面板底部改为「装备 / 宝石 / 城墙 / 返回」四按钮；新增宝石界面：六部位页签、六槽位、分页背包、品质切换合成栏、六边形宝石图标与状态提示。账户资源 `gem` 的显示名改为「钻石」，与新宝石系统区分。
- 本轮不做宝石正式产出；新账户宝石背包为空，只能用 `/api/me/gems/grant` 调试注入。
- 验证：`tmp/check_db.py` **88 项**、`tmp/check_api.py` **115 项**、`tmp/check-gems.js` **122 项**、`tmp/check-wall.js` **63 项**、`tmp/check-accounts.js` **147 项**、`tmp/check-equipment.js` **76 项**全部通过；38 个 `check-*.js` 全部通过；`node --check`、`git diff --check`、`compileall` 通过；截图 `tmp/gems-screen.png`。

---

## 2026-10-20 · 宝石锁定与一键合成确认

- 宝石改为**手动一键合成**：主界面保留「一键合成」按钮，点击后弹出确认窗口，按「部位 × 品质」分页列出全部可合成组（每组 5 颗未镶嵌宝石 → 1 颗高一档），点击任意宝石可在窗口下方预览该宝石词条；点「确定」一次合成全部组，点「取消」关闭且不发出请求。原品质左右切换与单组合成入口从界面移除，`/synthesize` 单组接口保留给旧测试。
- 新增宝石锁定：`gems` 表增加 `locked` 列，背包行右侧锁按钮可锁定 / 解锁，锁定宝石显示 🔒；一键合成的候选、预览与批量消耗都会跳过锁定宝石，锁定状态在镶嵌 / 卸下后保持。
- 新增 `POST /api/me/gems/synthesize-all` 与 `POST /api/me/gems/lock`；`server/app/gems.py` 增加合成计划、批量合成与锁定逻辑；旧库启动时由 `database.create_all()` 用 `ALTER TABLE` 补 `locked` 列，`SCHEMA_VERSION` 升到 **6**。
- 前端新增 `config.gemSynthesisUI` 弹窗几何与 `Game.getGemSynthesisPlan` / `drawGemSynthesis` / `toggleGemLock` / `synthesizeAllGems`；`Game.gems` 增加 `getSynthesisPlan`、`getSynthesisSummary`、`findGem`，合成计划只收未镶嵌且未锁定的宝石。
- 验证：`tmp/check_db.py` **142 项**、`tmp/check_api.py` **164 项**、`tmp/check-gems.js` **181 项**全部通过，39 个 `check-*.js` 全部通过；`node --check`、`git diff --check`、`compileall` 通过；真实库副本迁移后 `gems.locked` 列存在；截图 `tmp/gems-screen.png`（锁定标志）与 `tmp/gems-synthesis.png`（一键合成弹窗）。
---

## 2026-10-21 · 角色界面（角色大厅）

- 首页底部左侧入口由「属性面板」改为「角色」（`config.menu.buttons.character`），新增 `character` 界面：上半部分是 2 列 × 3 行的 62 × 62 正方形装备格，格内用 `drawEquipmentGlyph` 画出六个部位的装备图标（护臂 / 背心 / 头盔 / 长裤 / 靴子 / 手套）、部位名、元素圆点与 `Lv.N`，右侧信息列显示元素系、攻击与元素加成；中部为「装备强化 / 城墙强化」两个入口；下半部分是背包，最下方三个页签「宝石 / 装备 / 资源」。
- 点击装备方块弹出该部位**宝石浮层**：六行槽位从上往下固定排列（空槽也占行），显示品质、词条、🔒 与「卸下」按钮；「关闭」或点击浮层外收起。空槽行提示在下方宝石背包点击宝石镶嵌。
- 宝石页签跨部位列出账户全部未镶嵌宝石（`Game.gems.getBag()` 新增），行内可锁定、点击镶嵌，标题行右侧是 `‹ n/m ›` 分页与「一键合成」（复用原有确认浮层）；装备页签用新增的 `Game.equipment.getBagOverview()` 按部位显示等级、元素与背包元素计数；资源页签显示 11 项资源数量。
- **独立宝石界面移除**：删除 `config.gemUI`、`Game.drawGemsPanel`、`Game.openGems` / `selectGemPart` / `getGemPartTabRect` / `getGemSocketRect` / `getGemInventory*` / `getGemSynthesisButtonRect` 与 `S.gemPart` / `S.gemPage`；宝石操作的守卫改为 `screen === "character"`，合成确认浮层（`gemSynthesisUI` / `drawGemSynthesis`）保留复用。
- 属性面板退为**只读页**：`config.attributesUI` 只留面板与返回按钮，底部文案「返回角色」，`Game.backToCharacter` 统一回角色界面；装备界面与城墙界面的「返回」也改为回到角色界面。
- 新增 `config.characterUI`（面板、顶栏、装备格、强化入口、背包三种行布局、状态行、页签、宝石浮层）与一整套 `Game.getCharacter*Rect()` 几何接口，render 与 input 共用；新增状态 `S.characterPart` / `S.characterTab` / `S.characterGemPage` / `S.characterGems`，`Game.reset` 重置。
- 验证：新增 `tmp/check-character.js` **184 项**全部通过；`tmp/check-gems.js` 重写界面段后 **207 项**、`tmp/check-attributes.js`、`tmp/check-equipment.js` **109 项**、`tmp/check-wall.js` **61 项**、`tmp/check-accounts.js` **164 项**同步更新；全量 35 个 `check-*.js` 与 8 个 `audit-*.js` 0 失败；`node --check` 与 `git diff --check` 通过；出图 `tmp/character-screen.png`、`character-gems.png`、`character-equip.png`、`character-resource.png`、`character-guest.png`、`character-synth.png` 与 `attributes-screen.png`。后端未改动。
---

## 2026-10-22 · 资源方格与三角形宝石

- 资源页签改为**方格**：6 列 × 2 行、每格 44 × 44（`config.characterUI.resourceCells`），格内用新增的 `drawResourceIcon` 画对应图标 —— 金币（带内圈的硬币）、钻石（菱形）、零件（六齿齿轮）、钢材（复用 `drawSteelIcon` 金属锭）、稀土（复用 `drawRareEarthIcon` 金色圆锥）、六种图纸（同款卷纸 + 右上折角，按部位色区分）；数量写在格内右下角。
- **数量为 0 的资源不绘制**：新增 `Game.getCharacterResources()`（= `Game.accounts.getResourceList()` 过滤零值），全为 0 时只显示「暂无资源 · 关卡奖励会产出资源」；超过 12 项时状态行提示「共 N 项 · 仅显示前 12 项」。`Game.getCharacterResourceCellRect` 改为按 `size/gap/columns` 计算正方形格子。
- 宝石页签与装备页签也改为**方格**：宝石页签 6 列 × 2 行、每页 12 格（`config.characterUI.gemCells`），每格画三角宝石、词条名与数值、左上角部位短名，右上角 14 × 14 锁按钮（点格子镶嵌、点锁按钮锁定），标题行保留分页与一键合成；装备页签 3 列 × 2 行（`config.characterUI.equipCells`），每格画部位短名、元素圆点、装备图标、`Lv.N` 与背包件数。`Game.getCharacterBagRowRect` / `getCharacterBagLineRect` 与 `config.characterUI.bag` / `bagLines` 一并删除，改用 `getCharacterGemCellRect` / `getCharacterEquipCellRect`。
- 宝石图标由六边形改为**按品质着色的三角形**（灰 / 绿 / 蓝 / 紫 / 红，带顶面高光与左右切面），镶嵌浮层、背包方格与「一键合成」确认窗口共用同一份 `drawGemIcon`。
- 验证：`tmp/check-character.js` 184 → **193 项**（新增方格正方形与不重叠、零值资源隐藏、数量文案、无资源提示等断言）；`tmp/check-gems.js` 239 项通过；全量 35 个 `check-*.js` 与 8 个 `audit-*.js` 0 失败，`node --check` 与 `git diff --check` 通过；出图更新 `tmp/character-resource.png`、`tmp/character-screen.png`、`tmp/character-equip.png`、`tmp/character-guest.png`、`tmp/character-guest-equip.png`、`tmp/character-guest-resource.png`、`tmp/character-gems.png`、`tmp/character-synth.png`。后端未改动。

---

## 2026-10-22 · 宝石详情、同词条约束与装备替换

- 点击背包宝石不再直接镶嵌，先弹出**宝石详情**（`S.characterGemDetail`、`config.characterUI.gemDetail`）：品质与词条、所属部位、`槽位 · N / 6 · 状态`、提示行与「镶嵌」「关闭」两个按钮；点「镶嵌」才落位，成功后收起浮层并在状态行提示「宝石已镶嵌 / 已替换宝石」。
- 新增只读推演 `Game.gems.planSocket(gemId)`，返回 `place` / `replace` / `pick` / `blocked` / `socketed` / `missing` 六种模式，详情按钮文案与是否可点都由它决定。
- **同词条唯一**：同一部位同一条词条只能存在一颗 —— 同词条且品质不高于已镶嵌那颗时拒绝（`gem_affix_conflict`，提示「同词条宝石不可重复镶嵌，需要更高品质」）；更高品质直接替换那颗宝石所在的槽位（原宝石回背包），详情按钮显示「替换镶嵌」；槽位已满且词条不冲突时置 `S.characterGemReplace` 打开该部位宝石浮层的**替换模式**（副标题换成待镶嵌宝石、六行按钮变「替换」、点行带上 `slotIndex`、关闭即取消），不再有「槽位已满」死路。
- 服务端为权威实现：`gems.socket(db, account_id, gem_id, slot_index=None)` 先做同词条判定再决定目标槽位，替换前先把旧宝石的 `slot_index` 写空并 `flush`，避免 `uq_gem_socket` 唯一约束冲突；`/api/me/gems/socket` 新增可选 `slotIndex`，`/api/me/gems/grant` 新增可选 `affixId`（调试注入指定词条），两者都做了取值校验（`invalid_gem_slot` / `unknown_gem_affix`）。
- **装备页签提供替换**：点击 3 × 2 方格中的任一部位打开**装备替换浮层**（`S.characterEquipPart`、`config.characterUI.equipPanel`），用 `Game.equipment.getBagPart` 列出六种元素（当前装备 / 持有 N / 无可用）与「替换」按钮；点整格调用 `Game.replaceCharacterEquipment` → `equipEquipment`，成功后留在浮层并提示「已换装」，`Lv.N` 保持不变（换装只交换 `element_id`）。
- 新增 `config.characterUI.gemDetail` / `equipPanel` 与 `Game.getCharacterGemDetailPanel` / `getCharacterGemDetailSocketRect` / `getCharacterGemDetailCloseRect` / `getCharacterEquipPanel` / `getCharacterEquipRowRect` / `getCharacterEquipActionRect` / `getCharacterEquipCloseRect`；`openCharacter` / `backToCharacter` / `openAttributes` / `closeCharacterGems` / `setCharacterTab` 一并清空三个新浮层状态，`drawCharacter` 按「宝石浮层 → 装备替换 → 宝石详情 → 合成确认」叠加。
- 验证：`tmp/check-character.js` 193 → **246 项**（宝石详情只开浮层不发请求、点「镶嵌」才发请求、装备替换换元素不改等级、新浮层几何不重叠等）；`tmp/check-gems.js` 239 → **310 项**（同词条同品质拒绝、高品质直替、`planSocket` 四种模式、满槽选择替换的完整 UI、指定槽位与非法槽位）；`tmp/check_db.py` 142 → **153 项**、`tmp/check_api.py` 164 → **177 项**（`slotIndex` / `affixId`、同词条唯一、满槽替换、非法槽位与未知词条）；全量 35 个 `check-*.js` 与 8 个 `audit-*.js` 0 失败，`node --check`、`compileall` 与 `git diff --check` 通过；出图 `tmp/character-gem-detail.png`、`tmp/character-gem-replace.png`、`tmp/character-equip-replace.png`，并更新 `character-equip.png`。

---

## 2026-10-22 · 装备背包改为方格与装备详情

- 装备页签改为与宝石页签一致的 **6 列 × 2 行、每页 12 格**方格（`config.characterUI.equipCells` 改为 `{34,404,size 44,gap 4,columns 6,rows 2}`，与宝石方格同起点），按 `Game.equipment.getBagRows()` 逐件列出背包装备：格内是部位短名、装备图标与元素名，当前已装备的那件用绿框 + 右上绿点标出；新增 `config.characterUI.equipPager` 与 `Game.getCharacterEquipRows` / `getCharacterEquipPageCount` / `getCharacterEquipPage` / `setCharacterEquipPage` / `getCharacterEquipPagerRect`，超过 12 件时与宝石页签同一位置分页。
- 装备替换浮层改为**装备详情**（`S.characterEquipItem`、`config.characterUI.equipDetail`，与宝石详情同一版式）：只显示装备图标、`部位 · 元素系`、`Lv.N`、当前装备 / 可替换与「替换」「关闭」，不再显示六种元素、持有数量与副标题；已装备的条目按钮显示「已装备」且不发请求。换装仍走 `equipEquipment`（只交换 `element_id`，等级保留在部位），替换后同一条目会变成换下来的旧元素。
- 数据层把 `Game.equipment.getBagOverview()` 换成 `getBagRows()`（逐件输出部位名 / 短名 / 颜色、元素名 / 颜色、部位等级与是否当前装备，按「部位顺序 → id」排序），`getBagPart` 继续供装备背包界面按部位取六种元素。
- 验证：`tmp/check-character.js` **245 项**（装备方格 6 × 2 与宝石同起点、逐件详情、替换不改等级、已装备条目不再请求、超过 12 件分页）、`tmp/check-gems.js` **285 项**；全量 35 个 `check-*.js` 与 8 个 `audit-*.js` 0 失败，`node --check`、`smoke-character.js` 与 `git diff --check` 通过；出图更新 `tmp/character-equip.png` 与 `tmp/character-equip-replace.png`。后端未改动。

---

## 2026-10-23 · 炸弹僵尸与撞线爆炸

- 新增**炸弹僵尸**（110 血 / 移速 24 / 半径 17 / 撞击 11 / 20 经验）与**炸弹僵尸精英**（600 / 28 / 22 / 20 / 42）：两形态都**免疫眩晕**、额外承受 50% 火系伤害，并在生命低于 50% 时移速 ×1.5。
- 首次抵达城墙攻击线时引爆一次：小怪造成 **55 点**、精英造成 **110 点**防线伤害，并生成 `bomberBlast` 爆炸、粒子与伤害飘字；引爆标记 `wallExplosionTriggered` 保证整局只触发一次，随后按普通 1 秒节奏继续啃墙。爆炸可直接击穿城墙并进入失败结算。
- 低血加速数据化为 `speedBoostBelowHpRatio` / `speedBoostMultiplier`，实战移动、步枪与技能预判、空投覆盖和落点预判统一走新增的 `Game.getEnemySpeedMultiplier` / `Game.getEnemyMoveSpeed`；首领原有半血加速也改走同一接口，行为不变。
- 绘制新增 `drawBomberBomb`：炸弹举过头顶、引线火花随相位闪烁，低血时辉光变为更急促的红色，引爆后停止绘制炸弹并改画余烟；`vitalReach: 2.38` 同步抬高血条、硬控标记与图鉴顶部外扩，避免被炸弹遮挡。
- 图鉴自动收录两种形态并展示「火系伤害 +50%」「硬控·免疫眩晕」「撞线爆炸 N 点 · 低血移速 ×1.5」；测试场自动出现两种单位，尚未编入任何正式关卡波次。
- 验证：新增 `tmp/check-bomber.js`，覆盖数据、火系易伤、眩晕免疫、冻结 / 麻痹边界、半血阈值、低血加速、单次撞线爆炸、爆炸后近战、爆炸击杀城墙、图鉴、绘制与测试场；同步把既有图鉴计数断言更新为各 15 种、抗性表更新为 12 组 24 种。全量 **45 个 `check-*.js` 与 9 个 `audit-*.js` 全部通过**，`node --check` 与 `git diff --check` 通过；画面用 `tmp/trace-draw.js bomber` 回放生成 `tmp/bomber.png`。

## 2026-10-29 · React shell 恢复完整 Canvas 界面

- React/Vite 构建入口继续存在，但 `App.jsx` 只保留 `#app-layout`、Canvas 与旧版 `start-hint`；首页、关卡选择、账户、属性、角色、装备、宝石、城墙、两本图鉴、战斗 HUD、暂停、升级、结算与测试场工具重新交给旧 Canvas UI。
- `Game.mount` 改为 `uiMode = "legacy"` 并绑定完整 Canvas 输入；`frontend/index.html` 补回 `#test-controls` 与 `#account-dialog`，登录输入浮层与测试场 DOM 工具恢复可用。
- `frontend/src/main.jsx` 不再启动 10 Hz UI 快照轮询；`frontend/src/features/` 未从当前路由引用，保留作后续 React 界面切换的兼容层。
- 验证：`npm --prefix frontend run build` 通过；`node tmp/check-react-ssr.mjs` 18 项通过；`src/*.js` 语法检查与 `git diff --check` 通过；`tmp/trace-draw.js` 走通 `account menu`、`account character` 与 `codex minion normal` 场景。

## 2026-10-26 · React 前端迁移

- 新增 `frontend/` React + Vite 应用：`App.jsx` 负责页面路由，`features/` 覆盖首页、关卡选择、僵尸 / 技能图鉴、登录注册、账户中心、属性、角色、装备背包、装备强化、宝石、城墙、战斗 HUD、暂停、升级、结算与测试场工具。
- 新增 `GameCanvas`、`engine.js`、`actions.js` 与 `ui-store.js`。React 只领取 10 Hz 轻量快照；敌人、弹体、粒子和技能实体继续保存在 Canvas 引擎中。React 命令统一经 `actions.js` 进入 `Game`。
- 新增 `src/lifecycle.js`：`Game.mount({ canvas })` 初始化视图、输入、账户、精灵和 RAF；`Game.destroy()` 清理 RAF、定时器和监听，支持重复挂载 / 卸载。
- `src/render.js` 改为通过 `initializeView` / `destroyView` 管理 Canvas，并在 `Game.uiMode === "react"` 时跳过旧 Canvas 菜单、HUD、暂停、升级和结算绘制。
- `src/input.js` 改为通过 `initializeInput` / `destroyInput` 绑定与释放监听；React 模式下 Canvas 指针只保留手动瞄准。`state.js` 对旧 `start-hint` 节点增加空值保护。
- Vite 生产构建输出 `frontend/dist/index.html` 与 `/app-assets/`；FastAPI 检测到构建产物时托管 React 首页，继续提供 `/assets`、`/pictures` 与 `/api`，构建缺失时回退旧版根 `index.html`。
- 保留 `window.Game` 与旧 Canvas 菜单作为验收期兼容 / 离线回退路径；后续阶段再转为 ES Module 并移除旧菜单。
- 修复 React 页面在宽屏浏览器中整体贴左的问题：`#root` 改为全屏 Flex 居中容器，游戏主体与测试场侧栏作为整体水平 / 垂直居中；重新执行生产构建通过。
- 验证：`npm --prefix frontend run build` 通过；`src/*.js` 语法检查、`compileall server` 通过；`check_db.py` 153 项、`check_api.py` 176 项、`check-accounts.js` 164 项、`check-character.js` 245 项、`check-equipment.js` 108 项、`check-wall.js` 61 项、`check-gems.js` 285 项、`check-rewards.js` 65 项与 `check-bomber.js` 全部通过。`check_api.py` 已按构建存在 / 不存在分别验证 React 静态托管与旧版回退；新增 `tmp/check-react-ssr.mjs`，15 个 React 页面 / 浮层 SSR 与挂载、销毁、重复挂载共 18 项通过。
