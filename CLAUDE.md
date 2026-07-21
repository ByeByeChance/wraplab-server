# CLAUDE.md · WrapLab Server — 车衣服务后端

> 文档先行、需求后行。逐 Phase 完整交付。
>
> 与其他文档的分工：`CLAUDE.md` 定**规则** · `docs/00_requirements.md` 定**需求** · `docs/01_architecture.md` 定**架构**。

---

## 一、铁律

1. **文档先行**：先需求 + 架构文档，审核通过后再写代码。
2. **技术栈固定**：NestJS + TypeORM + MySQL + Redis。RESTful API，多租户（store_id）架构。
3. **主 Agent = 监督者**：所有写文件任务、评审任务必须派发子 Agent。主 Agent 只负责调度和关卡检查，严禁直接写文件、严禁自己做评审。
4. **子 Agent 完工必落盘**：更新进度 + 记录实现要点与踩坑。不落盘视为未完成。
5. **多租户基因**：所有业务表从 Day 1 携带 `store_id`，Store 上下文通过 JWT 注入。
6. **适配器隔离**：AI 生图、OSS 存储等外部服务全在接口后，业务代码不直接调具体实现。

## 二、开发流程

严格遵循 **8 步 5 关** 流程，详见 `.claude/skills/rigorous-dev-workflow.md`。

```
🧭 PM 需求 → 🔍 需求评审 → 🏛️ 设计 → 👁️ 设计评审 → 🏗️ 开发 → 🧪 测试 → 👁️ 审查 → 🏗️ 修复 → 🧪 回归 → ✅ 交付
   ↓ Gate 1                ↓ Gate 2              ↓ Gate 3              ↓ Gate 4
```

子 Agent 角色定义见 `.codex/agency-agents/`。

## 三、技术栈（已锁定）

| 层 | 选型 | 备注 |
|---|---|---|
| 运行时 | Node.js + TypeScript | |
| 框架 | NestJS | RESTful API |
| ORM | TypeORM | MySQL 8 |
| 缓存 | Redis | 会话管理、缓存 |
| 存储 | OSS (阿里云/S3) | 图片、3D 模型 (glTF/GLB) |
| AI 生图 | 外部 API (DALL-E 等) | NestJS 组装 Prompt 调用 |
| 验证 | class-validator + class-transformer | |
| 测试 | Jest + supertest | |

## 四、项目结构

```
wraplab-server/
├── CLAUDE.md
├── .claude/skills/rigorous-dev-workflow.md
├── .codex/agency-agents/
├── src/
│   ├── modules/        # NestJS 功能模块
│   ├── common/         # Guards, decorators, filters
│   └── config/         # 配置
└── docs/
```

## 五、开工/收工

- **开工**：读 `docs/worklog/TODO.md` + 最近 `daily/` 日志。
- **收工**：更新 TODO + 写 `docs/worklog/daily/YYYY-MM-DD.md` + 必要时更新 `ROADMAP.md`。
- 子 Agent 完工后必须落盘（更新进度 + 记录要点与踩坑）。不落盘视为未完成。

## 六、质量门禁

```bash
npm run test
```

**零失败方可提交。无例外。**

测试要求：
- 新增功能必须配套测试
- API 端点测试覆盖正常路径 + 异常路径 + 边界
- 多租户隔离测试

## 七、速查

| 想了解 | 去 |
|--------|-----|
| 严格开发流程 | `.claude/skills/rigorous-dev-workflow.md` |
| 子 Agent 角色定义 | `.codex/agency-agents/` |
| 需求文档 | `docs/00_requirements.md` |

---

*本文件随项目演进持续更新。*
