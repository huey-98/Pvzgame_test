# 局外界面改用 React 开发计划

> 临时开发计划。完成后把结论并入 `DEVELOPMENT_PLAN.md` §11、§12、§13，本文件移入 `docs/archive/features/`。
>
> 本文件只记录改法。数值、几何与文案仍以 `src/config.js` 为准，不在这里复述。

## 目标

React 生产入口里，局外界面改为与画布同框的 React 层，外观和交互与当前 Canvas 局外界面一致。战场和整段战斗流程继续由 Canvas 绘制和点击。

验收口径：

- 局外页的面板、按钮、徽章、分页、弹层与账户横幅，位置和配色跟当前 Canvas 一致；逻辑坐标继续用 `config` 里已有的矩形，不另写一套尺寸。
- 局外页背后的战场继续由现有主循环绘制，面板仍盖在半透明遮罩上。
- 从首页进入战斗后，HUD、暂停、升级三选一、结算、测试场战场与测试场侧栏保持现在的 Canvas / DOM 行为。
- 局外点击不会穿透到画布；战斗中的瞄准、暂停、选词条和结算点击仍由 `input.js` 处理。
- 账户、装备、城墙、宝石、技能与步枪的请求仍只走现有 `Game.accounts` 与 `actions.js`。React 不直接改 `Game.state`，不持有敌人、弹体、粒子或技能实体。
- 根目录 `index.html` 离线入口保持整页 Canvas，不依赖 React。

## 画面归属

`Game.state.screen` 仍是唯一路由。

| 画面 | 归属 | 当前绘制 |
| --- | --- | --- |
| `menu` | React | `drawMenu`、`drawAccountBanner` |
| `levelSelect` | React | `drawLevelSelect`、`drawLevelBrief`、`drawAccountBanner` |
| `login` | React | `drawLogin`；真实输入今天在 `#account-dialog` |
| `account` | React | `drawAccount` |
| `attributes` | React | `drawAttributes` |
| `character` 及其子弹层 | React | `drawCharacter`、`drawCharacterGems`、`drawCharacterGemDetail`、`drawCharacterEquip`、`drawCharacterResourceDetail`、`drawGemSynthesis` |
| `equipment` | React | `drawEquipment` |
| `equipmentBag` | React | `drawEquipmentBag` |
| `wall` | React | `drawWallPanel` |
| `skillProgress` | React | `drawSkillProgress` |
| `zombieCodex` | React 面板 + 卡片内小画布立绘 | `drawZombieCodex` |
| `skillCodex` 及其子弹层 | React 面板 + 卡片内小画布图标 | `drawSkillCodex`，含等级面板、词条条件面板、步枪节点 |
| `playing`、`testArena` | Canvas | 战场、HUD、瞄准；测试场侧栏仍是 `#test-controls` |
| `paused` | Canvas | `drawPause` |
| `upgrade` | Canvas | `drawUpgrade` |
| `victory`、`defeat`、`retreat` | Canvas | `drawResult`、`drawAccountBanner` |

角色子弹层对应现有状态：`characterGems`、`characterGemDetail`、`characterGemReplace`、`characterEquipItem`、`characterResourceDetail`、`gemSynthesisOpen`。技能图鉴子弹层对应 `skillCodexLevelPanel`、`skillCodexRequirementTraitId`、`rifleProgressMilestonePanel`。这些字段留在 `Game.state`，由已有的 `Game.open*` / `Game.close*` / `Game.set*` 修改。

## 非目标

- 不把 HUD、暂停、升级三选一、结算改成 React。`frontend/src/features/BattleOverlays.jsx` 与 `TestArenaPanel.jsx` 本轮不挂载。
- 不删除 `render.js` 里的局外绘制函数。离线入口还要使用它们。
- 不改战斗规则、伤害入口、状态入口、关卡数据、数据库或 API。
- 不引入新的运行时依赖、测试框架、Redux 或 TypeScript。
- 不把现有 `frontend/src/features/` 的弹性布局页面当作视觉成品。那些组件的信息架构和 Canvas 不一致，按本计划重写局外页。

