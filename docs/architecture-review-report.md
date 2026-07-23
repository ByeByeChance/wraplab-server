# 设计评审报告：WrapLab Server Phase 1 架构

**评审日期**：2026-07-21
**评审角色**：👁️ Code Reviewer
**评审结论**：🔄 修改后重审

---

## 🔴 Blocker

### BL-01: JWT Strategy 未校验店员/门店 active 状态

- **位置**：`docs/01_architecture.md` 第 4.2 节（约第 923-946 行），`JwtStrategy.validate()` 方法
- **问题**：`validate()` 方法直接返回 `payload`，不检查店员 `status` 是否为 `active`、门店 `status` 是否为 `active`。这意味着一旦 JWT 签发，在 2 小时有效期内，被停用的店员仍可继续访问系统。
- **需求对照**：AC-38 明确"停用店员后该店员无法再登录系统"，NFR-10 要求所有业务 API 必须携带有效 JWT token。仅登录时校验状态不满足安全需求 — 停用应在 token 有效期内也生效。
- **影响**：安全漏洞 — 店长停用店员后，该店员在 accessToken 到期前可继续操作业务数据（创建方案、生成报价单）。
- **建议**：在 `JwtStrategy.validate()` 中增加对 `staff.status === 'active'` 和 `store.status === 'active'` 的校验，校验失败时抛出 `BusinessException(ErrorCode.ACCOUNT_DISABLED)`。可考虑加入短时缓存（如 60s TTL）避免每次请求都查库。

### BL-02: 架构文档与需求文档在 Redis/缓存策略上不一致

- **位置**：架构文档第 10 节（Trade-off 汇总）声明 "Phase 1 无缓存"，但需求文档 NFR-40 要求 "车型列表和色卡列表接口响应时间 < 200ms（高频读取，使用 Redis 缓存）"；AC-51 要求 "Redis 不可用...降级直接查询数据库"。
- **问题**：架构设计明确推迟了 Redis 缓存引入（"先不引入缓存复杂性，Phase 2 按需加"），但需求文档已经定义了 Redis 缓存作为 NFR-40 的实现方案，且验收标准 AC-51 直接依赖 Redis 降级行为。
- **影响**：按架构实施将无法通过 AC-51 验收测试。需求文档与架构文档对 Phase 1 范围的理解不一致。
- **建议**：二选一：
  - 方案 A（推荐）：架构中增加 Redis 缓存层，至少覆盖 `CarService.getBrands()` 和 `ColorService.getSwatches()` 两个高频读取路径。Redis 不可用时降级直接查 MySQL（满足 AC-51）。
  - 方案 B：将 NFR-40 和 AC-51 从 Phase 1 降至 Phase 2，需求文档对应更新。

### BL-03: `staff` 表缺少 `token_version` 字段

- **位置**：DDL 第 307-326 行（`staff` 表定义），以及第 3.2.4 节 Token 刷新机制
- **问题**：架构第 3.2.4 节明确描述"签发时记录 `token_version` 于 staff 表"，Token 作废策略也依赖"修改密码 → 更新 `staff.token_version` → 所有旧 refreshToken 失效"。但 `staff` 表 DDL 中不存在 `token_version` 列。
- **影响**：密码修改后旧 refreshToken 仍可使用 7 天，安全策略无法落地。与 NFR-12（密码安全存储）的配套安全措施不完整。
- **建议**：在 `staff` 表 DDL 中增加 `token_version INT UNSIGNED NOT NULL DEFAULT 0` 列，并在 `JwtStrategy` 和 refresh token 接口中校验 version 匹配。

### BL-04: 响应格式中的 `requestId` 字段与需求文档不一致

- **位置**：架构第 3.1 节（统一响应格式）vs 需求第 7.3 节（统一响应格式）
- **问题**：架构设计的响应格式包含 `requestId` 字段，但需求文档定义的响应格式为 `{ code, message, data }`，不含 `requestId`。这导致验收标准中检验响应格式时会不匹配。
- **影响**：设计偏离需求，接口契约不一致。若实际返回 `requestId`，客户端可能因未预期的字段而报错（取决于客户端是否严格校验响应结构）。
- **建议**：与 PM 确认后，统一格式。`requestId` 是好设计，建议将需求文档更新为包含此字段。若需求不更新，架构应移除 `requestId`。

### BL-05: 公开接口白名单未显式声明 `POST /api/v1/auth/refresh` 的鉴权策略

