# 街区警戒线

这是依据 `DEVELOPMENT_PLAN.md` 实现的第一版浏览器游戏原型。

## 项目结构

```text
.
├── index.html              # 页面入口，只负责 Canvas 和脚本装载
├── styles/
│   └── main.css            # 页面布局与 Canvas 外观
├── src/
│   ├── config.js           # 敌人、词条、波次和全局配置
│   ├── utils.js            # 通用数学、绘制和文本工具
│   ├── state.js            # 单局运行时状态与重置
│   ├── combat.js           # 生成、射击、碰撞、伤害、经验和词条
│   ├── update.js           # 游戏循环、实体移动和波次推进
│   ├── render.js           # Canvas 绘制和 HUD/界面
│   ├── input.js            # 鼠标与触控输入
│   └── main.js             # 应用初始化与 requestAnimationFrame 入口
├── DEVELOPMENT_PLAN.md
└── README.md
```

模块通过单一的 `window.Game` 命名空间协作，并按照 `index.html` 中的顺序加载。这样不需要构建工具，直接双击入口文件仍然可以运行；后续如果引入打包工具，也可以按职责迁移为 ES Module。

## 运行

直接双击打开 [`index.html`](./index.html)，或在当前目录启动任意静态文件服务器后访问该页面。

## 开发约定

- 新增敌人、词条、波次或平衡参数：优先修改 `src/config.js`。
- 新增战斗规则：放在 `src/combat.js` 或 `src/update.js`，不要写入渲染模块。
- 新增 Canvas 画面：放在 `src/render.js`，通过 `Game.state` 读取状态。
- 新增鼠标、触控或键盘操作：放在 `src/input.js`。
- 需要新增系统时，创建独立文件并在 `index.html` 中明确加载顺序。
- Canvas 使用逻辑分辨率绘制，并根据设备像素比自动提升实际渲染分辨率；调整画面尺寸时优先修改 `src/config.js` 的 `width` 和 `height`。

## 视觉实现

- `styles/main.css` 负责页面容器、响应式比例和外层光晕。
- `src/render.js` 负责游戏内视觉表现，包括背景纵深、HUD 面板、角色/敌人描边、子弹拖尾、Boss 光效以及升级和结算界面。
- 渲染模块使用逻辑坐标，业务逻辑不需要因为高清屏或 Canvas 尺寸变化而改写。

## 当前已实现

- 9:16 竖屏战斗画面，玩家固定在底部中央并自动向上射击。
- 普通僵尸、快跑僵尸、铁桶僵尸与最后一波 Boss。
- 子弹碰撞、击杀、经验、等级上限 10 级。
- 升级时暂停战斗，并从数据化词条池中随机提供 3 个不重复选项。
- 增伤、连发、射速、齐射、穿透、大口径、暴击、弱点打击、燃烧弹、冰冻弹。
- 波次推进、Boss 血条、胜利/失败结算与重新开始。