## 架构

### 壳层标志

已有的 `Game.uiMode === "react"` 会连 HUD、暂停、升级和结算一起停掉，不能直接打开。

新增 `Game.shell`，只表示「谁在画局外界面」：

- `lifecycle.js` 的 `Game.mount()` 设为 `"react"`，`Game.destroy()` 恢复为 `"legacy"`。
- `src/main.js` 不设置，默认 `"legacy"`。
- 新增 `Game.reactOwnsScreen(screen)`：`shell === "react"` 且 `screen` 属于上表的 React 行。放在 `state.js`，供 `render.js` 与 `input.js` 共用。

### 绘制

`Game.draw` 在战场图层画完后：

- `reactOwnsScreen(S.screen)` 为真：调用 `updateTestControls()`，然后返回。不画 HUD，不画局外页，不调用 `syncAccountDialog`。
- 其余情况保持现有顺序，包括战斗页的 HUD、暂停、升级、结算和账户横幅。

局外遮罩改由 React 铺满逻辑画面，颜色与 `Game.overlay` 相同（`rgba(3, 9, 13, .84)`）。战场继续在遮罩后面动画。

### 输入

`input.js` 的画布 `pointerdown` 在 `reactOwnsScreen` 为真时立即返回。关卡列表的拖拽、滚轮也在该条件下直接返回，改由 React 处理。

战斗页、测试场键盘和 `#test-controls` 保持原路径。`#account-dialog` 只留给 `shell === "legacy"` 的登录与删除账户。React 登录页在面板矩形里放真实输入框，删除账户用 React 弹层，不再打开这个对话框。

`#start-hint` 在 React 局外页隐藏，回到战斗页后再显示。

### 坐标

`resizeCanvas` 会把逻辑高度夹在 640 到 960，逻辑宽度保持 `config.width`。React 层必须跟这次计算结果走，不能写死 640。

结构：

- `#game-shell` 内、画布之上放一层绝对定位舞台，铺满画布的 CSS 框。
- 舞台内部用当前 `config.width` × `config.height` 的逻辑像素布局，再用 `scale(显示宽度 / config.width)` 从左上角拉伸。逻辑宽高比由 `resizeCanvas` 跟显示框对齐，所以横向和纵向是同一个比例。
- 矩形全部读 `config` 里对应的 UI 对象，以及现有的 `Game.get*Rect`。按钮热区就是这些矩形，不再做第二套命中。
- `resizeCanvas` 结束后立刻 `refreshUiStore()`，避免只靠 10 Hz 轮询才跟上高度变化。

Canvas 文字的 y 是基线。按钮标签用 `y + h / 2 + 5`。React 文本按同一基线摆放，不用 flex 垂直居中代替。说明文字的折行调用 `Game.utils.wrapText`，再按返回的行渲染。

### 命令与快照

组件只调用 `actions.js`。缺的局外命令在这一层补薄封装，内部调用已有 `Game.*`，调用后 `refreshUiStore()`。异步账户操作继续用现有的 `track`。

`ui-store.js` 继续 10 Hz 产出不可变快照。局外组件只读快照，不在渲染期间遍历 `Game.state` 的战斗数组。`App` 挂载时启动 `startUiStore()`，卸载时停掉。

图鉴立绘和技能图标不在 React 里重画。把 `drawCodexEnemyModel`、`drawSkillGlyph` 提升为 `Game` 上的绘制函数，由卡片内的小 `<canvas>` 调用；面板、文字和按钮仍是 DOM。

## 影响文件