- **位置**：第 3.2.2 节（接口鉴权分类表）
- **问题**：表中 `POST /api/v1/auth/refresh` 标记为 `@Public()` 但 "Service 层自行校验 refreshToken"。这种"公开路由 + Service 层内部校验"的模式的边界不够清晰。如果开发者误将 refreshToken 校验理解为 JwtAuthGuard 负责（因为它是 auth 接口），可能会漏掉 Service 层的校验。
- **影响**：若实现时遗漏 Service 层校验，refreshToken 接口将完全无鉴权。
- **建议**：将 `POST /api/v1/auth/refresh` 的鉴权策略在 `JwtAuthGuard` 的 `canActivate()` 方法中做显式处理，或者在 `@Public()` 装饰器中增加一个 `validateRefreshToken` 选项，确保该 Guard 的行为是可审计、不可遗漏的。

---

## 🟡 Should Fix

### SF-01: `3d_model_url` 列名违反 snake_case 命名规范

- **位置**：DDL 第 211-227 行（`car_model` 表），第 229 行注释，第 10 节 Trade-off 表
- **问题**：列名以数字开头（`3d_model_url`），不符合 snake_case 的典型定义（标识符应以字母开头）。架构文档自身也标注了 SQL 反引号包裹的必要性。TypeORM 需要 `@Column({ name: '3d_model_url' })` 这种非标准映射。
- **规范依据**：CLAUDE.md 第八节 "DB 列名: snake_case"
- **建议**：将列名改为 `model_3d_url`，需求文档对应更新。这样更符合命名规范，也避免可能的 ORM 兼容性问题。架构 Trade-off 表中提到"尊重需求文档设计"可让步，但此列名确实有实际隐患。

### SF-02: `BCRYPT_SALT_ROUNDS` 硬编码

- **位置**：第 5.1 节（约第 1194 行）
- **问题**：`const BCRYPT_SALT_ROUNDS = 12` 硬编码在代码中。不同环境（development/production）可能需要不同值（开发环境可用较低轮数加速测试）。
- **规范依据**：CLAUDE.md 第八节 "禁止硬编码 Key"
- **建议**：将 salt rounds 提取为环境变量 `BCRYPT_SALT_ROUNDS`，默认值 12。随配置模块统一管理。

### SF-03: 全车面积 15 m2 作为魔法数字硬编码

- **位置**：第 3.4.4 节报价详情的响应结构（`part_area: 15.00`）
- **问题**：全车标准面积 15 m2 是一个硬编码的业务常量，应提取为配置项而非散布在多处代码中。Phase 2 可能改为车型级面积配置，提前提取为常量可降低重构成本。
- **建议**：定义 `DEFAULT_FULL_CAR_AREA = 15` 常量放在 `src/common/constants/` 或通过环境变量 `DEFAULT_FULL_CAR_AREA_M2` 配置。

### SF-04: `TenantInterceptor` 使用手动 Observable 构造函数

- **位置**：第 4.4 节（约第 1030 行），`new Observable(subscriber => { ... })`
- **问题**：使用 `new Observable()` 手动管理订阅是反模式，在 NestJS 中通常使用 RxJS `pipe()` 操作符链。手动订阅管理容易引入上游 teardown 不被正确传播的问题（如客户端断开时 StoreContext 可能未清理）。
- **建议**：改用 `next.handle().pipe(tap(...))` 模式。如果必须使用 StoreContext.run()，使用 `from()` 包装或采用 NestJS 中间件（Middleware）替代拦截器 — 中间件在 async_hooks 上下文中更自然地与 `AsyncLocalStorage.run()` 配合。

### SF-05: 分页参数校验边界不完整

- **位置**：第 3.3 节 `PaginationDto` 定义（约第 600-619 行）
- **问题**：`PaginationDto` 仅校验 `page >= 1` 和 `size` 的 1-100 范围。但缺少对非整数输入的类型检查。闭包 `get skip()` 中 `(page - 1) * size` 若 page 超大（如 99999999999），`skip` 会超出 MySQL 的 offset 有效范围。
- **建议**：增加 `@IsInt()` 确保整数输入，增加 `page` 上限（如 10000），防止恶意大 offset 拖库。

### SF-06: `part_color` 表缺少 `deleted_at` 字段导致软删除不完整

