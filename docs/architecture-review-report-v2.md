# 设计重审报告：WrapLab Server Phase 1 架构

**评审日期**：2026-07-21
**评审角色**：Code Reviewer
**评审结论**：🔄 修改后重审

---

## 修复验证

### Blocker 验证

| 问题 | 状态 | 说明 |
|------|------|------|
| BL-01 | ✅ | `JwtStrategy.validate()` 增加了 `staff.status` 和 `store.status` 校验，含 60s TTL 内存缓存。admin 角色跳过门店状态校验。符合预期。 |
| BL-02 | ✅ | 新增 Section 9（Redis 缓存策略），Cache-Aside 模式覆盖 vehicles（brands/series/models）和 colors（brands/swatches/materials）6 条高频读取路径。`CacheService.wrap()` 实现 Redis 不可用时自动降级 MySQL。符合 NFR-40 和 AC-51。 |
| BL-03 | ✅ | `staff` 表 DDL 增加 `token_version INT UNSIGNED NOT NULL DEFAULT 0`。`RefreshTokenGuard` 校验 `staff.token_version === payload.token_version`。需求文档同步更新。 |
| BL-04 | ✅ | 需求文档 NFR-21 更新为 `{ code, message, data, requestId }`，第 7.3 节所有响应示例含 `requestId`。架构与需求一致。 |
| BL-05 | ✅ | `POST /api/v1/auth/refresh` 鉴权表标记使用独立 `RefreshTokenGuard`（非 JwtAuthGuard）。RefreshTokenGuard 完整实现校验 refreshToken 签名、过期时间、staff 状态、store 状态、token_version 匹配。Controller 使用 `@Public()` + `@UseGuards(RefreshTokenGuard)` 双重声明，鉴权边界清晰可审计。 |

### Should Fix 验证

| 问题 | 状态 | 说明 |
|------|------|------|
| SF-01 | ✅ | 架构 DDL `car_model` 表列名改为 `model_3d_url`（含命名规范修复注释）。需求文档同步更新所有引用处（FR-16、car_model 表定义、验收标准等）。 |
| SF-02 | ✅ | `BCRYPT_SALT_ROUNDS` 改为从 `process.env.BCRYPT_SALT_ROUNDS` 读取，默认 12。Joi 校验中 `min(4).max(16).default(12)`。 |
| SF-03 | ✅ | 15 m2 提取为常量 `DEFAULT_FULL_CAR_AREA_M2`（`src/common/constants/pricing.constant.ts`），同时通过环境变量 `DEFAULT_FULL_CAR_AREA_M2` 可配置。 |
| SF-04 | ✅ | `TenantInterceptor` 代码模式未变（仍用 `new Observable()`），但新增明确的实现建议注释（行 1124-1125），推荐生产实现改用 NestJS 中间件或 `from()` 包装。架构文档层面提供了正确的实现方向指引，可接受。 |
| SF-05 | ✅ | `PaginationDto.page` 增加 `@IsInt()` 和 `@Max(10000)`，防止大 offset 拖库。 |
| SF-06 | ✅ | `part_color` 表 DDL 增加 `deleted_at DATETIME NULL` 列，与其他业务表软删除策略一致。 |
| SF-07 | ✅ | 错误码表 `STORE_NOT_ACTIVE (4002)` HTTP 列显示 `403`。`BusinessException.inferHttpStatus()` 增加显式判断 `if (code === ErrorCode.STORE_NOT_ACTIVE) return HttpStatus.FORBIDDEN`。 |
| SF-08 | ✅ | 架构 API 端点清单增加 `DELETE /api/v1/quotes/:id`（软删除，HTTP 200）。需求文档增加 FR-47、AC-30a、AC-30b。 |

---

## 🔴 Blocker

### BL-V2-01: JwtPayload 接口缺少 `token_version` 字段

- **位置**：架构文档第 4.1 节（行 900-908），`JwtPayload` 接口定义
- **问题**：`JwtPayload` 接口定义中不包含 `token_version` 字段。但 Token 刷新流程（行 1308）中 `jwt.sign()` 明确包含 `token_version`，且 `RefreshTokenGuard` 中校验 `payload.token_version`（行 1346）。JwtPayload 接口与实际签名 payload 不一致。
- **影响**：TypeScript 编译时无法校验 `token_version` 字段，`RefreshTokenGuard` 中 `payload.token_version` 访问为隐式 `any`，容易遗漏。
- **建议**：在 `JwtPayload` 接口中增加 `token_version: number` 字段。

```typescript
// 修正后的 JwtPayload
interface JwtPayload {
  sub: number;
  store_id: number | null;
  role: 'admin' | 'manager' | 'staff';
  phone: string;
  token_version: number;  // 新增
  iat: number;
  exp: number;
}
```

### BL-V2-02: JwtStrategy.validate() 描述与实现不一致 — 声称校验 token_version 但代码未校验