| 文件 | 改动 |
| --- | --- |
| `src/state.js` | 增加 `Game.shell` 默认值与 `Game.reactOwnsScreen` |
| `src/lifecycle.js` | `mount` / `destroy` 切换 `Game.shell`；`resize` 后刷新快照的挂钩由 React 侧注册，不在旧引擎里依赖 React 模块 |
| `src/render.js` | `draw` 在 React 局外页提前返回；导出图鉴立绘与技能图标绘制 |
| `src/input.js` | React 局外页跳过画布点击、关卡拖拽和滚轮；`shell === "react"` 时不打开 `#account-dialog` |
| `frontend/src/app/App.jsx` | 挂载画布、局外舞台和快照订阅 |
| `frontend/src/game/ui-store.js` | 快照补齐局外页状态、逻辑尺寸和颜色 |
| `frontend/src/game/actions.js` | 补齐局外命令，禁止组件直接写状态 |
| `frontend/src/game/stage.jsx` | 新建逻辑舞台、遮罩、面板、按钮、徽章、基线文字 |
| `frontend/src/features/` | 重写局外页；战斗浮层文件保留但不挂载 |
| `frontend/src/styles.css` | 舞台和 Canvas 外观所需的定位样式；不再用现有 `.screen` 弹性布局做局外页 |
| `frontend/index.html` | 局外页显示时隐藏 `#start-hint` 的逻辑放在脚本侧，标记本身保留给离线与战斗 |
| `DEVELOPMENT_PLAN.md` | 实现完成后改 §11、§12、§13 的开发方式 |
| `README.md` | 只改「谁绘制局外界面」这句玩家可见说明 |
| `DEVELOPMENT_LOG.md` | 实现完成后追加一条 |

`src/main.js`、`index.html` 的脚本顺序、`engine.js` 的导入顺序不改。

## 配置 / 数据变更

- `config` 字段：不新增数值。几何、颜色、文案继续读现有 `menu`、`levelSelect`、`accountUI`、`attributesUI`、`characterUI`、`equipmentUI`、`equipmentBagUI`、`wallUI`、`skillProgressUI`、`skillCodexUI`、`gemSynthesisUI`、`resourceDetailUI`、`colors`。
- 数据库表 / 字段：无。
- 接口：无。

## 快照

在现有账户、养成和战斗字段之外，局外页需要这些只读字段：

- `shell`、`viewWidth`、`viewHeight`、`colors`
- 首页与关卡：`statusNote`、`accountStatus`、`completedCount`、`completedLevels`、`levelPreview`、`levelScroll`、`levelScrollMax`
- 登录与账户：`accountMode`、`accountError`、`accountBusy`、`accountResourcePage`、用户名、注册日期、资源分页结果、最近记录
- 角色：`characterPart`、`characterTab`、三个背包的当前页与总页数、`characterGems`、`characterGemDetail`、`characterGemReplace`、`characterEquipItem`、`characterResourceDetail`、`gemSynthesisOpen`、合成当前页与方案摘要
- 图鉴：`zombieCodexCategory`、`selectedZombieCodexId`、`selectedSkillCodexId`、`codexPage`、`skillCodexLevelPanel`、`skillCodexRequirementTraitId`、`rifleProgressMilestonePanel`
- 分页与选中部位：`skillProgressPage`、`equipmentBagPart`

列表内容继续用已有的 `Game.accounts.getResourceList`、`Game.equipment.getSlots`、`Game.gems.getAll`、`Game.skillProgress.getAll`、`Game.getCodexEnemyIds`、`Game.getSkillGroups` 等只读视图，在 `capture()` 里收成普通对象。组件不调用会改状态的函数。

## 外观原语

`frontend/src/game/stage.jsx` 提供局外页共用件，尺寸参数来自调用方传入的 `config` 矩形：

- 舞台：接收 `viewWidth` / `viewHeight`，负责缩放和遮罩。
- 面板：圆角、填充、描边、阴影与 `render.js` 的 `panel` 一致。
- 按钮：圆角 13、自上而下渐变到 `#2c9d91`、发光、标签色 `#071217`、字号与 `Game.button` 一致。禁用态降低亮度，不改矩形。
- 徽章：高 20、圆角 10，字号与 `badge` 一致。
- 文本：调用方传入与 Canvas 相同的字号、颜色、对齐和基线 y。
- 输入框：只用于登录和删除账户，外框用 `accountUI.login` 的矩形，文字样式对齐 `drawFakeField`。