- **位置**：DDL 第 351-366 行（`part_color` 表）
- **问题**：其他业务表（`configuration`, `quote`）均有 `deleted_at` 支持软删除，但 `part_color` 表没有 `deleted_at` 字段。当更新方案的颜色时，旧的 `part_color` 记录如何处置？DELETE 会导致历史不可追溯。
- **建议**：增加 `deleted_at DATETIME NULL` 列，更新方案颜色时软删除旧 `part_color` + 创建新记录，而非物理删除。

### SF-07: 错误码 4002（STORE_NOT_ACTIVE）的 HTTP 状态码映射偏差

- **位置**：第 3.7 节错误码表（约第 835 行）以及第 7.2 节 `BusinessException.inferHttpStatus()`（约第 1613-1624 行）
- **问题**：`STORE_NOT_ACTIVE` 错误码为 4002（业务 4xxx 段），`inferHttpStatus()` 方法将 4xxx 段映射为 `HTTP 400 Bad Request`。但 `STORE_NOT_ACTIVE` 的实际语义是"门店已被停用，无法操作"，更准确的 HTTP 状态码应为 403 Forbidden（与服务权限相关，而非输入错误）。
- **建议**：为 `STORE_NOT_ACTIVE` 显式传入 `HttpStatus.FORBIDDEN`，或调整 `inferHttpStatus()` 中对 4xxx 段的映射逻辑，使其支持更细粒度的状态判断。

### SF-08: 缺少 Delete Quote 接口

- **位置**：第 3.4.5 节报价单接口清单
- **问题**：报价单接口只有 POST/G ET/G ET:id，缺少 DELETE。虽然需求文档 Phase 1 未明确要求删除报价单，但考虑到报价单可能误创建或测试数据，缺乏删除手段不利于运营。
- **建议**：建议增加 `DELETE /api/v1/quotes/:id` 软删除接口（P1）。

---

## 💭 Nice to Have

### NH-01: NFR-55（数据库每日备份）未在架构中体现

- **位置**：需求文档 NFR-55
- **问题**：需求文档要求"数据库每日自动备份，保留最近 7 天备份，备份文件存储于 OSS"。架构文档没有提及备份策略。虽然这更多是运维层面而非应用架构，但可以在架构中简要列出备份工具/脚本方案（如 cron job + mysqldump + OSS upload）。
- **建议**：在架构中增加一个简短的"数据备份策略"小节，说明备份工具和存储方式。

### NH-02: 限流 Key 生成未覆盖 login 接口的 IP 提取准确性

- **位置**：第 5.3 节，`ThrottlerBehindProxyGuard.getTracker()` 方法
- **问题**：登录限流使用 `req.ip`，但如果 Node.js 应用部署在 Nginx/负载均衡器后面，`req.ip` 获取的是反向代理的 IP 而非真实客户端 IP。需要设置 `app.set('trust proxy', true)` 或读取 `X-Forwarded-For` 头。
- **建议**：在架构文档中标注生产环境需要配置 `trust proxy` 及安全注意事项（防止 X-Forwarded-For 伪造）。

### NH-03: `TenantBaseRepository.create()` 和 `save()` 都注入 `store_id` 存在语义重叠

- **位置**：第 4.5 节（约第 1107-1123 行）
- **问题**：`create()` 和 `save()` 都检查并注入 `store_id`。如果调用方先 `create({...})` 得到 entity，再修改 entity 属性，最后 `save(entity)`，两个方法都做了注入。虽然因为 `!entity.store_id` 检查而幂等，但语义不够清晰。
- **建议**：明确责任：`create()` 仅负责实例化，不注入 store_id；`save()` 统一负责注入。或反之。减少重复逻辑。

### NH-04: 缺少 Swagger/OpenAPI 文档生成说明

- **位置**：整体架构
- **问题**：对于拥有 ~40 个 API 端点的服务，缺少 API 文档自动生成策略。虽然这不是 Phase 1 架构的核心，但在架构文档中提及 Swagger 集成意向有助于 Phase 1 开发阶段就引入，避免后期补文档的额外工作。
- **建议**：在架构中提及 `@nestjs/swagger` 集成计划，或至少说明 `DTO` 中会加 `@ApiProperty()` 装饰器。

### NH-05: `quote` 表的价格明细未持久化

- **位置**：第 3.4.5 节报价详情的响应结构
- **问题**：响应中 `price_details` 包含 `part_area`, `color_price_per_m2`, `material_multiplier`, `subtotal`，但这些明细字段是计算出来的，未存储在 `quote` 表中。如果关联的 `color_swatch.price_per_m2` 或 `material.price_multiplier` 后续被修改，历史报价单重新查看会显示更新后的价格，而非当时的报价金额。
- **建议**：在 `quote` 表中增加 `price_details` JSON 列（MySQL 8 支持 JSON 类型），生成报价时将明细快照一并存储。或创建 `quote_detail` 关联表存储部件价格快照。

