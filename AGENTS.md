# AGENTS.md

面向开发者与 AI 的协作规则。动手前先读本文件；具体开发方式查 [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md)（下称「手册」）的对应章节。

## 项目概览

- 项目：`街区警戒线`，9:16 竖屏单手 Roguelite 僵尸生存射击游戏。
- 前端：React + Vite + Canvas 2D；旧引擎模块挂在 `window.Game` 上。
- 后端：Python 3.13 + FastAPI + SQLAlchemy + SQLite。
- 生产启动：`npm --prefix frontend run build` 后 `.venv\Scripts\python server\run.py`，访问 `http://127.0.0.1:8787`。
- 开发模式：后端保持 `8787`，另启 `npm --prefix frontend run dev`，访问 `http://127.0.0.1:5173`。

## 铁律

### 伤害与状态

1. 所有伤害必须走 `Game.damageEnemy`。
2. 生成弹体或伤害实体时快照 `element` 与 `damageSource`。
3. 所有负面状态必须走公开入口：`applySlow`、`applyKnockback`、`applyPull`、`applyStun`、`applyFreeze`、`applyParalysis`、`applyBurn`、`applyFrostbite`、`applyWound`。
4. 不要直接写 `enemy.slow`、`enemy.control`、`enemy.stun` 或直接改敌人坐标。
5. 护甲层数只能由 `Game.blockWithArmor` 扣除。
6. 敌人移速只能由 `Game.getEnemyMoveSpeed` 计算；回血必须乘 `Game.getHealScale`。
7. 状态免疫与时长缩放只能走 `Game.getStatusScale`。
8. 属性与来源倍率只在 `Game.damageEnemy` 内由 `Game.getElementDamageScale` / `Game.getDamageSourceScale` 读取。

### 战斗与关卡

9. 局内等级上限固定 LV.20；LV.2～LV.20 每次升级都进三选一，不得静默跳级。
10. 技能解锁只能用 `Game.unlockSkill`，常规流程不传 `force`。
11. 首领判定只能使用 `Game.isBossEnemy`，不要写死 `enemy.type === "boss"`。
12. 关卡与波次只配置在 `config.levels[].waves`；分裂与召唤只经 `S.pendingSpawns` + `Game.flushPendingSpawns`。
13. 数值只在 `src/config.js` 与 `server/app/config.py` 修改，文档不复述可变数字。

### 结构与风格

14. 数据进 `config`，状态进 `state`，规则进 `combat` / `update`，绘制进 `render`，输入进 `input`。
15. React 不直接改 `Game.state`，不持有战斗实体数组；一切经 `frontend/src/game/actions.js`。
16. `render.js` 只读状态与缓存，不发请求、不改战斗状态。
17. 旧引擎保持 IIFE + `"use strict"` + `var` + ES5；不要引入可选链、箭头函数、`const` / `let` 或模板字符串。
18. 不添加注释，除非用户明确要求；文案使用简体中文。
19. 不引入测试框架、Redux、TypeScript 或新的运行时依赖，除非用户明确要求。

### 账户与安全

20. SQLite 是账户、进度与资源数据的唯一来源；禁止用 `localStorage` 保存进度。
21. 密码只存 PBKDF2-SHA256 哈希；会话 token 只存 SHA-256 摘要，使用 HttpOnly + SameSite=Strict Cookie。
22. 服务只绑定 `127.0.0.1`；静态服务只暴露 `index.html`、`src/`、`styles/`、`assets/`、`pictures/`，绝不能暴露 `server/` 或 `data/`。
23. 最终校验必须在服务端；前端只做即时提示。
24. `/api/me/resources`、`/api/me/gems/grant`、`/api/me/rewards` 是调试接口，不可信。

### 防线与宝石

25. 防线受伤必须走 `Game.damageWall`；不要直接修改 `wall.hp`。
26. 宝石条件增伤只由 `Game.damageEnemy` 内调用 `Game.getGemDamageScale` 读取，不要在技能或弹体代码里另算。

## 开发手册索引

| 任务 | 手册章节 |
| --- | --- |
| 新增敌人 / 精英 / 首领 | §18 |
| 新增核心技能 | §19 |
| 新增词条 / 超级词条 | §20 |
| 新增宝石词条 | §17.4 |
| 新增关卡 | §21 |
| 新增资源或通用功能 | §22 |
| 修改画面 / 输入 | §23 |
| 改伤害或属性规则 | §4 |
| 改状态 / 护甲规则 | §5 |
| 改敌人机制 | §6 |
| 改技能与词条 | §7 |
| 改技能账户等级 | §8 |
| 改步枪系统 | §9 |
| 改关卡节奏或数值 | §10 |
| 改渲染层 | §11 |
| 改输入层 | §12 |
| 改 React 前端 | §13 |
| 改界面与图鉴 | §14 |
| 改数据库与迁移 | §15 |
| 改 API 与鉴权 | §16 |
| 改养成系统 | §17 |
| 性能优化 | §24 |
| 验收标准 | §25 |
| 临时计划与归档 | §26 |
| 常见坑 | §27 |
| 项目结构与启动 | §1 |

## 验证

改完代码后至少执行：

```powershell
npm --prefix frontend run build
node tmp\check-react-ssr.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
node tmp\check-docs.js
git diff --check
```

专项检查、画面回放与本机限制见手册 §2。

## 文档体系

| 事实 | 归属文档 |
| --- | --- |
| 数值（血量、波次、倍率、抗性、等级上限） | `src/config.js` / `server/app/config.py` |
| 必须遵守的规则与验证入口 | `AGENTS.md` |
| 各部分开发方式 | `DEVELOPMENT_PLAN.md` |
| 项目结构、运行方式、功能概览 | `README.md` |
| 每轮改动的事实记录 | `DEVELOPMENT_LOG.md` |
| 进行中 / 已完成的临时计划 | `docs/features/` / `docs/archive/` |

- 改功能或规则时只更新对应的那一份文档，再在 `DEVELOPMENT_LOG.md` 追加一条。
- 历史数字不回填；以当时的记录为准。
- 文档总索引见 [`docs/README.md`](docs/README.md)。

## 提交规范

- 提交信息使用单段纯文本。
- 提交前确认 `git status` 中没有无关文件。