## 实现步骤

1. **壳层开关。** 在 `state.js` 增加 `shell` 与 `reactOwnsScreen`。`mount` / `destroy` 切换 `shell`。`draw` 和 `pointerdown` 先接上提前返回。这一步之后，React 入口的局外页会暂时只剩战场和遮罩空缺，所以同一步就要挂上首页，不能单独提交一个空白局外状态。
2. **舞台与快照。** `App` 订阅 `ui-store`。快照先补 `shell`、逻辑尺寸、颜色、首页横幅和账户状态。`resizeCanvas` 通过 `Game.onViewResize` 回调通知刷新；React 在挂载时注册，卸载时清掉。离线入口没有这个回调也不报错。
3. **首页。** 用 `config.menu` 摆账户圆钮、面板、六个按钮和底部横幅。按钮分别调用已有的 `startContinue`、`openLevelSelect`、`startTestArena`、`openCharacter`、`openSkillCodex`、`openZombieCodex`、`openAccount`。进入 `playing` 或 `testArena` 后舞台卸载或不再接收事件，确认 HUD 和瞄准仍在 Canvas。
4. **属性、城墙、装备强化。** 这三页没有子弹层，用来把面板、按钮和基线文字对牢。强化按钮走已有 `upgradeEquipment`、`upgradeWall`，忙碌和错误文案用快照里的 `equipmentBusy`、`wallBusy`、`equipmentError`、`wallError`。
5. **登录与账户中心。** React 输入框替换假输入框和 `#account-dialog`。注册切换走 `openLogin` / `setAccountMode`。资源分页走 `setAccountResourcePage`。退出、删除、导入旧档走已有异步命令。`shell === "react"` 时 `syncAccountDialog` 不把对话框打开。
6. **关卡选择。** 列表视口、行高、滚动条和简介面板读 `config.levelSelect` 与现有 `getLevelListViewport`。拖拽阈值、滚轮步进沿用 `config.levelSelect` 的 `dragThreshold` 与 `scrollWheelStep`，滚动仍写回 `Game.scrollLevelList`。简介的开关走 `openLevelPreview` / `closeLevelPreview`。简介打开时列表不滚动。
7. **装备背包与技能强化。** 部位页签、行矩形和强化按钮用现有 `getEquipmentBag*`、`getSkillProgress*` 矩形。步枪节点若出现在技能强化页，沿用该页现有入口，不新开画面。
8. **角色页。** 按 Canvas 的叠放顺序做：头部返回和属性入口、六个部位、三个快捷入口、背包三页、底部分页。子弹层按状态互斥：宝石镶嵌、宝石详情、装备替换、资源详情、合成。合成方案、镶嵌和锁定都走已有 `actions.js` 里的宝石命令；缺的开闭与翻页只补命令，不在组件里写 `characterGems` 等字段。
9. **两本图鉴。** 面板和分页用 DOM。敌人立绘调用导出的 `Game.drawCodexEnemyModel`，技能图标调用 `Game.drawSkillGlyph`，画进卡片里的小画布。详情里的属性、抗性、召唤和技能词条用 `wrapText` 的行。技能图鉴里的账户升级、等级面板、词条条件面板、步枪里程碑沿用现有状态开关和 `upgradeSkill` / `upgradeRifle`。
10. **收口。** 逐页核对返回路径都能回到上一级，最后回到首页。确认离线 `index.html` 仍画出原来的 Canvas 菜单，并且仍能打开 `#account-dialog`。更新 §11、§12、§13 和 `README.md` 中关于 React 绘制范围的句子，追加 `DEVELOPMENT_LOG.md`，再把本文件归档。

每完成一步都保持生产入口可从首页进入战斗再返回。不把多个空白页面留在同一次可玩构建里。

## 命令补齐

`actions.js` 需要覆盖、且今天还没有封装的调用：