---

## 需求对齐检查

### 功能需求 vs API 端点

| FR | 对应 API | 状态 | 备注 |
|----|---------|------|------|
| FR-01 | `POST /api/v1/auth/login` | ✅ | |
| FR-02 | JwtPayload 设计 | ✅ | |
| FR-03 | JwtAuthGuard (global) | ✅ | |
| FR-04 | TenantInterceptor + StoreContext | ✅ | |
| FR-05 | TenantBaseRepository | ✅ | |
| FR-06 | `POST /api/v1/auth/refresh` | ✅ | |
| FR-07 | RolesGuard + @Roles() | ✅ | |
| FR-10 | `GET /api/v1/vehicles/brands` | ✅ | |
| FR-11 | `GET /api/v1/vehicles/series` | ✅ | |
| FR-12 | `GET /api/v1/vehicles/models` | ✅ | |
| FR-13 | 全局共享表，无 store_id | ✅ | |
| FR-14 | @Public() 公开读取 | ✅ | |
| FR-15 | `AdminVehicleController` CRUD | ✅ | |
| FR-16 | `3d_model_url` NULL 支持 | ✅ | DDL 允许 NULL |
| FR-20 | `GET /api/v1/colors/brands` | ✅ | |
| FR-21 | `GET /api/v1/colors/swatches` | ✅ | 全量返回无分页 |
| FR-22 | `GET /api/v1/colors/materials` | ✅ | |
| FR-23 | 全局共享表，无 store_id | ✅ | |
| FR-24 | `AdminColorController` CRUD | ✅ | |
| FR-30 | `POST /api/v1/configurations` | ✅ | |
| FR-31 | store_id/staff_id 自动注入 | ✅ | |
| FR-32 | part_code='FULL' 自动生成 | ✅ | |
| FR-33 | `GET /api/v1/configurations` (分页) | ✅ | |
| FR-34 | store_id 过滤 | ✅ | |
| FR-35 | `GET /api/v1/configurations/:id` | ✅ | |
| FR-36 | `PUT /api/v1/configurations/:id` | ✅ | |
| FR-37 | `DELETE /api/v1/configurations/:id` (软删除) | ✅ | |
| FR-38 | status 字段 (draft/confirmed/quoted) | ✅ | |
| FR-40 | `POST /api/v1/quotes` | ✅ | |
| FR-41 | 价格公式 | ✅ | 15 m2 固定值需关注 SF-03 |
| FR-42 | store_id/staff_id 自动注入 | ✅ | |
| FR-43 | `GET /api/v1/quotes/:id` | ✅ | |
| FR-44 | `GET /api/v1/quotes` (分页) | ✅ | |
| FR-45 | status 字段 (pending/confirmed/cancelled) | ✅ | |
| FR-46 | 自动更新 configuration status → quoted | ⚠️ | 架构未显式描述此行为，需在 QuoteService 中实现 |
| FR-50 | `GET /api/v1/admin/store` | ✅ | |
| FR-51 | `PUT /api/v1/admin/store` | ✅ | |
| FR-52 | `GET /api/v1/admin/staff` | ✅ | |
| FR-53 | `POST /api/v1/admin/staff` | ✅ | |
| FR-54 | `PUT /api/v1/admin/staff/:id` | ✅ | |
| FR-55 | store_id 过滤 | ✅ | |
| FR-56 | admin 跨门店权限 | ✅ | StoreContext.isAdmin() |
| FR-60 | `POST /api/v1/files/upload` | ✅ | |
| FR-61 | 返回文件 URL | ✅ | |
| FR-62 | 鉴权 + 大小限制 | ✅ | |

### 非功能需求 vs 架构落实