- **位置**：架构文档第 3.2.4 节（行 578）vs 第 4.2 节（行 970-1006）
- **问题**：行 578 声明 "`token_version` 校验在 `JwtStrategy.validate()`（accessToken）和 `RefreshTokenGuard`（refreshToken）两处均执行"。但 `JwtStrategy.validate()` 的实际代码（行 970-1006）仅校验 `staff.status` 和 `store.status`，**没有 token_version 校验逻辑**。这导致两个问题：
  - 文档自相矛盾：声明了校验但代码没有
  - 安全策略不完整：修改密码后旧 accessToken 在 2 小时有效期内仍可使用（仅在 refreshToken 层面失效）
- **影响**：如果这是设计意图（accessToken 仅靠短有效期和状态校验兜底），则行 578 是错误声明需要修正。如果确实要在 accessToken 验证时校验 token_version，则 `JwtStrategy.validate()` 代码缺失该逻辑。
- **建议**：二选一，明确立场：
  - 方案 A（推荐）：在 `JwtStrategy.validate()` 中增加 `token_version` 校验 — 确保密码修改后旧 accessToken 立即失效。实现方式：将 `token_version` 加入 JWT payload，在 validate() 中比对 `payload.token_version === staff.token_version`。
  - 方案 B：修正行 578 的声明 — 删除 "`JwtStrategy.validate()`（accessToken）" 部分，明确 accessToken 仅依赖短有效期（2h）+ 状态校验兜底。注意需同步更新 Trade-off 说明，承认密码修改后旧 accessToken 在 2h 内仍可用。

## 🟡 Should Fix

### SF-V2-01: AC-51 降级描述与 CacheService.wrap() 实现略有偏差

- **位置**：需求文档 AC-51 vs 架构文档第 9.6 节
- **问题**：AC-51 描述为 "Given Redis 不可用（缓存服务挂了），When 请求车型列表 API，Then 降级直接查询数据库，API 正常返回"。架构的第 9.6 节提到 "降级期间不写入 Redis"，即 Redis 恢复后需等 TTL 自然过期或首个请求 miss 重新写入。这是一个合理的 Trade-off，但 AC-51 未覆盖"Redis 恢复后首个请求是否正常"的场景。
- **建议**：在 AC-51 中补充说明 "Redis 恢复后自动重建缓存"，或将其作为实现细节不体现在验收标准中。此为文档对齐建议，不阻塞。

---

## 💭 Nice to Have

### NH-V2-01: FR-46（报价单生成后自动更新方案状态）未在架构中显式描述

- **位置**：架构文档第 3.4.5 节（报价单接口）
- **问题**：需求 FR-46 / AC-29 要求报价单生成后自动将关联改色方案状态更新为 `quoted`。上次评审（NH 无编号，需求对齐检查表中标为 ⚠️）已指出此问题。本次修复未在架构中增加此行为的显式描述。
- **建议**：在 `QuoteService` 设计或报价单生成接口描述中增加 "生成报价单时，自动将关联 `configuration.status` 更新为 `quoted`" 的说明。

---

## 新问题总结

| 编号 | 问题 | 严重程度 | 类型 |
|------|------|----------|------|
| BL-V2-01 | JwtPayload 接口缺少 `token_version` 字段 | 🔴 Blocker | 接口定义遗漏 |
| BL-V2-02 | JwtStrategy.validate() 描述与实现不一致 | 🔴 Blocker | 文档矛盾 |
| SF-V2-01 | AC-51 降级描述可更完善 | 🟡 Should Fix | 文档对齐 |
| NH-V2-01 | FR-46 自动更新方案状态未在架构中描述 | 💭 Nice to Have | 延续未修复 |

---

## 总结

### 修复完成情况

上一轮 5 个 Blocker 和 8 个 Should Fix 的核心修复均已落地：

- **5/5 Blocker 已修复**：JWT 状态校验、Redis 缓存策略、token_version 列、requestId 对齐、RefreshTokenGuard 独立鉴权 — 全部体现在架构 v1.1 和需求 v1.2 中。
- **8/8 Should Fix 已修复**：命名规范、环境变量化、常量提取、分页边界、软删除补充、STORE_NOT_ACTIVE 状态码、DELETE quote 接口 — 全部就位。

### 本轮新增 2 个 Blocker

BL-V2-01 和 BL-V2-02 均为 `token_version` 在 JwtPayload 接口和 JwtStrategy 实现中的遗漏/不一致。这两个问题同根同源：`token_version` 被加入 refreshToken 校验和 DDL，但在 accessToken 侧的 payload 接口和 validate 实现中存在缺口。建议明确立场（accessToken 是否校验 token_version）后一次性修正。

### 评审结论：🔄 修改后重审

架构整体质量持续提升，上一轮核心问题已妥善修复。本轮 2 个 Blocker 修复范围小（接口加一个字段 + 文档声明对齐），预计可快速通过。建议修复后直接更新本文档状态为 "✅ 通过"，无需第三轮完整重审。

---

*重审版本：v2.0*
*评审角色：Code Reviewer*
*评审日期：2026-07-21*
*基于：架构 v1.1 + 需求 v1.2*
