# 文档索引

本项目文档按「单一事实来源」组织：同一类信息只在一份文档中维护，其余文档只指向它。

## 文档职责

| 文档 | 作用 | 何时更新 | 权威范围 |
| --- | --- | --- | --- |
| `AGENTS.md` | 面向开发者与 AI 的协作规则 | 规则、边界或验证方式变化 | 必须遵守的规则、验证命令 |
| `README.md` | 面向使用者的说明 | 启动方式或可玩内容变化 | 项目结构、运行方式、功能概览 |
| `DEVELOPMENT_PLAN.md` | 系统设计与架构 | 设计、数据模型或验收标准变化 | 系统设计、关卡设计、验收标准 |
| `DEVELOPMENT_LOG.md` | 按日期追加的历史日志 | 每轮开发结束 | 已发生的事实，不回填旧数字 |
| `docs/archive/` | 已完成的实现说明与历史记录 | 只增不改 | 历史归档 |

## 单一事实来源

- **数值**（血量、波次、倍率、抗性、等级上限）以 `src/config.js` 为准；文档只描述机制，不复述具体数字。
- **必须遵守的规则**只在 `AGENTS.md` 维护，`README.md` 不重复规则条文。
- **每轮改动**记录在 `DEVELOPMENT_LOG.md`；历史数字不回填，以当时的记录为准。
- **一致性检查**：`node tmp/check-docs.js` 会比对文档中的关卡总数、等级上限、图鉴数量、抗性组数与 `src/config.js`，并检查文档引用的检查脚本是否存在。

## 更新流程

1. 功能或规则变化时，先判断它属于上表哪一类的「权威范围」。
2. 只更新对应的那一份文档，再在 `DEVELOPMENT_LOG.md` 追加一条记录。
3. 涉及数值时修改 `src/config.js`，不要在多份文档里各写一遍。
4. 完成后运行 `node tmp/check-docs.js`。

## 归档

以下文档已完成使命，内容已并入正式文档，保留仅作历史参考：

| 归档文件 | 原用途 | 结论所在 |
| --- | --- | --- |
| `docs/archive/skill-progress-implementation.md` | 技能图纸与等级的一次性实现说明 | `DEVELOPMENT_PLAN.md` 第 20 节 |
| `docs/archive/skill-super-traits-plan.md` | 技能超级词条的一次性实现说明 | `DEVELOPMENT_PLAN.md` 第 7 节与 `README.md` |
| `docs/archive/rifle-development.plan.md` | 步枪账户成长系统设计草案 | `DEVELOPMENT_PLAN.md` 第 21 节 |
| `docs/archive/iteration-acceptance-records.md` | 早期迭代验收记录 | 原 `DEVELOPMENT_PLAN.md` 第 11 节 |

## 新增功能文档

进行中的功能计划放在 `docs/features/`；完成后把结论并入正式文档，再把原文件移入 `docs/archive/` 并在此登记。