| NFR | 架构落实状态 | 备注 |
|-----|-------------|------|
| NFR-01 | ✅ | 所有业务表携带 store_id |
| NFR-02 | ✅ | TenantBaseRepository 自动过滤 |
| NFR-03 | ✅ | 从 JWT 提取，不从前端接收 |
| NFR-04 | ✅ | 全局共享表无 store_id |
| NFR-10 | ✅ | JwtAuthGuard 全局默认 |
| NFR-11 | ✅ | RolesGuard + @Roles() |
| NFR-12 | ✅ | bcrypt 12 rounds |
| NFR-13 | ✅ | @nestjs/config + joi 校验 |
| NFR-14 | ✅ | ValidationPipe + class-validator |
| NFR-15 | ✅ | @Throttle 登录 10次/分钟 |
| NFR-16 | ✅ | @Throttle 写接口 30次/分钟 |
| NFR-20 | ✅ | kebab-case API 路径 |
| NFR-21 | ⚠️ | 架构增加 requestId 字段，与需求不完全一致 (见 BL-04) |
| NFR-22 | ✅ | 统一分页参数和响应格式 |
| NFR-23 | ✅ | RESTful 语义 |
| NFR-30 | ✅ | 三层校验覆盖 |
| NFR-31 | ✅ | 400 + 字段错误信息 |
| NFR-32 | ✅ | 401 + 细分错误码 |
| NFR-33 | ✅ | 403 |
| NFR-34 | ✅ | 404 + 资源级错误码 |
| NFR-35 | ✅ | 500 + 不暴露堆栈 |
| NFR-36 | ✅ | 503 + DATABASE_ERROR |
| NFR-40 | 🔴 | 架构选择 Phase 1 不用 Redis 缓存，需求要求 <200ms 需缓存 (见 BL-02) |
| NFR-41 | ✅ | 索引设计 + 分页可实现 <500ms |
| NFR-42 | ✅ | 计算简单可实现 <1s |
| NFR-43 | ✅ | OSS 上传超时 30s |
| NFR-50 | ✅ | MySQL 8.0, utf8mb4 |
| NFR-51 | ✅ | 所有表有 id/created_at/updated_at |
| NFR-52 | ✅ | deleted_at 软删除 |
| NFR-53 | ⚠️ | `3d_model_url` 以数字开头 (见 SF-01) |
| NFR-54 | ✅ | 无数据库 FOREIGN KEY |
| NFR-55 | ❌ | 架构未体现备份策略 (见 NH-01) |

### 可能超出 Phase 1 范围的设计

| 设计内容 | 评估 | 说明 |
|----------|------|------|
| Phase 2-4 扩展点（第 9 节） | ✅ 合理 | 架构预留扩展点，非代码实现，属于良好架构实践 |
| Redis 配置（第 8 节） | ⚠️ 需确认 | 配置已就绪但 Phase 1 不使用，不影响实施 |
| 所有 admin CRUD 接口 | ✅ | 需求文档 FR-15 / FR-24 列为 P1，包含在 Phase 1 |
| 限流（Throttler） | ✅ | NFR-15 P0 要求，NFR-16 P1 要求 |
| Token 刷新机制 | ✅ | FR-06 P1 要求 |

---

## 总结

### 架构亮点

1. **多租户设计优秀**：`StoreContext` + `TenantBaseRepository` + `TenantInterceptor` 三层体系完整、清晰，从数据层到请求层覆盖良好。`AsyncLocalStorage` 选型有充分的 Trade-off 分析。
2. **错误码体系完整**：分段式错误码（1xxx-5xxx）+ 自动 HTTP 状态码推导 + `BusinessException` 类设计，覆盖认证、校验、资源、业务、服务异常全场景。
3. **Trade-off 透明**：第 10 节对所有关键技术决策都有完整的备选方案和取舍分析（外键、缓存、限流存储、JWT 无状态等），体现了深思熟虑的工程决策。
4. **Phase 2-4 扩展点预留合理**：`part_code` 字段已支持分区改色、`IStorageAdapter` 接口支持新增存储后端、`store_id` 列已为多门店管理做好准备。

### 必须修改的问题（Blocker）

| 编号 | 问题 | 优先级 |
|------|------|--------|
| BL-01 | JWT Strategy 未校验店员/门店 active 状态 | 🔴 |
| BL-02 | 架构与需求在 Redis/缓存策略上不一致 | 🔴 |
| BL-03 | staff 表缺少 token_version 字段 | 🔴 |
| BL-04 | 响应格式 requestId 字段与需求不一致 | 🔴 |
| BL-05 | refresh 接口鉴权策略边界不清 | 🔴 |

### 修改后重审

架构整体质量高，模块划分合理、安全设计到位、接口定义完整。上述 Blocker 集中在安全细节、设计-需求对齐、字段遗漏三个方向。建议修改后重新提交评审，预计 5 个 Blocker 修复后可通过。

---

*评审版本：v1.0*
*评审角色：👁️ Code Reviewer*
*评审日期：2026-07-21*