- 关卡：`openLevelPreview`、`closeLevelPreview`、`scrollLevelList`
- 账户分页：`setAccountResourcePage`
- 角色：`setCharacterTab`、`openCharacterGems`、`closeCharacterGems`、`setCharacterGemPage`、`openCharacterGemDetail`、`closeCharacterGemDetail`、`openCharacterEquip`、`closeCharacterEquip`、`setCharacterEquipPage`、`openCharacterResource`、`closeCharacterResource`、`setCharacterResourcePage`、`openGemSynthesis`、`closeGemSynthesis`、`setGemSynthesisPage`、选择合成焦点的现有函数
- 图鉴：切换僵尸分类、选中条目、`codexPage` 翻页、技能图鉴选中、等级面板、词条条件面板、步枪里程碑面板的现有开闭函数
- 技能强化分页：`setSkillProgressPage`

实现时以 `state.js` 里实际存在的函数名为准。已经存在的 `openAccount`、`startLevel`、`upgradeEquipment`、`socketGem` 等直接复用。组件里不出现 `Game.state.xxx =`。

## 验证方式

- 必跑：`npm --prefix frontend run build`、`node tmp\check-react-ssr.mjs`、`Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }`、`node tmp\check-docs.js`、`git diff --check`
- 专项：局外页不改战斗数值，不新增关卡脚本。账户、装备、城墙、宝石、技能、步枪若只改了调用入口，各跑一遍现有的 `tmp/check-accounts.js`、`tmp/check-character.js`、`tmp/check-equipment.js`、`tmp/check-wall.js`、`tmp/check-gems.js`、`tmp/check-skills.js`、`tmp/check-rifle.js`。若 `check-react-ssr.mjs` 写死了旧组件导出或旧文案，同步它的清单。
- 画面回放：离线 Canvas 菜单用现有 `tmp/trace-draw.js` 场景确认绘制函数未被改坏。React 局外页不能用这条回放代替，需在浏览器里逐页核对。
- 浏览器走查：
  - 首页六个入口和账户圆钮，进入战斗、暂停、升级、胜利或失败后回到首页。
  - 关卡列表拖拽、滚轮、点按与简介弹层；简介打开时不触发开局。
  - 登录、注册、错误提示、退出、删除账户；离线时按钮文案与现在一致。
  - 角色三页背包、镶嵌、卸下、锁定、合成、装备替换、资源详情。
  - 装备强化、城墙升级、技能强化的忙碌态和失败文案。
  - 两本图鉴的翻页、详情、返回，以及技能图鉴里的升级面板。
  - 桌面宽屏和竖屏宽度下，舞台与画布边缘对齐，底部按钮不被 `#start-hint` 挡住。
  - 局外页点击不改变瞄准，也不误触测试场按钮。

## 文档同步清单

- [x] `DEVELOPMENT_PLAN.md` §11：React 局外页不回退到 Canvas；战斗页仍由 `render.js` 绘制
- [x] `DEVELOPMENT_PLAN.md` §12：局外点击在 React；战斗瞄准与战斗页点击留在 `input.js`
- [x] `DEVELOPMENT_PLAN.md` §13：写明 `Game.shell`、舞台缩放、快照和 `actions.js` 边界
- [x] `README.md`：生产入口的局外界面由 React 绘制，战斗画面仍是 Canvas；离线入口说明保持不变
- [x] `DEVELOPMENT_LOG.md` 追加一条
- [x] 本文件移入 `docs/archive/features/`，并在 `docs/README.md` 登记

## 风险

- 直接打开 `uiMode === "react"` 会把战斗 HUD 一起拿掉。必须使用独立的 `Game.shell` 判断。
- 逻辑高度会随外壳变化。舞台若写死 640，高屏上的底部按钮会和 Canvas 错位。
- 图鉴立绘若用 CSS 重画，无法和程序化敌人模型一致。必须复用现有绘制函数。
- `draw` 提前返回时如果连 `updateTestControls()` 也跳过，离开测试场后侧栏会停在显示状态。
- 旧引擎文件保持 ES5。`reactOwnsScreen` 和绘制导出不能使用可选链、箭头函数、`const` / `let` 或模板字符串。
