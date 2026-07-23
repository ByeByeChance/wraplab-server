# 需求文档：wraplab-server Phase 1 MVP — 核心后端 API

**状态**：In Review
**日期**：2026-07-21

**优先级定义**：
- **P0** = MVP 必须实现，缺失则业务不可用
- **P1** = MVP 应该实现，可适当延后但建议包含
- **P2** = Phase 2 及后续版本实现

---

## 一、业务场景

### 1.1 门店现状与痛点

车衣门店的销售人员在店内接待客户时，需要在平板或手机上快速完成"选车型、3D 看效果、选颜色、出报价"的完整流程。当前门店面临以下痛点：

- **数据分散**：车型参数、色卡信息散落在 Excel 表格和纸质色卡本上，销售人员需要来回翻找，效率极低。客户等了 10 分钟还没看到自己车的改色效果，体验很差。
- **方案无法追溯**：改色方案没有系统化保存。客户上周看完颜色说"回去考虑一下"，这周再来时，销售已经找不到当时的配置，只能重新选一遍，客户觉得门店不专业。
- **报价靠人工**：报价依赖销售人员手工计算（部件面积 x 颜色单价 x 材质系数），不同销售算出来的价格不一致。客户质疑"为什么上次来报 8000，这次报 8500？"。
- **门店数据混在一起**：多个门店共用同一套系统时，如果不做数据隔离，A 门店的销售可能看到 B 门店的客户方案，存在客户资源泄漏风险。

### 1.2 目标场景

Phase 1 MVP 聚焦于"选车型-全车改色-报价"的最小闭环：

> 客户王先生到店咨询宝马 3 系改色。销售小李打开小程序，选择 **宝马 > 3 系 > 2024 款 325Li**，系统加载该车型的 3D 模型。小李选中 AX 品牌的"超亮金属黄"，全车预览效果。王先生很满意，小李保存方案（记录客户姓名、电话），点击生成报价，系统自动算出总价 9,800 元。小李把报价单发给王先生，王先生当场决定下单。

### 1.3 角色定义

| 角色 | 说明 | Phase 1 权限 |
|------|------|-------------|
| 门店销售（staff） | 使用小程序为客户选色、报价的一线人员 | 查看车型/色卡数据，创建/查看/修改改色方案，生成报价单 |
| 门店店长（manager） | 管理门店信息、店员账号的负责人 | 销售全部权限 + 门店信息编辑 + 店员账号管理 |
| 平台管理员（admin） | 维护全局车型数据、色卡数据的运营人员 | 所有门店数据可见 + 车型/色卡/材质数据 CRUD |

---

## 二、用户故事

### 认证与鉴权

| ID | 角色 | 故事 |
|----|------|------|
| US-01 | 门店销售 | 作为门店销售，我想要用手机号登录系统，以便安全地访问门店专属数据 |
| US-02 | 门店销售 | 作为门店销售，我想要登录后自动关联到我的门店，以便我只能看到本门店的数据 |
| US-03 | 门店店长 | 作为门店店长，我想要创建和管理店员账号，以便控制谁可以登录系统操作 |

### 车型数据

| ID | 角色 | 故事 |
|----|------|------|
| US-10 | 门店销售 | 作为门店销售，我想要按品牌列表浏览车型，以便快速定位客户车辆的品牌 |
| US-11 | 门店销售 | 作为门店销售，我想要在选定品牌后查看该品牌下的所有车系，以便缩小车型选择范围 |
| US-12 | 门店销售 | 作为门店销售，我想要在选定车系后看到具体的车型列表（含年款、车身类型），以便精确匹配客户车辆 |
| US-13 | 平台管理员 | 作为平台管理员，我想要新增/编辑品牌、车系、车型数据（含 3D 模型 URL），以便维护车型数据库 |

### 色卡与材质

| ID | 角色 | 故事 |
|----|------|------|
| US-20 | 门店销售 | 作为门店销售，我想要查看所有色卡品牌（3M、AX、HEXIS 等），以便了解可选的颜色范围 |
| US-21 | 门店销售 | 作为门店销售，我想要查看某个色卡品牌下的所有颜色（含色值、单价），以便为客户推荐合适颜色 |
| US-22 | 门店销售 | 作为门店销售，我想要查看所有材质类型（哑光、亮面、磨砂等）及价格系数，以便向客户说明不同材质的区别和价格影响 |
| US-23 | 平台管理员 | 作为平台管理员，我想要新增/编辑色卡品牌、颜色和材质数据，以便维护颜色数据库 |

### 改色方案

| ID | 角色 | 故事 |
|----|------|------|
| US-30 | 门店销售 | 作为门店销售，我想要将选好的车型和颜色保存为一条改色方案，以便后续查看和复用 |
| US-31 | 门店销售 | 作为门店销售，我想要记录客户的姓名和电话，以便后续跟进联系 |
| US-32 | 门店销售 | 作为门店销售，我想要查看本门店所有历史改色方案，以便客户回头时可以找回之前的配置 |
| US-33 | 门店销售 | 作为门店销售，我想要修改已有方案的颜色或客户信息，以便根据客户新想法调整配置 |
| US-34 | 门店销售 | 作为门店销售，我想要删除不再需要的方案，以便保持方案列表整洁 |

### 报价单

| ID | 角色 | 故事 |
|----|------|------|
| US-40 | 门店销售 | 作为门店销售，我想要基于改色方案一键生成报价单，以便快速给客户出价 |
| US-41 | 门店销售 | 作为门店销售，我想要看到报价单的价格明细（各部件的颜色、面积、单价），以便向客户解释价格构成 |
| US-42 | 门店销售 | 作为门店销售，我想要查看历史报价单，以便追溯之前的报价记录 |

### 门店与店员管理

| ID | 角色 | 故事 |
|----|------|------|
| US-50 | 门店店长 | 作为门店店长，我想要查看和编辑本门店的基本信息（名称、地址、电话、Logo），以便保持信息准确 |
| US-51 | 门店店长 | 作为门店店长，我想要查看本门店的所有店员列表，以便了解团队情况 |
| US-52 | 门店店长 | 作为门店店长，我想要新增店员账号（姓名、手机号、角色），以便新员工可以登录系统 |
| US-53 | 门店店长 | 作为门店店长，我想要编辑店员信息或停用离职员工账号，以便管理门店权限安全 |

---

## 三、功能需求

### 模块 1：认证与授权 (Auth)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-01 | 提供手机号 + 密码登录接口，验证通过后返回 JWT token | P0 |
| FR-02 | JWT token 中必须包含 `store_id`（门店 ID）、`staff_id`（店员 ID）、`role`（角色：staff / manager / admin） | P0 |
| FR-03 | 所有业务 API（除登录接口和公开读取接口外）必须验证 JWT token 的有效性（签名、过期时间） | P0 |
| FR-04 | 后端自动从 JWT token 中提取 `store_id`，注入请求上下文，业务代码无需手动处理 | P0 |
| FR-05 | 业务查询必须基于上下文中的 `store_id` 自动过滤数据，确保门店间数据隔离 | P0 |
| FR-06 | 提供 token 刷新接口，延长登录有效期 | P1 |
| FR-07 | 角色校验：manager 及以上角色方可访问店员管理和门店编辑接口 | P1 |

### 模块 2：车型数据 (Vehicle)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-10 | 获取汽车品牌列表（字段：id、name、logo、sort_order），按 sort_order 降序排列 | P0 |
| FR-11 | 根据品牌 ID 获取该品牌下的车系列表（字段：id、name、year_start、year_end） | P0 |
| FR-12 | 根据车系 ID 获取该车系下的车型列表（字段：id、name、year、body_type、model_3d_url） | P0 |
| FR-13 | 车型数据为全局共享数据，不做门店隔离（平台管理员统一维护） | P0 |
| FR-14 | 车型数据查询接口无需鉴权（公开读取） | P0 |
| FR-15 | 提供品牌/车系/车型的 CRUD 管理接口（admin 角色专属），支持创建、编辑、删除 | P1 |
| FR-16 | 车型的 `model_3d_url` 为 NULL 时，API 返回 `null`，客户端展示"3D 模型暂未上线"占位提示，不报错、不白屏 | P0 |

### 模块 3：色卡与材质 (Color)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-20 | 获取色卡品牌列表（字段：id、name、description） | P0 |
| FR-21 | 根据色卡品牌 ID 获取该品牌下的颜色列表（字段：id、name、hex、rgb_r、rgb_g、rgb_b、price_per_m2）。颜色数据全量返回不分页——客户端需一次性加载全部颜色以支持本地搜索和颜色对比过滤 | P0 |
| FR-22 | 获取所有材质类型列表（字段：id、name、description、price_multiplier） | P0 |
| FR-23 | 色卡/颜色/材质数据为全局共享数据，不做门店隔离（平台管理员统一维护） | P0 |
| FR-24 | 提供色卡品牌/颜色/材质的 CRUD 管理接口（admin 角色专属） | P1 |

### 模块 4：改色方案 (Configuration)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-30 | 创建改色方案：必填字段为 `model_id`（车型 ID）、`color_swatch_id`（颜色 ID）、`material_id`（材质 ID）；选填字段为 `name`、`note`、`customer_name`、`customer_phone` | P0 |
| FR-31 | 创建方案时，后端自动注入当前门店的 `store_id` 和当前店员的 `staff_id`（从 JWT 提取） | P0 |
| FR-32 | Phase 1 只支持全车统一色：创建方案时自动生成一条 `part_code = 'FULL'` 的 `part_color` 记录 | P0 |
| FR-33 | 获取本门店的改色方案列表，支持分页（`page`、`size` 参数），按创建时间倒序排列 | P0 |
| FR-34 | 方案列表查询时，必须基于 `store_id` 过滤，禁止跨门店数据泄露 | P0 |
| FR-35 | 获取单个改色方案的详情，包含关联的车型信息、颜色信息、材质信息、部件配置列表 | P0 |
| FR-36 | 更新改色方案：支持修改颜色、材质、名称、备注、客户信息 | P0 |
| FR-37 | 删除改色方案：仅允许删除本门店的方案，软删除（标记 deleted_at） | P1 |
| FR-38 | 方案包含 `status` 字段：draft（草稿）、confirmed（已确认）、quoted（已报价），默认 draft | P1 |

### 模块 5：报价单 (Quote)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-40 | 基于改色方案生成报价单：传入 `configuration_id`，自动计算总价 | P0 |
| FR-41 | 价格计算公式：`总价 = SUM(各部件面积 x 颜色单价 x 材质系数)`。Phase 1 全车统一色仅 FULL 一个部件，全车标准面积暂定为 15 平方米（后续可配置） | P0 |
| FR-42 | 生成报价单时，后端自动注入 `store_id` 和 `staff_id` | P0 |
| FR-43 | 获取报价单详情：包含报价基本信息、关联的改色方案详情、部件明细、价格计算过程 | P0 |
| FR-44 | 获取本门店的报价单列表，支持分页，按生成时间倒序 | P1 |
| FR-45 | 报价单包含 `status` 字段：pending（待确认）、confirmed（已确认）、cancelled（已取消），默认 pending | P1 |
| FR-46 | 报价单生成后，自动将关联的改色方案状态更新为 `quoted` | P1 |
| FR-47 | 支持软删除报价单（DELETE），仅允许删除本门店的报价单 | P1 |

### 模块 6：门店与店员管理 (Store & Staff)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-50 | 获取本门店信息（名称、地址、电话、Logo、状态） | P1 |
| FR-51 | 更新本门店信息（仅 manager 及以上角色可操作） | P1 |
| FR-52 | 获取本门店店员列表（仅 manager 及以上角色可操作） | P1 |
| FR-53 | 创建店员账号：姓名、手机号、角色（staff / manager）、初始密码 | P1 |
| FR-54 | 编辑店员信息：姓名、角色，支持停用/启用店员账号（软删除） | P1 |
| FR-55 | 店员列表查询必须基于 `store_id` 过滤 | P1 |
| FR-56 | 平台管理员可查看/管理所有门店和店员（跨门店权限） | P1 |

### 模块 7：文件存储 (File / OSS)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-60 | 提供 OSS 文件上传接口，支持图片和 3D 模型文件（glTF/GLB 格式） | P0 |
| FR-61 | 上传成功后返回文件访问 URL，数据库仅存储 URL 字符串 | P0 |
| FR-62 | 文件上传需鉴权，限制文件大小（3D 模型上限 50MB，图片上限 10MB） | P1 |

---

## 四、非功能需求

### 4.1 多租户数据隔离

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-01 | 所有业务数据表（configuration, part_color, quote, favorite, store, staff）从 Day 1 携带 `store_id` 字段 | P0 |
| NFR-02 | 查询操作必须基于 JWT 中提取的 `store_id` 自动过滤，业务代码不感知过滤逻辑（通过 TypeORM Subscriber 或全局拦截器实现） | P0 |
| NFR-03 | 创建操作必须自动注入当前 `store_id`，禁止前端传入 `store_id` 参数 | P0 |
| NFR-04 | 车型数据（car_brand, car_series, car_model）和色卡数据（color_brand, color_swatch, material）为全局共享数据，无 store_id 字段，不做租户隔离 | P0 |

### 4.2 安全性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-10 | 所有业务 API（除公开读取接口外）必须携带有效 JWT token | P0 |
| NFR-11 | 敏感操作（店员管理、门店信息修改）需额外校验角色（manager 及以上） | P0 |
| NFR-12 | 密码存储使用 bcrypt 哈希，禁止明文存储 | P0 |
| NFR-13 | JWT secret 和数据库密码等敏感配置从环境变量读取，禁止硬编码 | P0 |
| NFR-14 | API 请求必须验证输入参数（class-validator），防止 SQL 注入和 XSS | P0 |
| NFR-15 | 登录接口限流：同一 IP 每分钟最多 10 次请求，超出返回 HTTP 429 Too Many Requests | P0 |
| NFR-16 | 业务写接口（改色方案、报价单）限流：每用户每分钟最多 30 次请求，超出返回 HTTP 429 | P1 |

### 4.3 API 规范

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-20 | 所有 API 路径使用 kebab-case，格式：`/api/v1/{resource}` | P0 |
| NFR-21 | 统一响应格式：`{ code: number, message: string, data: T, requestId: string }`，其中 `requestId` 为 UUID v4 格式的请求追踪 ID | P0 |
| NFR-22 | 分页接口统一参数：`page`（默认 1）、`size`（默认 20，最大 100），响应含 `{ list, total, page, size }` | P0 |
| NFR-23 | RESTful 语义：GET 查询、POST 创建、PUT 全量更新、PATCH 部分更新、DELETE 删除 | P0 |

### 4.4 错误处理

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-30 | 三层校验：(1) DTO class-validator 参数校验 (2) 业务逻辑校验 (3) 数据库约束校验 | P0 |
| NFR-31 | 参数校验失败返回 400，含具体字段错误信息 | P0 |
| NFR-32 | 认证失败返回 401，含 "Unauthorized" 或 "Token expired" 描述 | P0 |
| NFR-33 | 权限不足返回 403，含 "Forbidden" 描述 | P0 |
| NFR-34 | 资源不存在返回 404 | P0 |
| NFR-35 | 服务端异常返回 500，不暴露内部错误堆栈（生产环境） | P0 |
| NFR-36 | 数据库连接失败时返回 503，附带 "Service Unavailable" 描述 | P0 |

### 4.5 性能与可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-40 | 车型列表和色卡列表接口响应时间 < 200ms（高频读取，使用 Redis 缓存） | P1 |
| NFR-41 | 改色方案列表查询（分页 20 条）响应时间 < 500ms | P1 |
| NFR-42 | 报价单生成接口响应时间 < 1s | P1 |
| NFR-43 | 外部服务调用（OSS 上传）必须设置超时时间（上传 30s），超时后返回明确错误 | P1 |

### 4.6 数据库

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-50 | 数据库使用 MySQL 8.0，字符集 utf8mb4，排序规则 utf8mb4_unicode_ci | P0 |
| NFR-51 | 所有表必须有 `id`（主键，自增/雪花 ID）、`created_at`、`updated_at` 字段 | P0 |
| NFR-52 | 软删除使用 `deleted_at` 字段（datetime，NULL 表示未删除） | P1 |
| NFR-53 | 数据库列名统一使用 snake_case（如 store_id、customer_phone、part_code） | P0 |
| NFR-54 | 外键关系在业务层维护，不使用数据库级外键约束（便于分库分表扩展） | P0 |
| NFR-55 | 数据库每日自动备份，保留最近 7 天备份，备份文件存储于独立于数据库服务器的存储（如 OSS） | P1 |

---

## 五、验收标准

### 5.1 认证与鉴权

- [ ] **AC-01**：Given 一个已注册的店员账号（手机号 + 密码），When 调用 `POST /api/v1/auth/login` 传入正确凭证，Then 返回 `{ code: 0, data: { accessToken, refreshToken, expiresIn } }`，其中 accessToken 解码后包含 `store_id`、`staff_id`、`role` 字段。
- [ ] **AC-02**：Given 传入错误的手机号或密码，When 调用登录接口，Then 返回 `{ code: 401, message: "手机号或密码错误" }`。
- [ ] **AC-03**：Given JWT token 已过期（超过 `expiresIn`），When 调用任意业务 API，Then 返回 `{ code: 401, message: "Token expired" }`。
- [ ] **AC-04**：Given 请求头不携带 Authorization，When 调用需要鉴权的 API（如 `POST /api/v1/configurations`），Then 返回 `{ code: 401, message: "Unauthorized" }`。
- [ ] **AC-05**：Given JWT token 签名被篡改，When 调用业务 API，Then 返回 `{ code: 401, message: "Token invalid" }`。
- [ ] **AC-06**：Given role 为 `staff` 的店员，When 调用 `POST /api/v1/admin/staff`（需 manager 角色），Then 返回 `{ code: 403, message: "Forbidden" }`。

### 5.2 车型数据

- [ ] **AC-07**：Given 数据库中有 5 个品牌（sort_order 分别为 1-5），When `GET /api/v1/vehicles/brands`，Then 返回 5 个品牌按 sort_order 降序（5, 4, 3, 2, 1），每个品牌含 id、name、logo 字段。
- [ ] **AC-08**：Given 品牌 ID=1 下有 3 个车系，When `GET /api/v1/vehicles/series?brandId=1`，Then 返回 3 个车系，每个含 id、name、year_start、year_end 字段。
- [ ] **AC-09**：Given 车系 ID=2 下有 4 个车型，When `GET /api/v1/vehicles/models?seriesId=2`，Then 返回 4 个车型，每个含 id、name、year、body_type、model_3d_url 字段。
- [ ] **AC-10**：Given 数据库中暂无车型数据，When 查询任意车型接口，Then 返回 `{ code: 0, data: [] }`（空数组），而非错误。
- [ ] **AC-11**：Given 传入不存在的 brandId，When `GET /api/v1/vehicles/series?brandId=99999`，Then 返回 `{ code: 0, data: [] }`。
- [ ] **AC-11a**：Given 车型的 `model_3d_url` 为 NULL，When 查询该车型详情或车型列表，Then 返回数据中 `model_3d_url = null`，客户端展示"3D 模型暂未上线"占位提示而非报错或白屏。

### 5.3 色卡与材质

- [ ] **AC-12**：Given 系统有 3 个色卡品牌，When `GET /api/v1/colors/brands`，Then 返回 3 个品牌，每个含 id、name、description 字段。
- [ ] **AC-13**：Given 色卡品牌 ID=1 下有 20 个颜色，When `GET /api/v1/colors/swatches?brandId=1`，Then 返回 20 个颜色，每个含 id、name、hex、rgb_r、rgb_g、rgb_b、price_per_m2 字段。
- [ ] **AC-14**：Given 系统有 4 种材质类型，When `GET /api/v1/colors/materials`，Then 返回 4 种材质，每个含 id、name、description、price_multiplier 字段。

### 5.4 改色方案

- [ ] **AC-15**：Given 门店 A（store_id=1）的店员登录，选择了车型 model_id=10、颜色 swatch_id=20、材质 material_id=30，填写 customer_name="王先生"、customer_phone="13800138000"，When `POST /api/v1/configurations`，Then 返回 201，方案对象的 store_id=1、staff_id=当前店员ID、status="draft"，自动生成一条 part_code="FULL" 的部件颜色记录。
- [ ] **AC-16**：Given 方案创建时未填 customer_name、customer_phone，When 提交创建请求，Then 仍然创建成功（这些字段为选填），返回的方案对象中 customer_name 为 null。
- [ ] **AC-17**：Given 方案创建时缺 model_id（必填），When 提交创建请求，Then 返回 `{ code: 400, message: "model_id 不能为空" }`。
- [ ] **AC-18**：Given 门店 A（store_id=1）有 10 个方案，When `GET /api/v1/configurations?page=1&size=5`，Then 返回 `{ list: [5条], total: 10, page: 1, size: 5 }`，按 created_at 倒序排列。
- [ ] **AC-19**：Given 方案详情 ID=99 属于门店 A，门店 B（store_id=2）的店员尝试访问，When `GET /api/v1/configurations/99`，Then 返回 404（不应暴露资源属于其他门店的信息）。
- [ ] **AC-20**：Given 门店 A 的店员查询方案列表，When `GET /api/v1/configurations`，Then 返回结果中的所有方案 store_id 均为 1（门店 B 的方案不出现在结果中）。
- [ ] **AC-21**：Given 方案 ID=99 存在，When `PUT /api/v1/configurations/99` 修改颜色 swatch_id=21，Then 返回更新后的方案对象，part_color 中颜色已更新。
- [ ] **AC-22**：Given 方案 ID=99 不存在，When `GET /api/v1/configurations/99`，Then 返回 `{ code: 404, message: "改色方案不存在" }`。
- [ ] **AC-23**：Given 方案 ID=99 属于门店 A，门店 B 店员尝试删除，When `DELETE /api/v1/configurations/99`，Then 返回 404 或 403，方案不被删除。

### 5.5 报价单

- [ ] **AC-24**：Given 一个已确认的改色方案（颜色单价 300 元/m2，材质系数 1.0，全车标准面积 15 m2），When `POST /api/v1/quotes` 传入 configuration_id，Then 返回报价单，total_price = 15 * 300 * 1.0 = 4500 元，含部件明细列表。
- [ ] **AC-25**：Given 改色方案的颜色单价为 500 元/m2，材质系数为 1.5，When 生成报价单，Then total_price = 15 * 500 * 1.5 = 11250 元。
- [ ] **AC-26**：Given 报价单已生成，When `GET /api/v1/quotes/{id}`，Then 返回报价单详情，含关联的车型名称、颜色名称、材质名称、客户信息、价格明细。
- [ ] **AC-27**：Given 不存在的 configuration_id，When `POST /api/v1/quotes`，Then 返回 404。
- [ ] **AC-28**：Given 传入其他门店的 configuration_id，When 生成本门店报价单，Then 返回 404（不允许跨门店引用方案）。
- [ ] **AC-29**：Given 报价单生成成功，When 查询关联的改色方案，Then 方案 status 已自动更新为 "quoted"。
- [ ] **AC-30**：Given 门店 A 的店员查询报价单列表，When `GET /api/v1/quotes`，Then 只返回门店 A 的报价单。
- [ ] **AC-30a**：Given 报价单 ID=10 属于门店 A，门店 A 店员登录，When `DELETE /api/v1/quotes/10`，Then 返回 200，报价单被软删除（deleted_at 不为空）。
- [ ] **AC-30b**：Given 报价单 ID=10 属于门店 A，门店 B 店员登录，When `DELETE /api/v1/quotes/10`，Then 返回 404。

### 5.6 门店与店员管理

- [ ] **AC-31**：Given 门店 A 的店长（role=manager）登录，When `GET /api/v1/admin/store`，Then 返回本门店信息（name、address、phone、logo、status）。
- [ ] **AC-32**：Given 门店 A 的店长登录，When `PUT /api/v1/admin/store` 修改门店电话，Then 更新成功并返回最新门店信息。
- [ ] **AC-33**：Given 门店 A 的普通店员（role=staff）登录，When `PUT /api/v1/admin/store`，Then 返回 403 Forbidden。
- [ ] **AC-34**：Given 门店 A 的店长登录，When `GET /api/v1/admin/staff`，Then 返回本门店所有店员列表（不含已停用的店员）。
- [ ] **AC-35**：Given 门店 A 的店长登录，When `POST /api/v1/admin/staff` 传入姓名、手机号、角色=staff，Then 创建成功，返回新店员的 id、name、phone、role。
- [ ] **AC-36**：Given 创建店员时缺少手机号（必填），When 提交请求，Then 返回 400 参数校验错误。
- [ ] **AC-37**：Given 创建店员时手机号已在本门店存在，When 提交请求，Then 返回 409 "该手机号已注册"。
- [ ] **AC-38**：Given 店员 ID=5 属于门店 A，门店 A 店长登录，When `PUT /api/v1/admin/staff/5` 设置 status=disabled，Then 该店员无法再登录系统。
- [ ] **AC-39**：Given 店员 ID=5 属于门店 A，门店 B 的店长尝试编辑，When `PUT /api/v1/admin/staff/5`，Then 返回 404。

### 5.7 多租户数据隔离（综合场景）

- [ ] **AC-40**：Given 门店 A（store_id=1）创建了 5 个方案，门店 B（store_id=2）创建了 3 个方案，When 门店 A 的店员查询方案列表，Then 返回 5 条记录，均为 store_id=1；门店 B 的店员查询返回 3 条记录，均为 store_id=2。
- [ ] **AC-41**：Given 门店 A 的店员尝试在请求体中传入 `store_id: 2`，When 创建改色方案，Then 后端忽略请求中的 store_id，强制使用 JWT 中的 store_id=1。
- [ ] **AC-42**：Given 门店 A 的店员尝试 `GET /api/v1/configurations/{id}` 访问门店 B 的方案 ID，When 请求，Then 返回 404（不暴露该资源属于其他门店）。

### 5.8 异常流程

- [ ] **AC-50**：Given MySQL 数据库不可用（连接超时），When 请求任意 API，Then 返回 `{ code: 503, message: "服务暂不可用，请稍后重试" }`，不暴露数据库连接错误详情。
- [ ] **AC-51**：Given Redis 不可用（缓存服务挂了），When 请求车型列表 API，Then 降级直接查询数据库，API 正常返回（缓存降级不影响核心功能）。
- [ ] **AC-52**：Given OSS 上传超时（超过 30s），When 上传 3D 模型文件，Then 返回 `{ code: 500, message: "文件上传超时，请重试" }`。
- [ ] **AC-53**：Given 请求体包含未知字段或类型错误，When 提交 API 请求，Then 返回 400 含具体校验错误信息，不应直接抛出 500 内部错误。
- [ ] **AC-54**：Given 分页参数 `page=-1` 或 `size=999`（超过最大值 100），When 请求分页接口，Then 返回 400 参数校验错误。
- [ ] **AC-55**：Given 并发创建同一门店的方案，When 多个请求同时到达，Then 每个请求都正确创建独立方案，store_id 正确注入，无数据错乱。
- [ ] **AC-56**：Given customer_name 长度超过 100 字符，When 创建或更新改色方案，Then 返回 400 "客户姓名不能超过 100 字符"。
- [ ] **AC-57**：Given note 或 customer_name 中包含 `<script>alert(1)</script>` 等 XSS payload，When 创建或更新改色方案，Then 方案创建成功，但 `<script>` 标签被转义或过滤，存储的数据为转义后的安全文本。
- [ ] **AC-58**：Given 同一店员短时间内连续 POST 两次相同参数的创建方案请求，When 两次请求先后到达，Then 两次均创建成功（各生成独立方案记录），不做幂等性去重。若需防止误操作重复提交，由客户端侧做防抖处理。

---

## 六、数据库表结构需求

### 6.1 车型体系（全局共享，无 store_id）

**car_brand（汽车品牌）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| name | VARCHAR(100) | NOT NULL, UNIQUE | 品牌名称（如 BMW、奔驰） |
| logo | VARCHAR(500) | NULL | 品牌 Logo URL |
| sort_order | INT | NOT NULL, DEFAULT 0 | 排序权重，越大越靠前 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**car_series（车系）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| brand_id | BIGINT | NOT NULL, INDEX | 所属品牌 ID |
| name | VARCHAR(100) | NOT NULL | 车系名称（如 3系、C级） |
| year_start | INT | NULL | 起始年份 |
| year_end | INT | NULL | 结束年份 |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**car_model（车型）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| series_id | BIGINT | NOT NULL, INDEX | 所属车系 ID |
| name | VARCHAR(100) | NOT NULL | 型号名称（如 325Li M运动套装） |
| year | INT | NOT NULL | 年款（如 2024） |
| body_type | VARCHAR(50) | NULL | 车身类型（sedan/suv/hatchback/coupe） |
| model_3d_url | VARCHAR(500) | NULL | 3D 模型文件 OSS URL |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

### 6.2 色卡体系（全局共享，无 store_id）

**color_brand（色卡品牌）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| name | VARCHAR(100) | NOT NULL, UNIQUE | 色卡品牌名（3M、AX、HEXIS） |
| description | VARCHAR(500) | NULL | 品牌描述 |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**color_swatch（颜色）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| brand_id | BIGINT | NOT NULL, INDEX | 所属色卡品牌 ID |
| name | VARCHAR(100) | NOT NULL | 颜色名称（如 超亮金属黄） |
| hex | VARCHAR(7) | NOT NULL | 十六进制色值（如 #FFD700） |
| rgb_r | TINYINT UNSIGNED | NOT NULL | RGB 红色分量 (0-255) |
| rgb_g | TINYINT UNSIGNED | NOT NULL | RGB 绿色分量 (0-255) |
| rgb_b | TINYINT UNSIGNED | NOT NULL | RGB 蓝色分量 (0-255) |
| price_per_m2 | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | 每平方米单价（元） |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**material（材质）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| name | VARCHAR(100) | NOT NULL, UNIQUE | 材质名称（哑光、亮面、磨砂、变色龙） |
| description | VARCHAR(500) | NULL | 材质描述 |
| price_multiplier | DECIMAL(4,2) | NOT NULL, DEFAULT 1.00 | 价格系数（如 1.0 / 1.2 / 1.5） |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

### 6.3 业务数据（均带 store_id 多租户）

**configuration（改色方案）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| store_id | BIGINT | NOT NULL, INDEX | 所属门店 ID（多租户隔离键） |
| model_id | BIGINT | NOT NULL | 关联车型 ID |
| name | VARCHAR(200) | NULL | 方案名称 |
| note | TEXT | NULL | 备注 |
| customer_name | VARCHAR(100) | NULL | 客户姓名 |
| customer_phone | VARCHAR(20) | NULL | 客户电话 |
| status | ENUM('draft','confirmed','quoted') | NOT NULL, DEFAULT 'draft' | 方案状态 |
| staff_id | BIGINT | NOT NULL | 创建店员 ID |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**part_color（部件颜色配置）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| store_id | BIGINT | NOT NULL, INDEX | 所属门店 ID（多租户隔离键） |
| configuration_id | BIGINT | NOT NULL, INDEX | 关联方案 ID |
| part_code | VARCHAR(20) | NOT NULL | 部件编码（FULL / HOOD / ROOF / ...） |
| color_swatch_id | BIGINT | NOT NULL | 关联颜色 ID |
| material_id | BIGINT | NOT NULL | 关联材质 ID |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**quote（报价单）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| store_id | BIGINT | NOT NULL, INDEX | 所属门店 ID（多租户隔离键） |
| configuration_id | BIGINT | NOT NULL | 关联方案 ID |
| total_price | DECIMAL(12,2) | NOT NULL | 总价（元） |
| status | ENUM('pending','confirmed','cancelled') | NOT NULL, DEFAULT 'pending' | 报价状态 |
| staff_id | BIGINT | NOT NULL | 生成报价店员 ID |
| created_at | DATETIME | NOT NULL | 生成时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**store（门店）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| name | VARCHAR(200) | NOT NULL | 门店名称 |
| address | VARCHAR(500) | NULL | 门店地址 |
| phone | VARCHAR(20) | NULL | 门店电话 |
| logo | VARCHAR(500) | NULL | 门店 Logo URL |
| status | ENUM('active','inactive') | NOT NULL, DEFAULT 'active' | 门店状态 |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**staff（店员）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT PK AUTO_INCREMENT | NOT NULL | 主键 |
| store_id | BIGINT | NOT NULL, INDEX | 所属门店 ID（多租户隔离键） |
| name | VARCHAR(100) | NOT NULL | 店员姓名 |
| phone | VARCHAR(20) | NOT NULL, UNIQUE | 手机号（登录账号） |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 密码哈希 |
| role | ENUM('admin','manager','staff') | NOT NULL, DEFAULT 'staff' | 角色 |
| avatar | VARCHAR(500) | NULL | 头像 URL |
| status | ENUM('active','disabled') | NOT NULL, DEFAULT 'active' | 账号状态 |
| token_version | INT UNSIGNED | NOT NULL, DEFAULT 0 | Token 版本号，修改密码或强制下线时递增 |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

---

## 七、API 接口速览

### 7.1 共享接口（小程序 + 后台均可调用）

```
# 认证
POST   /api/v1/auth/login              # 手机号 + 密码登录
POST   /api/v1/auth/refresh            # 刷新 token

# 车型数据（公开读取）
GET    /api/v1/vehicles/brands          # 品牌列表
GET    /api/v1/vehicles/series          # 车系列表 (?brandId=)
GET    /api/v1/vehicles/models          # 车型列表 (?seriesId=)

# 色卡与材质（公开读取）
GET    /api/v1/colors/brands            # 色卡品牌列表
GET    /api/v1/colors/swatches          # 颜色列表 (?brandId=)，全量返回不分页
GET    /api/v1/colors/materials         # 材质列表

# 改色方案（需鉴权）
POST   /api/v1/configurations           # 创建改色方案
GET    /api/v1/configurations           # 方案列表 (?page=&size=)
GET    /api/v1/configurations/:id       # 方案详情
PUT    /api/v1/configurations/:id       # 更新方案
DELETE /api/v1/configurations/:id       # 删除方案

# 报价单（需鉴权）
POST   /api/v1/quotes                   # 生成报价单
GET    /api/v1/quotes                   # 报价单列表 (?page=&size=)
GET    /api/v1/quotes/:id               # 报价单详情
DELETE /api/v1/quotes/:id               # 软删除报价单

# 文件上传（需鉴权）
POST   /api/v1/files/upload             # OSS 文件上传
```

### 7.2 后台管理接口（需 manager / admin 角色）

```
# 门店管理
GET    /api/v1/admin/store              # 获取本门店信息
PUT    /api/v1/admin/store              # 更新本门店信息

# 店员管理
GET    /api/v1/admin/staff              # 店员列表
POST   /api/v1/admin/staff              # 创建店员
PUT    /api/v1/admin/staff/:id          # 编辑店员（含停用/启用）

# 车型管理
POST   /api/v1/admin/vehicles/brands    # 创建品牌
PUT    /api/v1/admin/vehicles/brands/:id # 编辑品牌
DELETE /api/v1/admin/vehicles/brands/:id # 删除品牌
POST   /api/v1/admin/vehicles/series    # 创建车系
PUT    /api/v1/admin/vehicles/series/:id # 编辑车系
DELETE /api/v1/admin/vehicles/series/:id # 删除车系
POST   /api/v1/admin/vehicles/models    # 创建车型
PUT    /api/v1/admin/vehicles/models/:id # 编辑车型
DELETE /api/v1/admin/vehicles/models/:id # 删除车型

# 色卡管理
POST   /api/v1/admin/colors/brands      # 创建色卡品牌
PUT    /api/v1/admin/colors/brands/:id   # 编辑色卡品牌
DELETE /api/v1/admin/colors/brands/:id   # 删除色卡品牌
POST   /api/v1/admin/colors/swatches    # 创建颜色
PUT    /api/v1/admin/colors/swatches/:id # 编辑颜色
DELETE /api/v1/admin/colors/swatches/:id # 删除颜色
POST   /api/v1/admin/colors/materials   # 创建材质
PUT    /api/v1/admin/colors/materials/:id # 编辑材质
DELETE /api/v1/admin/colors/materials/:id # 删除材质
```

### 7.3 统一响应格式

**成功响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**分页响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [ ... ],
    "total": 100,
    "page": 1,
    "size": 20
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**错误响应：**
```json
{
  "code": 400,
  "message": "model_id 不能为空",
  "data": null,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 7.4 HTTP 状态码约定

| 状态码 | 含义 | 场景 |
|--------|------|------|
| 200 | 成功 | GET、PUT 成功 |
| 201 | 已创建 | POST 创建成功 |
| 204 | 无内容 | DELETE 成功 |
| 400 | 请求错误 | 参数校验失败 |
| 401 | 未授权 | Token 缺失、过期、无效 |
| 403 | 禁止 | 角色权限不足 |
| 404 | 未找到 | 资源不存在 |
| 409 | 冲突 | 手机号已注册等 |
| 500 | 服务器错误 | 内部异常 |
| 503 | 服务不可用 | 数据库/外部服务不可用 |

---

## 八、不做的事

| 事项 | 原因 |
|------|------|
| 微信小程序登录（wx.login）集成 | Phase 1 使用手机号 + 密码登录，微信生态集成放 Phase 2 |
| 微信支付 / 任何在线支付 | WrapLab 定位为店内工具，交易在线下完成，无需线上支付 |
| 分区改色（多部件独立颜色） | Phase 1 仅全车统一色（part_code = FULL），分区改色为 Phase 2 功能 |
| 3D 模型渲染服务 | 3D 渲染在客户端 WebView 完成，后端仅存储和返回 3D 模型文件 URL |
| AI 生图 API 集成 | Phase 2 功能，Phase 1 聚焦选色报价核心闭环 |
| 收藏方案功能 | Phase 2 功能，与热门方案推荐一起做 |
| 完工案例社区 | Phase 3 功能 |
| 门店地图与预约 | Phase 3 功能 |
| 营销活动（优惠券、分享） | Phase 3 功能 |
| 改色历史记录（按车辆档案维度） | Phase 2 功能，Phase 1 仅提供方案列表查询 |
| 数据统计报表 / Dashboard | Phase 3 后台管理功能 |
| WebSocket / SSE 实时通信 | 当前无实时场景需求（3D 改色实时同步放 Phase 2） |
| 图形验证码 / 短信验证码 | Phase 1 使用密码登录，验证码体系放 Phase 2 配合微信手机号授权 |
| 文件管理（列表、删除） | 仅提供上传接口，文件管理放后台管理 Phase |
| 价格按门店维度覆盖 | Phase 1 全平台统一价格，门店自定义价格放 Phase 2 |
| 多语言 / 国际化 | 当前仅面向中文门店，国际化暂无需求 |
| 所有车型 3D 模型覆盖 | Phase 1 不保证所有车型都有 3D 模型，车型 `model_3d_url` 为 NULL 时客户端展示占位提示 |

---

## 九、风险与开放项

| 事项 | 状态 | 说明 |
|------|------|------|
| 全车标准面积 15 m2 是否合理 | 待确认 | 后续可改为按车型独立配置面积参数 |
| 3D 模型文件的上传和管理 | 待确认 | 初期可由平台管理员手动上传到 OSS 后填写 URL |
| 短信验证码服务商选型 | 待定 | Phase 2 登录优化时确定 |
| 车型数据初始录入量 | 待确认 | 建议 5-10 款热门车型起步 |
| 色卡数据来源 | 待确认 | 是否从色卡品牌方获取标准色值数据 |
| OSS 服务商选择 | 待定 | 阿里云 OSS vs 腾讯云 COS，需根据部署环境确定 |

---

## Phase 2 — 分区改色 + 案例库 + AI 生图 + 微信登录 + WebSocket + 短信验证码

**状态**：Draft
**日期**：2026-07-22
**角色**：PM

**优先级定义**（同 Phase 1）：
- **P0** = Phase 2 必须实现，缺失则业务不可用
- **P1** = Phase 2 应该实现，可适当延后但建议包含
- **P2** = Phase 3 及后续版本实现

---

### 一、业务场景

#### 1.1 分区改色

> Phase 1 仅支持全车统一改色（part_code = FULL）。但车衣门店实际业务中，客户经常要求不同部件使用不同颜色（如引擎盖用碳纤维纹路、车顶用亮黑、车身用哑光灰）。销售需要在同一个方案中为每个部件独立选择颜色和材质，系统自动按各部件面积分别计算价格。

#### 1.2 案例库

> 销售小李刚完成了一台保时捷 911 的哑光黑改色，效果非常惊艳。他想把这个方案发布为案例，配上实拍照片，供门店其他销售参考，也让到店客户可以浏览历史案例寻找灵感。客户也可以收藏喜欢的案例，方便后续回看。

#### 1.3 AI 生图

> 客户王先生看中了一款颜色，但在色卡上看不出真实上车效果。销售小李在方案详情页点击"生成效果图"，系统根据车型、颜色、材质自动拼装 Prompt，调用 AI 生图 API 生成一张该车型在该颜色下的逼真效果图。王先生对效果很满意，当场决定下单。

#### 1.4 微信登录

> Phase 1 使用手机号+密码登录，但在微信小程序生态中，门店店员更习惯于微信一键登录。Phase 2 新增微信登录能力，作为密码登录的补充，降低店员使用门槛。

#### 1.5 WebSocket 实时通信

> Phase 1 的 3D 渲染通过 WebView 内嵌 Three.js H5 完成，客户端与 H5 之间通过 URL hash 传参通信（单向、容量受限）。Phase 2 升级为 WebSocket 双向通信，用户在小程序中切换颜色/材质/部件时，3D 画面实时同步更新，无需手动刷新。

#### 1.6 短信验证码

> 作为密码登录和店员注册流程的补充安全手段（如忘记密码时的身份验证、新店员注册时的手机号验证），Phase 2 新增短信验证码能力。

---

### 二、用户故事

#### 分区改色

| ID | 角色 | 故事 |
|----|------|------|
| US-60 | 门店销售 | 作为门店销售，我想要查看某车型支持哪些可独立改色的部件（引擎盖、车顶、车门等），以便为客户做分区配色规划 |
| US-61 | 门店销售 | 作为门店销售，我想要为一个改色方案的不同部件分别选择颜色和材质，以便满足客户"引擎盖黑色、车身红色"的个性化需求 |
| US-62 | 门店销售 | 作为门店销售，我想要系统自动按各部件面积分别计算价格再汇总，以便报价准确反映分区改色的实际情况 |

#### 案例库

| ID | 角色 | 故事 |
|----|------|------|
| US-70 | 门店销售 | 作为门店销售，我想要浏览所有已发布的完工案例，以便为客户提供改色参考和灵感 |
| US-71 | 门店销售 | 作为门店销售，我想要按车型、颜色筛选案例，以便快速找到与客户需求匹配的参考 |
| US-72 | 门店销售（管理员） | 作为门店管理员，我想要将一个改色方案发布为案例（含实拍照片和描述），以便沉淀门店优秀作品 |
| US-73 | 门店销售 | 作为门店销售，我想要收藏感兴趣的案例，以便后续快速回看 |

#### AI 生图

| ID | 角色 | 故事 |
|----|------|------|
| US-80 | 门店销售 | 作为门店销售，我想要为改色方案生成 AI 效果图，以便客户直观看到改色后的样子 |
| US-81 | 门店销售 | 作为门店销售，我想要选择不同的生成风格（室内/户外/场景），以便满足不同展示场景 |
| US-82 | 门店销售 | 作为门店销售，我想要查看历史生成记录，以便对比不同风格的效果图 |

#### 微信登录

| ID | 角色 | 故事 |
|----|------|------|
| US-90 | 门店销售 | 作为门店销售，我想要使用微信一键登录，以便省去记忆和输入密码的麻烦 |
| US-91 | 门店店长 | 作为门店店长，我想要将店员微信号与其账号绑定，以便店员可通过微信快捷登录 |

#### WebSocket

| ID | 角色 | 故事 |
|----|------|------|
| US-100 | 门店销售 | 作为门店销售，我想要在切换颜色时 3D 画面实时同步更新，以便获得流畅的沉浸式选色体验 |

#### 短信验证码

| ID | 角色 | 故事 |
|----|------|------|
| US-110 | 门店销售 | 作为门店销售，我想要用短信验证码登录（替代密码），以便忘记密码时仍能进入系统 |

---

### 三、功能需求

#### 模块 8：分区改色 (Multi-Part Color)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-70 | 新建 `car_part` 表，存储每个车型支持的可改色部件清单（部件编码、名称、面积、排序） | P0 |
| FR-71 | 种子数据：每个车型默认拥有 FULL、HOOD、ROOF、LEFT_DOOR、RIGHT_DOOR、LEFT_FENDER、RIGHT_FENDER、TRUNK、BUMPER_FRONT、BUMPER_REAR 10 个部件 | P0 |
| FR-72 | 提供 `GET /api/v1/vehicles/models/:id/parts` — 获取指定车型的部件列表，按 sort_order 升序排列 | P0 |
| FR-73 | 支持分区改色：`part_color` 表扩展为支持任意 part_code（Phase 1 仅 FULL），每个方案的每个部件可独立选择颜色和材质 | P0 |
| FR-74 | 创建方案时，默认自动生成一条 `part_code = 'FULL'` 的记录（保持与 Phase 1 兼容）。用户可通过批更新接口拆分为多部件 | P0 |
| FR-75 | 提供 `PUT /api/v1/configurations/:id/parts` — 批更新方案的所有部件颜色配置。请求体：`{ parts: [{ part_code, color_swatch_id, material_id }] }`。该操作为全量替换（先删旧部件记录，再插入新记录），保证原子性 | P0 |
| FR-76 | 价格计算改为按部件分别计算：`总价 = SUM(各部件 area_m2 x 颜色单价 x 材质系数)` | P0 |
| FR-77 | `car_part` 数据为全局共享数据，不做门店隔离（平台管理员统一维护） | P0 |
| FR-78 | 提供 `car_part` 的 CRUD 管理接口（admin 角色专属），支持按车型增删改部件 | P1 |
| FR-79 | 分区改色方案详情响应中，`part_colors` 列表包含 `part_code`、`part_name`、`area_m2`、颜色信息、材质信息 | P0 |

#### 模块 9：案例库 (Case/Gallery)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-80 | 新建 `case` 表，存储门店发布的完工案例（标题、描述、封面图、图片集、关联方案、状态、互动数据） | P0 |
| FR-81 | 提供 `POST /api/v1/cases` — 发布一个方案为案例（需 admin/manager 角色）。请求体：`{ configuration_id, title, description, cover_image_url, images }` | P0 |
| FR-82 | 案例发布时，后端校验关联的 `configuration` 属于本门店且未被软删除 | P0 |
| FR-83 | 案例自动承袭关联方案的 `store_id`（不独立指定） | P0 |
| FR-84 | 提供 `GET /api/v1/cases` — 案例分页列表，支持筛选（`?model_id=&color_swatch_id=&status=published`），支持排序（`?sort=view_count\|like_count\|created_at`，默认 `created_at` 降序） | P0 |
| FR-85 | 提供 `GET /api/v1/cases/:id` — 案例详情，包含关联的改色方案详情 + 价格明细 + 案例本身的图文信息 + 互动数据 | P0 |
| FR-85a | 提供 `PUT /api/v1/cases/:id` — 编辑案例的标题、描述、封面图、图片集（需本门店 admin/manager 角色）。请求体：`{ title?, description?, cover_image_url?, images? }`，仅更新传入的字段 | P1 |
| FR-86 | 提供 `DELETE /api/v1/cases/:id` — 取消发布（软删除），需本门店 admin/manager 角色 | P0 |
| FR-87 | 提供 `POST /api/v1/cases/:id/like` — 点赞案例。同一店员重复点赞为幂等操作（不报错，不重复计数）。无需鉴权（游客也可点赞） | P0 |
| FR-88 | 案例列表返回 `is_liked` 布尔字段（若已登录），供前端展示点赞状态 | P1 |
| FR-89 | 案例详情查询时自动递增 `view_count`（每次 GET 详情 +1） | P1 |
| FR-90 | 案例的 `staff_id` 记录发布者，供案例列表展示发布人信息 | P0 |

#### 模块 10：收藏 (Favorite)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-91 | 新建 `favorite` 表（id, store_id, staff_id, configuration_id, created_at） | P0 |
| FR-92 | 提供 `POST /api/v1/favorites/:configId` — 收藏一个改色方案（需鉴权，自动注入 store_id、staff_id） | P0 |
| FR-93 | 重复收藏同一方案为幂等操作（不报错，不创建重复记录） | P0 |
| FR-94 | 提供 `DELETE /api/v1/favorites/:configId` — 取消收藏（需鉴权，校验属于当前店员） | P0 |
| FR-95 | 提供 `GET /api/v1/favorites` — 我的收藏列表，支持分页，按收藏时间倒序。每条数据包含关联方案的基本信息（车型名、颜色名、缩略图） | P0 |

#### 模块 11：AI 生图 (AI Image Generation)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-100 | 新建 `ai_generation` 表，存储 AI 生图任务（提示词、风格、状态、结果图 URL、错误信息） | P0 |
| FR-101 | 提供 `POST /api/v1/configurations/:id/generate-image` — 触发 AI 生图。请求体：`{ style: 'scene'\|'studio'\|'outdoor', custom_prompt?: string }`。后端异步提交任务，立即返回任务 ID 和 status=pending | P0 |
| FR-102 | Prompt 组装：后端从方案数据自动拼装（车型名称 + 颜色名称 + 材质描述 + 风格预设词），若提供 custom_prompt 则追加到末尾 | P0 |
| FR-103 | 提供 `GET /api/v1/configurations/:id/generations` — 查询某个方案的所有生图历史记录，按创建时间倒序 | P0 |
| FR-104 | 提供 `GET /api/v1/generations/:id` — 获取单个生图任务的详情（含状态和结果图 URL） | P0 |
| FR-105 | AI API 调用：后端 Service 组装 Prompt 后调用外部 AI API（初版对接 DALL-E，通过适配器模式预留扩展为 Stable Diffusion 等的能力） | P0 |
| FR-106 | 异步回调：提供 Webhook 端点 `POST /api/v1/internal/ai-callback` 接收 AI 服务商的结果回调（更新任务状态为 completed/failed，写入结果图 URL） | P0 |
| FR-107 | 回调端点需验证来源签名，防止伪造回调（签名密钥通过环境变量配置） | P1 |
| FR-108 | AI 生图失败时，记录 `error_message`，status 置为 failed，前端展示失败原因 | P0 |
| FR-109 | 生成中的任务，前端轮询 `GET /api/v1/generations/:id` 查询状态（每 3 秒一次，最多 60 次即 3 分钟超时） | P0 |

#### 模块 12：微信登录 (WeChat Login)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-110 | 提供 `POST /api/v1/auth/wechat-login` — 微信小程序登录。请求体：`{ code: string, staff_id?: number }` | P0 |
| FR-111 | 后端使用 code 调用微信 `jscode2session` 接口获取 `openid` 和 `session_key` | P0 |
| FR-112 | 通过 `openid` 查找已绑定的店员记录。若找到，生成 JWT token 返回（密码免密登录） | P0 |
| FR-113 | 若未找到已绑定的店员，且请求中提供了 `staff_id`，则校验该店员是否存在，若存在则将 openid 绑定到该店员记录（店长预先创建账号后，店员首次微信登录完成绑定） | P0 |
| FR-114 | 若未绑定且未提供 staff_id，返回特定错误码提示"请先通过手机号登录绑定微信" | P0 |
| FR-115 | Staff 表新增 `wechat_openid` 字段（VARCHAR(100), NULL, UNIQUE），存储微信 openid。已有手机号登录的店员可在个人设置中绑定微信 | P0 |
| FR-116 | 提供 `POST /api/v1/auth/bind-wechat` — 已登录店员绑定微信。请求体：`{ code: string }`。将当前店员的 `wechat_openid` 设置为 code 对应的 openid | P1 |
| FR-117 | 微信 AppID 和 AppSecret 从环境变量读取，禁止硬编码 | P0 |

#### 模块 13：WebSocket 网关

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-120 | 实现 NestJS WebSocket Gateway，端点 `/ws/3d-viewer?configurationId=:id` | P0 |
| FR-121 | 连接鉴权：客户端连接时在 query 参数中携带 JWT token，Gateway 验证 token 有效性后建立连接。无效 token 拒绝连接并返回 401 | P0 |
| FR-122 | 支持的消息类型（客户端 → 服务端）：`SET_COLOR`（设置全局颜色）、`SET_MATERIAL`（设置全局材质）、`SET_PART_COLOR`（Phase 2 分区改色：设置指定部件颜色） | P0 |
| FR-123 | 支持的消息类型（服务端 → 客户端）：`COLOR_APPLIED`（颜色已应用确认）、`MATERIAL_APPLIED`（材质已应用确认）、`PART_COLOR_APPLIED`（部件颜色已应用确认）、`MODEL_READY`（模型加载就绪通知） | P0 |
| FR-124 | WebSocket 消息格式：`{ type: string, payload: object, timestamp: number }` | P0 |
| FR-125 | 配置变更持久化：Gateway 接收到 SET_COLOR / SET_PART_COLOR 等消息后，同步更新数据库中对应 `part_color` 记录 | P0 |
| FR-126 | 多实例支持：通过 Redis Pub/Sub 实现跨实例消息广播（当服务端水平扩展为多实例时，一个实例收到的消息可广播给同房间的其他连接） | P1 |
| FR-127 | WebSocket 断开后自动清理连接资源，不影响其他用户 | P0 |

#### 模块 14：短信验证码 (SMS Code)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-130 | 新建 `sms_code` 表（id, phone, code, type, expires_at, used, created_at） | P0 |
| FR-131 | 提供 `POST /api/v1/auth/send-sms-code` — 发送登录验证码。请求体：`{ phone: string, type: 'login'\|'verify' }` | P0 |
| FR-132 | 验证码为 6 位数字，有效期 5 分钟（`expires_at = NOW() + 5 MINUTES`） | P0 |
| FR-133 | 同一手机号同一 type 的发送频率限制：60 秒内仅允许发送 1 次，超出返回 `{ code: 4003, message: "验证码发送过于频繁，请 60 秒后再试" }` | P0 |
| FR-134 | 同一手机号每天发送上限为 10 次，超出返回 429 | P1 |
| FR-135 | 短信服务商（如阿里云 SMS / 腾讯云 SMS）通过适配器模式接入，配置从环境变量读取 | P0 |
| FR-136 | 验证码使用后标记 `used = true`，防止重复使用。同一验证码最多尝试 3 次，超出作废 | P1 |

---

### 四、非功能需求（Phase 2 新增）

#### 4.7 WebSocket 性能

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-60 | WebSocket 连接建立时间 < 1s（含 JWT 鉴权） | P1 |
| NFR-61 | SET_COLOR / SET_PART_COLOR 消息处理延迟 < 100ms（消息到达 → 数据库写入 → ACK 回执） | P1 |
| NFR-62 | 单实例支持至少 500 个并发 WebSocket 连接 | P1 |

#### 4.8 AI 生图可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-70 | AI API 调用超时设置为 60s，超时后任务标记为 failed | P0 |
| NFR-71 | AI 回调接收接口必须鉴权（签名校验），防止恶意回调 | P1 |
| NFR-72 | AI 生成失败后支持重试（手动触发，非自动），重试创建新任务记录而非覆盖原记录 | P1 |

#### 4.9 微信登录安全

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-80 | `wechat_openid` 作为敏感信息，日志中必须脱敏（仅输出前 4 后 4 位） | P0 |
| NFR-81 | 微信 `session_key` 仅用于当前业务流程，不存储到数据库，不写入日志 | P0 |

---

### 五、验收标准（Phase 2）

#### 5.9 分区改色

- [ ] **AC-60**：Given 车型 ID=10 有 10 个默认部件，When `GET /api/v1/vehicles/models/10/parts`，Then 返回 10 个部件，按 sort_order 升序，每个含 part_code、part_name、area_m2、sort_order。
- [ ] **AC-61**：Given 门店 A 店员已有方案 ID=99（自动创建的 FULL 单部件方案），When `PUT /api/v1/configurations/99/parts` 传入 `{ parts: [{ part_code: "HOOD", color_swatch_id: 20, material_id: 30 }, { part_code: "ROOF", color_swatch_id: 21, material_id: 31 }] }`，Then 返回 200，方案 part_colors 更新为 2 条记录（HOOD 和 ROOF），原 FULL 记录被删除。总价按各部件面积分别计算。
- [ ] **AC-62**：Given 批更新时传入不存在的 part_code（如 "DOOR_REAR"），When `PUT /api/v1/configurations/99/parts`，Then 返回 400 "部件编码 DOOR_REAR 不存在"。
- [ ] **AC-63**：Given 方案 ID=99 属于门店 A，门店 B 店员尝试分区更新，When `PUT /api/v1/configurations/99/parts`，Then 返回 404。
- [ ] **AC-64**：Given HOOD 面积 1.5 m2、颜色单价 300 元/m2、材质系数 1.2，ROOF 面积 2.0 m2、颜色单价 500 元/m2、材质系数 1.0，When 生成报价单，Then total_price = (1.5 * 300 * 1.2) + (2.0 * 500 * 1.0) = 540 + 1000 = 1540 元。

#### 5.10 案例库

- [ ] **AC-70**：Given 门店 A 的 manager 已有一个确认方案 ID=99，When `POST /api/v1/cases` 传入 `{ configuration_id: 99, title: "哑光黑保时捷 911", description: "...", cover_image_url: "...", images: ["..."] }`，Then 返回 201，案例创建成功，store_id=1，staff_id=当前店员，status="published"，view_count=0，like_count=0。
- [ ] **AC-71**：Given 方案 ID=99 属于门店 B，门店 A 的 manager 尝试发布案例，When `POST /api/v1/cases`，Then 返回 404（不可跨门店引用方案发布案例）。
- [ ] **AC-72**：Given 数据库有 5 个已发布案例，When `GET /api/v1/cases?page=1&size=3&sort=like_count`，Then 返回按点赞数降序的 3 条案例，total=5。
- [ ] **AC-73**：Given 案例 ID=1 已存在，When `GET /api/v1/cases/1`，Then 返回案例详情，含配置详情、价格明细、view_count 自动 +1。
- [ ] **AC-74**：Given 案例 ID=1 属于门店 A，门店 A 的 manager 登录，When `DELETE /api/v1/cases/1`，Then 返回 200，案例被软删除，不再出现在列表中。
- [ ] **AC-74a**：Given 案例 ID=1 属于门店 A，门店 A 的 manager 登录，When `PUT /api/v1/cases/1` 传入 `{ title: "更新标题", description: "新描述" }`，Then 返回 200，title 和 description 已更新，cover_image_url 和 images 保持不变。
- [ ] **AC-74b**：Given 案例 ID=1 属于门店 A，门店 B 的 manager 尝试编辑，When `PUT /api/v1/cases/1`，Then 返回 404（跨门店不可编辑）。
- [ ] **AC-75**：Given 案例 ID=1 属于门店 A，门店 B 的 manager 尝试删除，When `DELETE /api/v1/cases/1`，Then 返回 404。
- [ ] **AC-76**：Given 案例 ID=1 的 like_count=5，店员首次点赞，When `POST /api/v1/cases/1/like`，Then 返回 200，like_count 变为 6。
- [ ] **AC-77**：Given 店员已点赞过案例 ID=1，再次点赞，When `POST /api/v1/cases/1/like`，Then 返回 200，like_count 仍为 6（幂等，不报错）。
- [ ] **AC-78**：Given 创建案例时缺 title（必填），When `POST /api/v1/cases`，Then 返回 400 "案例标题不能为空"。

#### 5.11 收藏

- [ ] **AC-80**：Given 门店 A 店员登录，When `POST /api/v1/favorites/99`（方案 ID=99），Then 返回 201，收藏记录创建成功，store_id=1，staff_id=当前店员。
- [ ] **AC-81**：Given 店员已收藏方案 ID=99，再次执行收藏，When `POST /api/v1/favorites/99`，Then 返回 200（幂等，不创建重复记录，不报错）。
- [ ] **AC-82**：Given 店员的收藏列表有 3 条，When `DELETE /api/v1/favorites/99`，Then 返回 200，该收藏记录被删除。
- [ ] **AC-83**：Given 方案 ID=99 未被该店员收藏，When `DELETE /api/v1/favorites/99`，Then 返回 404。
- [ ] **AC-84**：Given 店员有 5 个收藏，When `GET /api/v1/favorites?page=1&size=10`，Then 返回 5 条记录，按收藏时间倒序，每条含方案基本信息（车型名、颜色名、缩略图）。

#### 5.12 AI 生图

- [ ] **AC-90**：Given 一个已确认的方案 ID=99，车型为"宝马 3系 325Li"，颜色为"超亮金属黄"，材质为"亮面"，When `POST /api/v1/configurations/99/generate-image` 传入 `{ style: "studio" }`，Then 返回 202，data 含 `{ generation_id, status: "pending" }`。
- [ ] **AC-91**：Given AI 生成任务 ID=5 状态为 pending，When `GET /api/v1/generations/5`，Then 返回 status="pending"，result_image_url=null。
- [ ] **AC-92**：Given AI 服务商回调成功，When 查询任务 ID=5，Then 返回 status="completed"，result_image_url 为 OSS 上的图片地址。
- [ ] **AC-93**：Given AI 服务商返回错误，When 查询任务 ID=5，Then 返回 status="failed"，error_message 含具体原因。
- [ ] **AC-94**：Given 方案 ID=99 生成了 3 次图片，When `GET /api/v1/configurations/99/generations`，Then 返回 3 条记录，按创建时间倒序。
- [ ] **AC-95**：Given 方案 ID=99 不属于当前门店，When `POST /api/v1/configurations/99/generate-image`，Then 返回 404。
- [ ] **AC-96**：Given 自定义 Prompt 传入 `{ custom_prompt: "add racing stripe" }`，When 后端组装 Prompt，Then 最终 Prompt 末尾包含 "add racing stripe"。

#### 5.13 微信登录

- [ ] **AC-100**：Given 店员手机号 13800138000 已绑定微信 openid="oXXXX"，前端调用 wx.login() 获取 code，When `POST /api/v1/auth/wechat-login` 传入 `{ code: "valid_code" }`，Then 后端解析出 openid="oXXXX"，匹配到店员记录，返回 `{ accessToken, refreshToken, expiresIn }`，解码 accessToken 含 store_id=1、staff_id=5、role="staff"。
- [ ] **AC-101**：Given 店员未绑定微信，且请求中包含 `staff_id: 5`，店员 ID=5 存在且 wechat_openid 为空，When `POST /api/v1/auth/wechat-login`，Then 后端将 openid 绑定到该店员，返回 JWT token。
- [ ] **AC-102**：Given 店员未绑定微信，且请求中未提供 staff_id，When `POST /api/v1/auth/wechat-login`，Then 返回 `{ code: 1006, message: "微信未绑定，请先通过手机号登录后绑定微信" }`。
- [ ] **AC-103**：Given code 无效 (被微信服务端返回 errcode != 0)，When `POST /api/v1/auth/wechat-login`，Then 返回 `{ code: 1007, message: "微信登录失败，请重试" }`。
- [ ] **AC-104**：Given 店员已绑定微信 A，尝试用微信 B 登录，When `POST /api/v1/auth/wechat-login`，Then 返回 `{ code: 1008, message: "该微信未绑定任何账号" }`。
- [ ] **AC-105**：Given 已登录店员（手机号登录），When `POST /api/v1/auth/bind-wechat` 传入 `{ code: "valid_code" }`，Then 当前店员的 wechat_openid 被设置为对应 openid，返回 200。

#### 5.14 WebSocket

- [ ] **AC-110**：Given 有效的 JWT token 和 configurationId=99，When 客户端连接 `ws://host/ws/3d-viewer?configurationId=99&token=<JWT>`，Then 连接成功建立，服务端返回 `{ type: "CONNECTED", payload: { configurationId: 99 } }`。
- [ ] **AC-111**：Given token 无效或过期，When 客户端尝试连接 WebSocket，Then 连接被拒绝，服务端返回 `{ type: "ERROR", payload: { message: "Unauthorized" } }` 后断开连接。
- [ ] **AC-112**：Given 连接已建立，When 客户端发送 `{ type: "SET_COLOR", payload: { color_swatch_id: 21, material_id: 31 } }`，Then 服务端更新数据库中对应方案的 FULL 部件记录，返回 `{ type: "COLOR_APPLIED", payload: { color_swatch_id: 21, material_id: 31, configuration_id: 99 }, timestamp: ... }`。
- [ ] **AC-113**：Given Phase 2 分区改色，When 客户端发送 `{ type: "SET_PART_COLOR", payload: { part_code: "HOOD", color_swatch_id: 21, material_id: 31 } }`，Then 服务端更新 HOOD 部件的颜色配置，返回 `{ type: "PART_COLOR_APPLIED", payload: { part_code: "HOOD", color_swatch_id: 21, material_id: 31 } }`。
- [ ] **AC-114**：Given 方案 ID=99 不属于当前 token 的 store_id，When 连接 WebSocket，Then 连接被拒绝，返回 "Forbidden" 错误。

#### 5.15 短信验证码

- [ ] **AC-120**：Given 手机号 13800138000，最近 60 秒内未发送过验证码，When `POST /api/v1/auth/send-sms-code` 传入 `{ phone: "13800138000", type: "login" }`，Then 返回 200，短信发送成功，数据库 sms_code 表插入一条记录（code 为 6 位数字，expires_at 为 5 分钟后）。
- [ ] **AC-121**：Given 手机号 13800138000 刚在 30 秒前发送过验证码，When 再次请求发送，Then 返回 `{ code: 4003, message: "验证码发送过于频繁，请 60 秒后再试" }`。
- [ ] **AC-122**：Given 手机号格式不合法（如 "12345"），When `POST /api/v1/auth/send-sms-code`，Then 返回 400 "手机号格式不正确"。
- [ ] **AC-123**：Given 验证码已使用（used=true），When 再次用该验证码登录，Then 返回 400 "验证码已失效"。

---

### 六、数据库表结构需求（Phase 2 新增）

#### 6.4 分区改色（全局共享，无 store_id）

**car_part（车型部件）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| model_id | BIGINT UNSIGNED | NOT NULL, INDEX | 关联车型 ID（car_model） |
| part_code | VARCHAR(20) | NOT NULL | 部件编码（FULL / HOOD / ROOF / LEFT_DOOR / RIGHT_DOOR / LEFT_FENDER / RIGHT_FENDER / TRUNK / BUMPER_FRONT / BUMPER_REAR） |
| part_name | VARCHAR(100) | NOT NULL | 部件中文名（全车 / 引擎盖 / 车顶 / 左前门 / 右前门 / 左前翼子板 / 右前翼子板 / 后备箱盖 / 前保险杠 / 后保险杠） |
| area_m2 | DECIMAL(6,2) | NOT NULL, DEFAULT 0.00 | 部件面积（平方米），用于分区报价计算 |
| sort_order | INT | NOT NULL, DEFAULT 0 | 排序权重，越小越靠前 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：`UNIQUE KEY uk_model_part (model_id, part_code)` — 同一车型下部件编码唯一

**种子数据（每个车型默认 10 个部件）**：

| part_code | part_name | 默认面积 (m2) | sort_order |
|-----------|-----------|---------------|------------|
| FULL | 全车 | 15.00 | 0 |
| HOOD | 引擎盖 | 1.50 | 1 |
| ROOF | 车顶 | 2.00 | 2 |
| LEFT_DOOR | 左前门 | 1.20 | 3 |
| RIGHT_DOOR | 右前门 | 1.20 | 4 |
| LEFT_FENDER | 左前翼子板 | 0.80 | 5 |
| RIGHT_FENDER | 右前翼子板 | 0.80 | 6 |
| TRUNK | 后备箱盖 | 1.50 | 7 |
| BUMPER_FRONT | 前保险杠 | 1.00 | 8 |
| BUMPER_REAR | 后保险杠 | 1.00 | 9 |

> 注意：以上面积为参考值，实际面积随车型不同而异。初期统一使用默认值，后续可针对每款车型独立设定部件面积。

#### 6.5 案例库（带 store_id 多租户）

**case（案例）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 所属门店 ID（多租户隔离键） |
| configuration_id | BIGINT UNSIGNED | NOT NULL, INDEX | 关联方案 ID |
| title | VARCHAR(200) | NOT NULL | 案例标题 |
| description | TEXT | NULL | 案例描述 |
| cover_image_url | VARCHAR(500) | NULL | 封面图 URL |
| images | JSON | NULL | 图片集（JSON 字符串数组，如 `["url1","url2"]`） |
| status | ENUM('draft','published') | NOT NULL, DEFAULT 'published' | 案例状态 |
| view_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 浏览次数 |
| like_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 点赞次数 |
| staff_id | BIGINT UNSIGNED | NOT NULL | 发布店员 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记（取消发布） |

**索引**：
- `KEY idx_store_id (store_id)`
- `KEY idx_store_status (store_id, status)`
- `KEY idx_store_created (store_id, created_at)`
- `KEY idx_config_id (configuration_id)`
- `KEY idx_like_count (like_count)` — 支持按热门排序
- `KEY idx_view_count (view_count)` — 支持按浏览量排序
- `KEY idx_model_id_lookup (model_id)` — 注：model_id 通过 JOIN configuration 获取，此索引不在 case 表上，而在 configuration 表的 idx_model 上

**favorite（收藏）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 所属门店 ID |
| staff_id | BIGINT UNSIGNED | NOT NULL, INDEX | 收藏店员 ID |
| configuration_id | BIGINT UNSIGNED | NOT NULL, INDEX | 关联方案 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 收藏时间 |

**索引**：
- `KEY idx_store_id (store_id)`
- `KEY idx_staff_id (staff_id)`
- `KEY idx_staff_config (staff_id, configuration_id)` — 查重和快速查找
- `UNIQUE KEY uk_staff_config (staff_id, configuration_id)` — 同一店员不能重复收藏同一方案

#### 6.6 AI 生图（带 store_id 多租户）

**ai_generation（AI 生图任务）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 所属门店 ID |
| configuration_id | BIGINT UNSIGNED | NOT NULL, INDEX | 关联方案 ID |
| prompt_text | TEXT | NOT NULL | 实际使用的 Prompt 文本 |
| style | ENUM('scene','studio','outdoor') | NOT NULL | 生成风格 |
| status | ENUM('pending','processing','completed','failed') | NOT NULL, DEFAULT 'pending' | 任务状态 |
| result_image_url | VARCHAR(500) | NULL | 结果图 OSS URL |
| error_message | TEXT | NULL | 失败时的错误信息 |
| staff_id | BIGINT UNSIGNED | NOT NULL | 发起店员 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

**索引**：
- `KEY idx_store_id (store_id)`
- `KEY idx_config_id (configuration_id)`
- `KEY idx_status (status)` — 查询待处理/处理中任务
- `KEY idx_config_created (configuration_id, created_at)` — 查询某个方案的生图历史

#### 6.7 短信验证码（无 store_id）

**sms_code（短信验证码）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| phone | VARCHAR(20) | NOT NULL, INDEX | 手机号 |
| code | VARCHAR(6) | NOT NULL | 6 位验证码 |
| type | ENUM('login','verify') | NOT NULL | 验证码类型 |
| expires_at | DATETIME | NOT NULL | 过期时间（创建时间 + 5 分钟） |
| used | TINYINT(1) | NOT NULL, DEFAULT 0 | 是否已使用 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**：
- `KEY idx_phone_type (phone, type)` — 查询最近验证码和发送频率校验
- `KEY idx_expires_at (expires_at)` — 定时清理过期验证码

#### 6.8 Phase 2 对现有表的修改

**staff 表新增字段**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| wechat_openid | VARCHAR(100) | NULL, UNIQUE | 微信 openid，绑定后用于微信免密登录 |

---

### 七、API 接口速览（Phase 2 新增）

#### 7.5 分区改色

```
# 车型部件（公开读取）
GET    /api/v1/vehicles/models/:id/parts        # 获取车型部件列表

# 分区改色（需鉴权）
PUT    /api/v1/configurations/:id/parts         # 批更新方案部件颜色配置
       Body: { parts: [{ part_code, color_swatch_id, material_id }] }

# 车型部件管理（admin 专属）
POST   /api/v1/admin/vehicles/models/:id/parts  # 为车型添加部件
PUT    /api/v1/admin/vehicles/parts/:id         # 编辑部件信息（含面积）
DELETE /api/v1/admin/vehicles/parts/:id         # 删除部件
```

#### 7.6 案例库

```
# 案例浏览（公开读取）
GET    /api/v1/cases                             # 案例列表 (?page=&size=&model_id=&color_swatch_id=&sort=like_count)
GET    /api/v1/cases/:id                         # 案例详情

# 案例管理（需鉴权 + admin/manager）
POST   /api/v1/cases                             # 发布案例
DELETE /api/v1/cases/:id                         # 取消发布

# 案例互动
POST   /api/v1/cases/:id/like                    # 点赞案例（不强制鉴权）

# 收藏（需鉴权）
POST   /api/v1/favorites/:configId               # 收藏方案
DELETE /api/v1/favorites/:configId               # 取消收藏
GET    /api/v1/favorites                         # 我的收藏列表 (?page=&size=)
```

#### 7.7 AI 生图

```
# AI 生图（需鉴权）
POST   /api/v1/configurations/:id/generate-image # 触发 AI 生图
       Body: { style: "scene"|"studio"|"outdoor", custom_prompt?: string }
GET    /api/v1/configurations/:id/generations    # 方案的生图历史
GET    /api/v1/generations/:id                   # 生图任务详情/状态

# AI 回调（内部接口，无需 JWT，使用签名鉴权）
POST   /api/v1/internal/ai-callback             # AI 服务商结果回调
```

#### 7.8 微信登录

```
# 微信认证（公开）
POST   /api/v1/auth/wechat-login                 # 微信小程序登录
       Body: { code: string, staff_id?: number }
POST   /api/v1/auth/bind-wechat                  # 已登录店员绑定微信
       Body: { code: string }
```

#### 7.9 WebSocket

```
# WebSocket 网关
WS     /ws/3d-viewer?configurationId=:id&token=<JWT>

# 客户端 → 服务端 消息
{ type: "SET_COLOR",       payload: { color_swatch_id, material_id } }
{ type: "SET_PART_COLOR",  payload: { part_code, color_swatch_id, material_id } }
{ type: "SET_MATERIAL",    payload: { material_id } }

# 服务端 → 客户端 消息
{ type: "CONNECTED",         payload: { configurationId } }
{ type: "COLOR_APPLIED",     payload: { color_swatch_id, material_id, configuration_id } }
{ type: "PART_COLOR_APPLIED", payload: { part_code, color_swatch_id, material_id } }
{ type: "MATERIAL_APPLIED",  payload: { material_id } }
{ type: "MODEL_READY",      payload: { configurationId } }
{ type: "ERROR",             payload: { message, code } }
```

#### 7.10 短信验证码

```
# 短信验证码（公开）
POST   /api/v1/auth/send-sms-code                # 发送验证码
       Body: { phone: string, type: "login"|"verify" }
```

---

### 八、错误码体系（Phase 2 新增）

在现有错误码枚举中新增以下错误码：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| 1006 | WECHAT_NOT_BOUND | 400 | 微信未绑定，请先通过手机号登录后绑定微信 | 微信 openid 未关联任何店员 |
| 1007 | WECHAT_LOGIN_FAILED | 400 | 微信登录失败，请重试 | code 无效或微信服务端错误 |
| 1008 | WECHAT_ALREADY_BOUND | 400 | 该微信已绑定其他账号 | openid 已存在但属于其他店员 |
| 3004 | PART_NOT_FOUND | 404 | 部件编码不存在 | 分区改色时传入的 part_code 无效 |
| 3005 | CASE_NOT_FOUND | 404 | 案例不存在 | 案例 ID 不存在或已删除 |
| 3006 | GENERATION_NOT_FOUND | 404 | 生图任务不存在 | AI 生成任务 ID 不存在 |
| 4003 | SMS_RATE_LIMITED | 429 | 验证码发送过于频繁，请 60 秒后再试 | 短信发送频率超限 |
| 4004 | SMS_CODE_INVALID | 400 | 验证码错误或已失效 | 验证码不匹配或已过期 |
| 4005 | CONFIGURATION_NOT_CONFIRMED | 400 | 请先确认方案再发布案例 | 案例发布时方案未确认 |
| 4006 | AI_GENERATION_QUOTA_EXCEEDED | 429 | 本月 AI 生图次数已用完 | 超出每月限制（后续可配置） |
| 5004 | AI_SERVICE_ERROR | 500 | AI 服务异常，请稍后重试 | AI API 调用失败 |

---

### 九、不做的事（Phase 2 更新）

以下为 Phase 1 中标记为 Phase 2 但 Phase 2 仍不做的项，或 Phase 2 新增的排除项：

| 事项 | 原因 |
|------|------|
| 微信支付 / 任何在线支付 | WrapLab 定位为店内工具，交易在线下完成 |
| 完工案例社区（评论、分享、排行榜） | Phase 3 功能，Phase 2 仅做案例发布和点赞收藏 |
| 门店地图与预约 | Phase 3 功能 |
| 营销活动（优惠券、分享） | Phase 3 功能 |
| 数据统计报表 / Dashboard | Phase 3 后台管理功能 |
| AI 生图队列管理与优先级调度 | Phase 2 为即时调用模式，队列优化放 Phase 3 |
| 多语言 / 国际化 | 当前仅面向中文门店 |
| 所有车型 3D 模型覆盖 | 不保证所有车型都有 3D 模型 |
| 案例评论功能 | Phase 3 功能，Phase 2 仅做点赞和收藏 |
| 部件面积按实际车型精确测量 | Phase 2 使用默认面积值，精确数据录入放后续 |
| 支持多个 AI 服务商同时接入 | Phase 2 仅对接单一服务商（DALL-E），通过适配器预留扩展 |
| 短信验证码登录（替代密码登录） | Phase 2 仅提供验证码发送能力（用于辅助场景），完整的验证码登录流程放 Phase 3 |

以下从 Phase 1 的"不做的事"中移除（已在 Phase 2 实现）：

| 已移除事项 | Phase 2 实现 |
|-----------|-------------|
| ~~微信小程序登录（wx.login）集成~~ | FR-110 ~ FR-117 |
| ~~分区改色（多部件独立颜色）~~ | FR-70 ~ FR-79 |
| ~~AI 生图 API 集成~~ | FR-100 ~ FR-109 |
| ~~收藏方案功能~~ | FR-91 ~ FR-95 |
| ~~WebSocket / SSE 实时通信~~ | FR-120 ~ FR-127 |
| ~~图形验证码 / 短信验证码~~ | FR-130 ~ FR-136 |

---

### 十、风险与开放项（Phase 2）

| 事项 | 状态 | 说明 |
|------|------|------|
| DALL-E API 接入与成本评估 | 待确认 | 需确认 API 费用、生成质量、单张生成时长是否满足业务需求 |
| AI 生图 Prompt 组装策略 | 待确认 | 中文 Prompt 效果可能不如英文，需测试中英文 Prompt 的效果差异 |
| AI 生图结果图存储 | 待定 | 结果图需上传至 OSS 后存储 URL，避免外部 URL 失效 |
| 微信 openid 绑定流程 | 待确认 | 店员首次微信登录是否需要店长审批？与权限管理的交互需进一步对齐 |
| WebSocket 多实例 Redis Pub/Sub | 待定 | 初期单实例部署，多实例方案为预留设计，是否实施取决于流量规模 |
| 短信服务商选型 | 待定 | 阿里云 SMS vs 腾讯云 SMS，需根据部署环境和成本确定 |
| 部件面积精确数据来源 | 待确认 | 各车型各部件的精确面积数据如何获取（从 3D 模型计算？手工录入？） |
| 案例发布是否需要审核流程 | 待确认 | 当前设计为 manager 直接发布，未来可能需要加入内容审核 |

---

*Phase 2 需求版本：v1.0（与架构 v1.2 对齐）*
*编写角色：Product Manager*
*更新日期：2026-07-22*
*变更说明：新增 Phase 2 — 分区改色、案例库、AI 生图、微信登录、WebSocket 网关、短信验证码 6 大模块*

---

## Phase 3 — 运营模块：门店地图与预约 + 营销活动 + 数据看板 + CRM 客户管理

**状态**：Draft
**日期**：2026-07-22
**角色**：PM

**优先级定义**（同 Phase 1/2）：
- **P0** = Phase 3 必须实现，缺失则业务不可用
- **P1** = Phase 3 应该实现，可适当延后但建议包含
- **P2** = Phase 4 及后续版本实现

---

### 一、业务场景

#### 1.1 门店地图与预约

> 车衣门店通常在多个城市设有施工网点。客户在浏览案例或选色方案后，需要找到最近的门店并预约施工时间。Phase 3 建立门店地理位置管理能力，支持客户通过地图按距离搜索门店，查看门店详情（地址、电话、营业时间、服务项目），并在线预约施工时间。门店端可管理预约工单（确认、取消、改期），调度施工产能。

#### 1.2 营销活动系统

> 门店需要通过灵活的活动手段吸引客户下单，例如限时折扣、新客优惠券、满减活动等。Phase 3 建立营销活动引擎：支持定义多种折扣类型（百分比折扣、固定减免、赠品），设定活动有效期和目标门店范围，配置参与条件（新客户专属、最低订单金额门槛）。后台可追踪活动效果（曝光量、领取量、核销率、转化率），为运营决策提供数据支撑。

#### 1.3 数据统计看板

> 门店管理者需要实时掌握门店经营状况。Phase 3 建立 Dashboard API，提供门店维度的关键经营指标（日报/周报/月报）、热门车型/颜色/材质排行、销售趋势图表数据、店员业绩对比。所有数据基于门店 `store_id` 隔离，门店店长只能看到本门店数据。平台管理员可查看全平台汇总数据。

#### 1.4 CRM 客户管理

> Phase 1/2 中，客户信息以 `customer_name` 和 `customer_phone` 字段散落在改色方案中，缺少统一的客户视图。Phase 3 建立 CRM 客户管理系统，以手机号为唯一标识聚合客户档案：基本信息、名下车辆、历史改色订单、偏好标签、跟进备注。支持门店在 CRM 中维护客户关系，导入/导出客户数据。

---

### 二、用户故事

#### 门店地图与预约

| ID | 角色 | 故事 |
|----|------|------|
| US-120 | 门店销售 | 作为门店销售，我想要在后台设置门店的地理位置（经纬度、地址、营业时间），以便客户能在地图上找到我们 |
| US-121 | 客户 | 作为客户，我想要按当前位置搜索附近的门店（按距离升序），以便找到最近的可服务网点 |
| US-122 | 客户 | 作为客户，我想要查看门店的详细信息（联系电话、营业时间、服务项目），以便决定是否预约 |
| US-123 | 客户 | 作为客户，我想要在线预约施工时间（选门店、选日期、选时间段、选服务类型），以便锁定施工排期 |
| US-124 | 门店销售 | 作为门店销售，我想要查看本门店的所有预约工单列表，以便了解排期情况 |
| US-125 | 门店销售 | 作为门店销售，我想要确认/拒绝/改期客户预约，以便灵活调度施工产能 |

#### 营销活动

| ID | 角色 | 故事 |
|----|------|------|
| US-130 | 门店店长 | 作为门店店长，我想要创建营销活动（设置折扣规则、有效期、适用门店），以便吸引客户下单 |
| US-131 | 门店店长 | 作为门店店长，我想要查看活动效果数据（曝光数、领取数、核销数、转化率），以便评估活动 ROI |
| US-132 | 门店销售 | 作为门店销售，我想要在生成报价单时选择适用的营销活动，以便给客户展示优惠后价格 |

#### 数据统计看板

| ID | 角色 | 故事 |
|----|------|------|
| US-140 | 门店店长 | 作为门店店长，我想要查看本门店的日报/周报/月报（报价数、成交数、营收、转化率），以便掌握经营状况 |
| US-141 | 门店店长 | 作为门店店长，我想要查看热门车型/颜色/材质排行，以便了解客户偏好和调整备货策略 |
| US-142 | 门店店长 | 作为门店店长，我想要查看各店员的业绩数据（报价数、成交数、金额），以便进行绩效考核 |
| US-143 | 平台管理员 | 作为平台管理员，我想要查看全平台汇总的经营数据（跨门店对比），以便进行全局运营分析 |

#### CRM 客户管理

| ID | 角色 | 故事 |
|----|------|------|
| US-150 | 门店销售 | 作为门店销售，我想要查看本门店所有客户列表（姓名、电话、来店次数、最近到访），以便进行客户回访 |
| US-151 | 门店销售 | 作为门店销售，我想要查看客户详细档案（订单历史、偏好车型、偏好颜色、标签），以便提供个性化服务 |
| US-152 | 门店销售 | 作为门店销售，我想要给客户添加标签和备注，以便下次接待时快速了解客户偏好 |
| US-153 | 门店店长 | 作为门店店长，我想要导入/导出客户数据，以便进行客户迁移和数据分析 |

---

### 三、功能需求

#### 模块 15：门店地理位置 (Store Location)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-140 | 新建 `store_location` 表，扩展门店地理位置信息（经纬度、详细地址、营业时间、服务项目、门店简介） | P0 |
| FR-141 | 提供 `PUT /api/v1/admin/store/location` — 设置或更新门店地理位置信息。请求体：`{ lat: number, lng: number, address: string, business_hours: string, services: string[], description?: string }`。仅 manager 及以上角色可操作 | P0 |
| FR-142 | 提供 `GET /api/v1/admin/store/location` — 获取本门店地理位置信息（需 manager 及以上角色） | P0 |
| FR-143 | 提供 `GET /api/v1/stores/nearby` — 公共接口，按经纬度搜索附近门店。请求参数：`?lat=&lng=&radius=5000&page=&size=`。radius 单位为米，默认 5000 米（5 公里）。返回门店列表，按距离由近到远排序，每条含距离（米）字段 | P0 |
| FR-144 | 提供 `GET /api/v1/stores/:id` — 公共接口，获取门店详情（基本信息 + 地理位置 + 营业时间 + 服务项目） | P0 |
| FR-145 | 附近门店查询使用 MySQL 空间索引或 Haversine 公式计算距离，查询结果按距离升序 | P0 |
| FR-146 | 门店图片（门头照、店内环境）通过 `store_location` 表的 `images` JSON 字段存储，最多 6 张 | P1 |

#### 模块 16：预约管理 (Appointment)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-150 | 新建 `appointment` 表，存储客户预约记录（门店、客户姓名、电话、预约日期、时间段、服务类型、关联方案、状态、备注） | P0 |
| FR-151 | 提供 `POST /api/v1/appointments` — 客户在线预约。请求体：`{ store_id, customer_name, customer_phone, appointment_date, time_slot, service_type, configuration_id?, note? }`。无需鉴权（客户自助预约）。同一 IP 每 60 秒最多创建 3 个预约，超出返回 429 | P0 |
| FR-152 | `time_slot` 字段使用枚举值：`MORNING`（对应展示文案"上午 09:00-12:00"）、`AFTERNOON`（对应展示文案"下午 13:00-17:00"）、`EVENING`（对应展示文案"晚间 17:00-20:00"）。存储在数据库中为 ENUM 值，展示文案由前端映射 | P0 |
| FR-153 | `service_type` 字段使用枚举值：`FULL_WRAP`（全车改色）、`PARTIAL_WRAP`（局部改色）、`PAINT_PROTECTION`（漆面保护）、`OTHER`（其他服务） | P0 |
| FR-154 | 预约创建时，后端校验同一门店同一日期同一时间段已有预约数不超过产能上限（默认每时段 3 个预约，该值在 `store_location.daily_slot_capacity` 字段中可配） | P0 |
| FR-155 | 提供 `GET /api/v1/admin/appointments` — 门店管理员查看本门店预约列表，支持按日期范围筛选（`?from=&to=&status=&page=&size=`），需 manager 及以上角色 | P0 |
| FR-156 | 提供 `GET /api/v1/admin/appointments/:id` — 获取单个预约详情，需本门店 manager 及以上角色 | P0 |
| FR-157 | 提供 `PUT /api/v1/admin/appointments/:id` — 管理预约状态。请求体：`{ status: 'confirmed' | 'cancelled' | 'rescheduled', reschedule_date?: string, reschedule_time_slot?: string, note?: string }`（`reschedule_time_slot` 取值同 `time_slot` 枚举）。仅允许本门店 manager 及以上角色操作 | P0 |
| FR-158 | `appointment` 状态流转：`pending`（待确认）→ `confirmed`（已确认）→ `completed`（已完成）/ `cancelled`（已取消）。`confirmed` 状态可转 `rescheduled`（改期），改期时更新日期和时间段，状态保持为 `rescheduled`（便于审计追溯改期历史）。`rescheduled` 状态的预约仍可被再次确认或取消 | P0 |
| FR-159 | 提供 `GET /api/v1/admin/appointments/calendar` — 获取门店某月的预约日历视图。请求参数：`?year=&month=`。返回每天的各时段预约数（用于前端日历组件渲染或产能规划） | P1 |

| FR-159a | 提供 `GET /api/v1/appointments/service-types` — 公共接口，返回服务类型列表。Response: `{ code: 0, data: { items: [{ value: "FULL_WRAP", label: "全车改色" }, { value: "PARTIAL_WRAP", label: "局部改色" }, { value: "PAINT_PROTECTION", label: "漆面保护" }, { value: "OTHER", label: "其他服务" }] } }` | P0 |

| FR-159b | 提供 `GET /api/v1/appointments/slots?store_id=&date=` — 公共接口，获取指定门店/日期的可用时段。Response: `{ code: 0, data: { store_id, date, slots: [{ time_slot: "MORNING"\|"AFTERNOON"\|"EVENING", available: boolean, remaining: number }] } }`。`remaining` = `daily_slot_capacity - 已预约数`，`available = remaining > 0` | P0 |

| FR-159c | 提供 `GET /api/v1/appointments/mine` — 客户查看自己的预约列表（需鉴权，返回当前登录用户的预约）。支持筛选：`?status=&page=&size=`。返回按创建时间倒序排列的预约列表 | P0 |

| FR-159d | 提供 `GET /api/v1/appointments/mine/:id` — 获取客户自己的单个预约详情（需鉴权，仅返回当前用户的预约） | P0 |

| FR-159e | 提供 `PUT /api/v1/appointments/mine/:id/cancel` — 客户自助取消预约（需鉴权，仅允许取消自己的 pending/confirmed 状态的预约）。请求体：`{ reason: string }`（取消原因，最长 500 字）。成功后预约状态变为 `cancelled`，记录取消原因到 `reason` 字段 | P0 |

#### 模块 17：营销活动系统 (Marketing Campaign)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-160 | 新建 `campaign` 表，存储营销活动定义（名称、Banner 图、折扣类型、折扣值、有效期、目标门店范围、参与条件、活动状态） | P0 |
| FR-161 | 提供 `POST /api/v1/admin/campaigns` — 创建营销活动。请求体：`{ name, banner_url?, discount_type, discount_value, gift_name?, min_order_amount?, new_customer_only?, valid_from, valid_to, target_store_ids: number[], description? }`。`gift_name` 仅在 `discount_type=GIFT` 时必填。仅 manager 及以上角色可操作 | P0 |
| FR-162 | `discount_type` 枚举：`PERCENTAGE`（百分比折扣，如 8 折）、`FIXED_AMOUNT`（固定金额减免，如立减 500 元）、`GIFT`（赠品，如赠送车内清洁）。`discount_value` 含义因类型而异：PERCENTAGE 为折扣率（如 0.8）、FIXED_AMOUNT 为减免金额（元）、GIFT 为赠品价值（元），赠品名称通过 `gift_name` 字段指定 | P0 |
| FR-163 | 活动参与条件：`min_order_amount`（最低订单金额，NULL 表示无门槛）、`new_customer_only`（是否仅新客户可用，默认 false）。`target_store_ids` 指定活动适用门店范围（空数组表示全平台门店） | P0 |
| FR-164 | 提供 `GET /api/v1/admin/campaigns` — 分页查询活动列表，支持筛选（`?status=active\|expired\|disabled&page=&size=`），需本门店 manager 及以上角色 | P0 |
| FR-165 | 提供 `PUT /api/v1/admin/campaigns/:id` — 编辑活动（仅允许修改未开始或进行中的活动，已过期活动不可编辑）。请求体包含需要更新的字段 | P0 |
| FR-166 | 提供 `DELETE /api/v1/admin/campaigns/:id` — 软删除活动（仅允许删除 draft 状态的活动，已发布的活动只能禁用不能删除） | P1 |
| FR-167 | 提供 `GET /api/v1/campaigns/available` — 公共接口，获取当前门店可用的活动列表（前端展示用）。后端根据当前时间、门店 ID 自动过滤：仅返回 `status=active`、当前时间在 `[valid_from, valid_to]` 范围内、且 `target_store_ids` 包含当前门店 ID 的活动。该接口无需鉴权。**注：此接口为 Phase 3 定义，供客户端营销活动展示消费（Phase 4 不修改本接口行为，Phase 4 新增的审批流程通过 `approval_status` 控制活动是否出现在此接口返回结果中）** | P0 |
| FR-168 | 新建 `campaign_claim` 表，存储活动核销记录（门店、活动、店员、关联方案、关联报价单、折扣金额、核销时间） | P0 |
| FR-169 | 提供 `POST /api/v1/quotes/:id/apply-campaign` — 对已有报价单应用营销活动。需鉴权（本门店 staff 及以上角色）。请求体：`{ campaign_id: number }`。后端校验：(1) 活动有效且未过期 (2) 报价单属于本门店 (3) 未重复核销 (4) 若活动要求新客户，校验客户手机号是否首次在本门店消费。校验通过后计算优惠金额，在报价单中记录 `campaign_id` 和 `discount_amount` | P0 |
| FR-169b | 提供 `PUT /api/v1/quotes/:id` — 更新报价单状态。请求体：`{ status: string }`（如 `submitted` / `followed_up` / `closed` / `expired`）。仅允许本门店 manager 及以上角色操作。仅允许合法状态流转（如已成交的报价不可回退到已提交） | P1 |

| FR-170 | 提供 `GET /api/v1/admin/campaigns/:id/analytics` — 活动效果数据。返回：`{ view_count, claim_count, total_discount_amount, affected_revenue, claim_rate }`。`claim_rate = claim_count / view_count`（当 view_count > 0 时） | P1 |
| FR-171 | 活动 Banner 点击（新增 `view_count`）通过 `POST /api/v1/campaigns/:id/view` 记录，无需鉴权（前端展示时调用），用于统计曝光量。去重策略：同一 IP 在 5 分钟内对同一活动仅计 1 次曝光 | P1 |

#### 模块 18：数据统计看板 (Dashboard Analytics)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-172 | 提供 `GET /api/v1/admin/dashboard/kpi` — 门店 KPI 概览。请求参数：`?period=daily\|weekly\|monthly&date=2026-07-22`。返回：`{ total_quotes, total_confirmed, total_revenue, avg_order_value, conversion_rate, date_range: { from, to } }`。daily 为当日、weekly 为当周（周一至周日）、monthly 为当月（1 日至月底）。仅 manager 及以上角色可访问 | P0 |
| FR-173 | 提供 `GET /api/v1/admin/dashboard/trends` — 销售趋势图表数据。请求参数：`?period=daily\|weekly\|monthly&from=&to=`。返回按天/周/月聚合的 `[{ date, quote_count, confirmed_count, revenue }]` 数组 | P0 |
| FR-174 | 提供 `GET /api/v1/admin/dashboard/top-rankings` — 热门排行。请求参数：`?type=model\|color\|material&period=monthly&limit=10`。返回指定周期内排名前 N 的车型/颜色/材质及其出现次数和占比 | P0 |
| FR-175 | 提供 `GET /api/v1/admin/dashboard/staff-performance` — 店员业绩。请求参数：`?period=monthly&from=&to=`。返回本门店各店员的 `[{ staff_id, staff_name, quote_count, confirmed_count, total_revenue, avg_order_value }]` 数组 | P0 |
| FR-176 | Dashboard 所有接口基于 `store_id` 隔离，仅返回本门店的经营数据。平台管理员可通过 `?store_id=` 参数指定查询某个门店（admin 专属），不传则返回全平台汇总数据 | P0 |
| FR-177 | `revenue`（营收）统计口径：以报价单 `status=confirmed` 的 `total_price - discount_amount` 之和为准。`quote_count` 统计所有报价单数量（不限状态），`confirmed_count` 统计 `status=confirmed` 的报价单数量 | P0 |
| FR-178 | `conversion_rate` 计算公式：`confirmed_count / quote_count * 100%`（quote_count 为 0 时返回 0%） | P0 |
| FR-179 | Dashboard 查询涉及聚合计算，对高频访问的 KPI 接口使用 Redis 缓存（TTL: 5 分钟），降低数据库压力 | P1 |

#### 模块 19：CRM 客户管理 (Customer Management)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-180 | 新建 `customer` 表，存储门店维度的客户档案（姓名、手机号、车辆信息、标签、备注、来店次数、最近到访时间） | P0 |
| FR-181 | 客户唯一标识：同一门店内，手机号唯一。不同门店的同一手机号视为不同客户记录 | P0 |
| FR-182 | 客户数据自动同步：当店员创建改色方案或报价单时，若 `customer_phone` 非空且该手机号在本门店不存在，自动创建一条 `customer` 记录；若已存在，则更新 `last_visit_at` 和 `total_visits += 1`。该逻辑通过 NestJS 事件订阅者异步完成，不阻塞方案创建主流程 | P0 |
| FR-183 | 提供 `GET /api/v1/admin/customers` — 客户列表（需本门店 manager 及以上角色）。支持筛选：`?keyword=`（姓名或电话模糊搜索）、`?tag=`（标签过滤）、`?sort=last_visit_at\|total_visits\|created_at`、分页 `?page=&size=` | P0 |
| FR-184 | 提供 `GET /api/v1/admin/customers/:id` — 客户详情（需本门店 manager 及以上角色）。返回：客户基本信息 + 关联的所有改色方案（最近 20 条，按时间倒序）+ 关联的所有报价单（最近 20 条，按时间倒序）+ 标签列表 + 备注列表 | P0 |
| FR-185 | 提供 `PUT /api/v1/admin/customers/:id` — 编辑客户信息。请求体：`{ name?, vehicle_info?, tags?: string[], notes?: string }`。tags 为全量替换（传入的数组覆盖原有标签）。仅本门店 manager 及以上角色可操作 | P0 |
| FR-186 | `vehicle_info` 字段使用 JSON 格式存储车辆信息：`{ brand, series, model, year, plate_number?, color? }`。前端可填充，后端不做强校验 | P1 |
| FR-187 | 提供 `POST /api/v1/admin/customers/:id/notes` — 追加一条跟进备注。请求体：`{ content: string }`。备注存储在 `customer.notes` 字段中，格式为 JSON 数组：`[{ content, staff_id, staff_name, created_at }]`。追加时向数组头部插入新备注 | P0 |
| FR-188 | 提供 `POST /api/v1/admin/customers/import` — 批量导入客户（需本门店 manager 及以上角色）。上传 CSV 文件（字段：`name,phone,vehicle_info,tags`）。返回导入结果：`{ success_count, fail_count, errors: [{ row, reason }] }`。手机号重复的客户跳过并计入 fail | P1 |
| FR-189 | 提供 `GET /api/v1/admin/customers/export` — 导出本门店客户数据为 CSV。请求参数：`?tag=`（可选标签过滤）。返回 CSV 文件流（Content-Type: text/csv）。需本门店 manager 及以上角色 | P1 |

---

### 四、非功能需求（Phase 3 新增）

#### 4.10 地图与搜索性能

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-90 | 附近门店搜索响应时间 < 500ms（5 公里半径范围内门店数不超过 100 家的情况下） | P1 |
| NFR-91 | 门店经纬度精确到小数点后 6 位（约 0.1 米精度） | P0 |

#### 4.11 数据看板性能

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-100 | KPI 概览接口响应时间 < 1s（含 Redis 缓存命中场景） | P1 |
| NFR-101 | 热门排行查询时间范围默认一个月，超过三个月时需加 `from`/`to` 参数，后端抛 400 提示"查询时间范围不能超过 3 个月" | P1 |
| NFR-102 | Dashboard 接口限流：同一门店每 10 秒滑动窗口内最多 30 次 Dashboard API 请求，超出返回 429 | P1 |

#### 4.12 数据安全与合规

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-110 | 客户手机号在日志中脱敏（中间 4 位替换为 `****`） | P0 |
| NFR-111 | 客户数据导出操作记录审计日志（操作人、时间、导出数量、导出条件），存入 `audit_log` 表 | P1 |
| NFR-112 | 客户导入 CSV 文件大小上限 10MB，行数上限 5000 行 | P1 |

#### 4.13 预约可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-120 | 预约产能校验：同一门店同一日期同一时间段最多 3 个预约（可配置）。校验使用数据库行级锁（`SELECT ... FOR UPDATE`）防止超卖 | P0 |
| NFR-121 | 预约创建接口无需鉴权，但需通过短信验证码校验客户手机号真实性（调用 Phase 2 的短信验证码服务，type=verify） | P1 |

---

### 五、验收标准（Phase 3）

#### 5.16 门店地理位置

- [ ] **AC-130**：Given 门店 A 的店长（role=manager）登录，门店当前无地理位置记录，When `PUT /api/v1/admin/store/location` 传入 `{ lat: 31.230416, lng: 121.473701, address: "上海市黄浦区南京东路 100 号", business_hours: "09:00-18:00", services: ["FULL_WRAP", "PAINT_PROTECTION"] }`，Then 返回 200，`store_location` 记录创建成功，store_id=1。

- [ ] **AC-131**：Given 门店 A 已有地理位置记录，When `PUT /api/v1/admin/store/location` 更新地址，Then 返回 200，`store_location` 记录原地更新（不产生新记录，`store_id` 与 `store_location` 一一对应）。

- [ ] **AC-132**：Given 当前经纬度 31.230416, 121.473701（上海南京东路），半径 5000 米内有 3 家门店距其分别 1.2km、2.8km、4.5km，When `GET /api/v1/stores/nearby?lat=31.230416&lng=121.473701&radius=5000`，Then 返回 3 家门店按距离升序排列，每条含 `distance_meters` 字段分别为约 1200、2800、4500。

- [ ] **AC-133**：Given 半径 1000 米内无任何门店，When 查询附近门店，Then 返回 `{ code: 0, data: { list: [], total: 0 } }`（空数组，不报错）。

- [ ] **AC-134**：Given 门店 ID=1 存在，When `GET /api/v1/stores/1`，Then 返回门店基本信息（名称、电话、Logo）+ 地理位置信息（地址、经纬度、营业时间、服务项目、距离字段为 null 因为未传入当前定位）。

- [ ] **AC-135**：Given 普通店员（role=staff）登录，When `PUT /api/v1/admin/store/location`，Then 返回 403 Forbidden。

- [ ] **AC-135b**：Given 设置门店地理位置，When 传入 `lat=95`（超出 -90~90 范围）或 `lng=200`（超出 -180~180 范围），Then 返回 400 `"纬度范围为 -90 到 90，经度范围为 -180 到 180"`。

#### 5.17 预约管理

- [ ] **AC-136**：Given 门店 ID=1，当前日期为 2026-08-01，时段的预约数为 0（未满），When `POST /api/v1/appointments` 传入 `{ store_id: 1, customer_name: "王先生", customer_phone: "13800138000", appointment_date: "2026-08-01", time_slot: "MORNING", service_type: "FULL_WRAP" }`，Then 返回 201，预约创建成功，status="pending"，store_id=1。（注：若启用 NFR-121 短信验证码校验，则需先通过短信验证）

- [ ] **AC-136b**：Given 门店 ID=999 不存在，When `POST /api/v1/appointments` 传入 `{ store_id: 999, ... }`，Then 返回 404 `"门店不存在"`。

- [ ] **AC-137**：Given 门店 ID=1，2026-08-01 上午时段已有 3 个预约（已达产能上限），When 再创建同一时段预约，Then 返回 409 `"该时段预约已满，请选择其他时间段"`。

- [ ] **AC-138**：Given 预约时缺 customer_phone（必填），When 提交创建请求，Then 返回 400 `"联系电话不能为空"`。

- [ ] **AC-139**：Given 预约创建时 `time_slot` 传入非法值 "NIGHT"，When 提交，Then 返回 400 `"时间段无效，可选值：MORNING, AFTERNOON, EVENING"`。

- [ ] **AC-140**：Given 门店 A 的 manager 登录，门店 A 有 5 个预约（3 个 pending、2 个 confirmed），When `GET /api/v1/admin/appointments?status=pending`，Then 返回 3 条 pending 状态的预约。

- [ ] **AC-141**：Given 预约 ID=10 属于门店 A，状态为 pending，门店 A 的 manager 登录，When `PUT /api/v1/admin/appointments/10` 传入 `{ status: "confirmed" }`，Then 返回 200，预约状态变为 confirmed。

- [ ] **AC-142**：Given 预约 ID=10 属于门店 A，状态为 confirmed，When `PUT /api/v1/admin/appointments/10` 传入 `{ status: "rescheduled", reschedule_date: "2026-08-03", reschedule_time_slot: "AFTERNOON" }`，Then 返回 200，预约日期更新为 2026-08-03，时间段更新为 AFTERNOON，状态变为 `rescheduled`（保留改期记录便于审计），后续门店可再次确认该预约。

- [ ] **AC-143**：Given 预约 ID=10 属于门店 B，门店 A 的 manager 尝试确认预约，When `PUT /api/v1/admin/appointments/10`，Then 返回 404。

- [ ] **AC-144**：Given 预约 ID=10 状态为 cancelled（已取消），门店 A 的 manager 尝试再次确认，When `PUT /api/v1/admin/appointments/10` 传入 `{ status: "confirmed" }`，Then 返回 400 `"已取消的预约不可再确认"`。

#### 5.18 营销活动

- [ ] **AC-145**：Given 门店 A 的 manager 登录，When `POST /api/v1/admin/campaigns` 传入 `{ name: "新店开业 8 折", banner_url: "https://oss/banner1.jpg", discount_type: "PERCENTAGE", discount_value: 0.8, valid_from: "2026-08-01", valid_to: "2026-08-31", target_store_ids: [1, 2], min_order_amount: 3000, new_customer_only: true }`，Then 返回 201，活动创建成功，status="active"。

- [ ] **AC-146**：Given 创建活动时缺 name（必填），When 提交，Then 返回 400 `"活动名称不能为空"`。

- [ ] **AC-147**：Given 创建活动时 `discount_type=PERCENTAGE` 且 `discount_value=1.5`（折扣超过 100% 不合理），When 提交，Then 返回 400 `"百分比折扣值必须在 0.01 到 1.00 之间"`。

- [ ] **AC-147b**：Given 创建活动时 `discount_type=GIFT` 但未提供 `gift_name`（或 `gift_name` 为空字符串），When 提交，Then 返回 400 `"赠品类型活动必须填写赠品名称"`。

- [ ] **AC-147c**：Given 创建活动时 `discount_type=FIXED_AMOUNT` 且 `discount_value=0`（或负数），When 提交，Then 返回 400 `"固定金额减免必须大于 0"`。

- [ ] **AC-148**：Given 门店 A 所在门店 ID=1，当前时间在活动 A 的有效期内且 `target_store_ids` 包含 1，When `GET /api/v1/campaigns/available`，Then 返回活动 A 的完整信息（含折扣规则、适用条件）。

- [ ] **AC-149**：Given 当前时间不在活动有效期（如活动过期），When `GET /api/v1/campaigns/available`，Then 该活动不在返回结果中。

- [ ] **AC-150**：Given 报价单 ID=5 属于门店 A，活动 A（PERCENTAGE 8 折）有效，When `POST /api/v1/quotes/5/apply-campaign` 传入 `{ campaign_id: 1 }`，且报价单原价 10000 元，Then 返回报价单含 `discount_amount: 2000`（即 10000 * (1-0.8)），`final_price: 8000`。`campaign_claim` 表新增一条核销记录。

- [ ] **AC-151**：Given 活动要求新客户（`new_customer_only=true`），客户手机号 13800138000 在本门店已有消费记录，When 应用该活动，Then 返回 400 `"该活动仅限新客户参与"`。

- [ ] **AC-152**：Given 报价单已应用活动 A，再次应用活动 B，When `POST /api/v1/quotes/5/apply-campaign`，Then 返回 409 `"该报价单已参与活动 A，不可重复参加活动"`。

- [ ] **AC-152b**：Given 活动 A 的 `target_store_ids` 不包含门店 B 的 ID，门店 B 的 manager 尝试将活动 A 应用到门店 B 的报价单，When `POST /api/v1/quotes/:id/apply-campaign`，Then 返回 400 `"该活动不适用于本门店"`。

- [ ] **AC-153**：Given 活动 ID=1 为 FIXED_AMOUNT 类型（减免 500 元），报价单原价 4500 元（低于最低门槛 5000 元），When 应用活动，Then 返回 400 `"订单金额 4500 元未达到活动最低消费 5000 元"`。

#### 5.19 数据统计看板

- [ ] **AC-154**：Given 门店 A 今日已生成 10 个报价单（其中 6 个已确认，合计确认金额 48000 元），When `GET /api/v1/admin/dashboard/kpi?period=daily&date=2026-07-22`，Then 返回 `{ total_quotes: 10, total_confirmed: 6, total_revenue: 48000, avg_order_value: 8000, conversion_rate: 60.0 }`。

- [ ] **AC-155**：Given 门店 A 本月有报价数据，When `GET /api/v1/admin/dashboard/trends?period=daily&from=2026-07-01&to=2026-07-22`，Then 返回 22 条日聚合数据（7 月 1 日至 22 日），无数据日期的 `quote_count` 和 `revenue` 为 0。

- [ ] **AC-156**：Given 门店 A 本月改装最多的车型是"宝马 3系"（出现 15 次）、"奔驰 C级"（10 次）、"奥迪 A4"（5 次），When `GET /api/v1/admin/dashboard/top-rankings?type=model&period=monthly&limit=3`，Then 返回 3 条记录按出现次数降序，含 `{ model_name, count, percentage }`。

- [ ] **AC-157**：Given 门店 A 的普通店员（role=staff）登录，When `GET /api/v1/admin/dashboard/kpi`，Then 返回 403 Forbidden（Dashboard 仅 manager 及以上角色可访问）。

- [ ] **AC-157b**：Given 门店 A 的 manager 登录，When `GET /api/v1/admin/dashboard/kpi?store_id=2`（尝试查看其他门店数据），Then 返回的数据仍仅为门店 A 的数据（`store_id` 参数对非 admin 角色无效，始终返回当前 JWT 对应的门店数据，或以 400 拒绝跨门店请求）。

- [ ] **AC-158**：Given 平台管理员（role=admin）登录，When `GET /api/v1/admin/dashboard/kpi?period=monthly`，Then 返回全平台所有门店汇总的 KPI 数据。若传入 `?store_id=1`，则返回门店 1 的 KPI 数据。

- [ ] **AC-159**：Given 本月无任何报价数据（新开门店），When `GET /api/v1/admin/dashboard/kpi?period=monthly`，Then 返回 `{ total_quotes: 0, total_confirmed: 0, total_revenue: 0, avg_order_value: 0, conversion_rate: 0 }`（全零不报错）。

#### 5.20 CRM 客户管理

- [ ] **AC-160**：Given 门店 A 的销售创建了一个改色方案（customer_name="王先生", customer_phone="13800138000"），且门店 A 此前无此手机号的客户记录，When 方案创建成功，Then `customer` 表自动新增一条记录：`store_id=1, name="王先生", phone="13800138000", total_visits=1, last_visit_at=<当前时间>`。

- [ ] **AC-161**：Given 门店 A 已有客户手机号 13800138000，该客户再次创建方案，When 方案创建成功，Then 该客户记录的 `total_visits` 自增 1，`last_visit_at` 更新为当前时间。

- [ ] **AC-162**：Given 门店 A 的 manager 登录，门店有 20 个客户，When `GET /api/v1/admin/customers?page=1&size=10&sort=last_visit_at`，Then 返回按最近到访时间倒序的 10 条客户记录。

- [ ] **AC-163**：Given 客户 ID=5 属于门店 A，该客户有 3 个改色方案和 2 个报价单，When `GET /api/v1/admin/customers/5`，Then 返回客户详情，含关联方案列表（3 条）和报价单列表（2 条），以及标签和备注。

- [ ] **AC-164**：Given 门店 A 的 manager 登录，When `PUT /api/v1/admin/customers/5` 传入 `{ tags: ["VIP", "奔驰车主"], vehicle_info: { brand: "奔驰", series: "C级", year: 2025 } }`，Then 返回 200，客户 tags 被替换为 ["VIP", "奔驰车主"]，vehicle_info 已更新。

- [ ] **AC-165**：Given 门店 A 的 manager 登录，When `POST /api/v1/admin/customers/5/notes` 传入 `{ content: "客户偏好哑光材质，对光泽度要求高" }`，Then 返回 200，备注追加到客户 notes 数组头部，含 staff_id、staff_name、created_at。

- [ ] **AC-166**：Given 门店 A 的 manager 尝试导入 CSV 含 3 条新客户 + 2 条手机号重复，When `POST /api/v1/admin/customers/import`，Then 返回 `{ success_count: 3, fail_count: 2, errors: [{ row: 4, reason: "手机号 13800138000 已存在" }, ...] }`。

- [ ] **AC-167**：Given 客户 ID=5 属于门店 B，门店 A 的 manager 尝试查看，When `GET /api/v1/admin/customers/5`，Then 返回 404。

- [ ] **AC-168**：Given 方案创建时未填 `customer_phone`（或 phone 为空字符串），When 方案创建成功，Then 不触发客户自动同步（`customer_phone` 为空时跳过同步逻辑，`customer_name` 为空不影响同步触发）。

#### 5.21 运营模块异常

- [ ] **AC-169**：Given 预约日期为过去的日期（如昨天），When 创建预约，Then 返回 400 `"预约日期不能早于今天"`。

- [ ] **AC-170**：Given 活动 `valid_to` 早于 `valid_from`，When 创建活动，Then 返回 400 `"活动结束日期不能早于开始日期"`。

- [ ] **AC-171**：Given CSV 文件超过 10MB，When 导入客户，Then 返回 400 `"文件大小不能超过 10MB"`。

- [ ] **AC-172**：Given 客户手机号格式不合法（如 "12345"），When 创建方案触发自动同步，Then 不创建新客户记录（静默跳过）。

---

### 六、数据库表结构需求（Phase 3 新增）

#### 6.9 门店地理位置（与 store 一对一）

**store_location（门店地理位置）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, UNIQUE, INDEX | 所属门店 ID，与 store 表一一对应 |
| lat | DECIMAL(9,6) | NOT NULL | 纬度（-90 ~ 90） |
| lng | DECIMAL(9,6) | NOT NULL | 经度（-180 ~ 180） |
| address | VARCHAR(500) | NOT NULL | 详细地址 |
| business_hours | VARCHAR(200) | NULL | 营业时间说明（如 "09:00-18:00"） |
| services | JSON | NULL | 服务项目列表（JSON 字符串数组，如 `["FULL_WRAP","PAINT_PROTECTION"]`） |
| description | TEXT | NULL | 门店简介 |
| images | JSON | NULL | 门店图片集（JSON 字符串数组，最多 6 张） |
| daily_slot_capacity | TINYINT UNSIGNED | NOT NULL, DEFAULT 3 | 每时段预约容量上限 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `UNIQUE KEY uk_store_id (store_id)` — 每门店仅一条地理位置记录
- 经纬度查询使用 Haversine 公式（应用层计算），不依赖 MySQL 空间索引（Phase 3 初期门店量小，暂不引入空间索引）

#### 6.10 预约管理（带 store_id 多租户）

**appointment（预约记录）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 预约门店 ID |
| customer_name | VARCHAR(100) | NOT NULL | 客户姓名 |
| customer_phone | VARCHAR(20) | NOT NULL | 客户电话 |
| appointment_date | DATE | NOT NULL | 预约日期 |
| time_slot | ENUM('MORNING','AFTERNOON','EVENING') | NOT NULL | 时间段 |
| service_type | ENUM('FULL_WRAP','PARTIAL_WRAP','PAINT_PROTECTION','OTHER') | NOT NULL | 服务类型 |
| status | ENUM('pending','confirmed','cancelled','completed','rescheduled') | NOT NULL, DEFAULT 'pending' | 预约状态 |
| configuration_id | BIGINT UNSIGNED | NULL | 关联的改色方案 ID（客户已有方案时可关联） |
| staff_id | BIGINT UNSIGNED | NULL | 确认预约的店员 ID（客户自助预约时为 NULL，确认后填入） |
| note | TEXT | NULL | 客户备注/服务备注 |
| reason | VARCHAR(500) | NULL | 取消原因（取消预约时填写） |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_store_id (store_id)`
- `KEY idx_store_date (store_id, appointment_date)` — 按门店日期查询
- `KEY idx_store_date_slot (store_id, appointment_date, time_slot)` — 产能校验（同门店同日期同时段唯一性不强制，通过应用层计数校验）
- `KEY idx_phone (customer_phone)` — 按客户电话查询预约历史

#### 6.11 营销活动（带 store_id 但跨门店共享）

> 注意：`campaign` 表不直接带 `store_id`，活动的作用范围通过 `target_store_ids` JSON 字段控制。活动由平台管理员或门店 manager 创建，可面向多门店。

**campaign（营销活动）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| creator_store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 创建活动的门店 ID（记录来源） |
| name | VARCHAR(200) | NOT NULL | 活动名称 |
| banner_url | VARCHAR(500) | NULL | Banner 图片 URL |
| description | TEXT | NULL | 活动描述 |
| discount_type | ENUM('PERCENTAGE','FIXED_AMOUNT','GIFT') | NOT NULL | 折扣类型 |
| discount_value | DECIMAL(10,2) | NOT NULL | 折扣值（百分比 0.01-1.00 或固定金额 或赠品价值） |
| gift_name | VARCHAR(200) | NULL | 赠品名称（discount_type=GIFT 时必填） |
| min_order_amount | DECIMAL(12,2) | NULL | 最低订单金额门槛（NULL=无门槛） |
| new_customer_only | TINYINT(1) | NOT NULL, DEFAULT 0 | 是否仅新客户可用 |
| target_store_ids | JSON | NOT NULL | 目标门店 ID 数组（如 `[1,2,3]`，空数组 `[]` 表示全平台门店） |
| valid_from | DATETIME | NOT NULL | 有效期起始 |
| valid_to | DATETIME | NOT NULL | 有效期截止 |
| status | ENUM('draft','active','paused','expired','disabled') | NOT NULL, DEFAULT 'draft' | 活动状态 |
| view_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 曝光次数（Banner 点击量） |
| claim_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 核销次数 |
| total_discount_amount | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | 累计优惠金额 |
| staff_id | BIGINT UNSIGNED | NOT NULL | 创建店员 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_status (status)` — 按状态过滤
- `KEY idx_valid_range (valid_from, valid_to)` — 按有效期查询
- `KEY idx_creator_store (creator_store_id)` — 按创建门店查询

**campaign_claim（活动核销记录）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 核销门店 ID（多租户隔离键） |
| campaign_id | BIGINT UNSIGNED | NOT NULL, INDEX | 关联活动 ID |
| staff_id | BIGINT UNSIGNED | NOT NULL | 核销操作店员 ID |
| configuration_id | BIGINT UNSIGNED | NULL | 关联方案 ID |
| quote_id | BIGINT UNSIGNED | NOT NULL | 关联报价单 ID |
| discount_amount | DECIMAL(12,2) | NOT NULL | 实际优惠金额（元） |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 核销时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_store_id (store_id)`
- `KEY idx_campaign_id (campaign_id)`
- `KEY idx_quote_id (quote_id)`
- `UNIQUE KEY uk_quote_campaign (quote_id, campaign_id)` — 同一报价单不可重复核销同一活动

#### 6.12 CRM 客户管理（带 store_id 多租户）

**customer（客户档案）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 所属门店 ID（多租户隔离键） |
| name | VARCHAR(100) | NULL | 客户姓名 |
| phone | VARCHAR(20) | NOT NULL | 手机号（本门店内唯一） |
| vehicle_info | JSON | NULL | 车辆信息 `{ brand, series, model, year, plate_number?, color? }` |
| tags | JSON | NULL | 标签列表（JSON 字符串数组，如 `["VIP","奔驰车主","哑光偏好"]`） |
| notes | JSON | NULL | 跟进备注，JSON 数组 `[{ content, staff_id, staff_name, created_at }]` |
| total_visits | INT UNSIGNED | NOT NULL, DEFAULT 0 | 累计来店次数 |
| total_orders | INT UNSIGNED | NOT NULL, DEFAULT 0 | 累计下单次数（报价单 confirmed 计数） |
| total_spent | DECIMAL(14,2) | NOT NULL, DEFAULT 0 | 累计消费金额（元） |
| last_visit_at | DATETIME | NULL | 最近到访时间 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_store_id (store_id)`
- `UNIQUE KEY uk_store_phone (store_id, phone)` — 门店内手机号唯一
- `KEY idx_store_last_visit (store_id, last_visit_at)` — 按最近到访排序
- `KEY idx_store_visits (store_id, total_visits)` — 按到访次数排序
- `KEY idx_store_spent (store_id, total_spent)` — 按消费金额排序

---

### 七、API 接口速览（Phase 3 新增）

#### 7.11 门店地图与预约

```
# 门店地理位置（公共读取）
GET    /api/v1/stores/nearby                      # 附近门店搜索 (?lat=&lng=&radius=5000&page=&size=)
GET    /api/v1/stores/:id                         # 门店详情（含地理位置）

# 门店地理位置（后台管理，需 manager 及以上）
GET    /api/v1/admin/store/location               # 获取本门店地理位置
PUT    /api/v1/admin/store/location               # 设置/更新门店地理位置
       Body: { lat, lng, address, business_hours, services, description?, images? }

# 预约（公共）
POST   /api/v1/appointments                       # 客户在线预约
       Body: { store_id, customer_name, customer_phone, appointment_date, time_slot, service_type, configuration_id?, note? }
GET    /api/v1/appointments/service-types          # 获取服务类型列表
GET    /api/v1/appointments/slots                  # 可用时段查询 (?store_id=&date=)

# 预约（客户自助，需鉴权）
GET    /api/v1/appointments/mine                   # 我的预约列表 (?status=&page=&size=)
GET    /api/v1/appointments/mine/:id               # 我的预约详情
PUT    /api/v1/appointments/mine/:id/cancel        # 取消预约
       Body: { reason }

# 预约管理（后台，需 manager 及以上）
GET    /api/v1/admin/appointments                 # 预约列表 (?from=&to=&status=&page=&size=)
GET    /api/v1/admin/appointments/:id             # 预约详情
PUT    /api/v1/admin/appointments/:id             # 管理预约状态
       Body: { status: "confirmed"|"cancelled"|"rescheduled", reschedule_date?, reschedule_time_slot?, note? }
GET    /api/v1/admin/appointments/calendar        # 预约日历视图 (?year=&month=)
```

#### 7.12 营销活动

```
# 营销活动（公共读取）
GET    /api/v1/campaigns/available                # 获取当前门店可用活动列表
POST   /api/v1/campaigns/:id/view                 # 记录活动曝光（Banner 点击）

# 活动核销（需鉴权）
POST   /api/v1/quotes/:id/apply-campaign          # 对报价单应用活动
       Body: { campaign_id }

# 报价单状态管理（需鉴权，manager 及以上）
PUT    /api/v1/quotes/:id                          # 更新报价单状态
       Body: { status }

# 活动管理（后台，需 manager 及以上）
POST   /api/v1/admin/campaigns                    # 创建活动
       Body: { name, banner_url?, discount_type, discount_value, gift_name?, min_order_amount?, new_customer_only?, valid_from, valid_to, target_store_ids: number[], description? }
       # gift_name 仅在 discount_type=GIFT 时必填
GET    /api/v1/admin/campaigns                    # 活动列表 (?status=&page=&size=)
PUT    /api/v1/admin/campaigns/:id                # 编辑活动
       Body: { name?, banner_url?, description?, discount_value?, ... }
DELETE /api/v1/admin/campaigns/:id                # 删除活动（仅 draft 状态）
GET    /api/v1/admin/campaigns/:id/analytics      # 活动效果数据
```

#### 7.13 数据统计看板

```
# 数据看板（后台，需 manager 及以上）
GET    /api/v1/admin/dashboard/kpi                # KPI 概览 (?period=daily|weekly|monthly&date=)
GET    /api/v1/admin/dashboard/trends             # 销售趋势 (?period=daily|weekly|monthly&from=&to=)
GET    /api/v1/admin/dashboard/top-rankings       # 热门排行 (?type=model|color|material&period=monthly&limit=10)
GET    /api/v1/admin/dashboard/staff-performance  # 店员业绩 (?period=monthly&from=&to=)
```

#### 7.14 CRM 客户管理

```
# 客户管理（后台，需 manager 及以上）
GET    /api/v1/admin/customers                    # 客户列表 (?keyword=&tag=&sort=last_visit_at&page=&size=)
GET    /api/v1/admin/customers/:id                # 客户详情
PUT    /api/v1/admin/customers/:id                # 编辑客户信息
       Body: { name?, vehicle_info?, tags?, notes? }
POST   /api/v1/admin/customers/:id/notes          # 追加跟进备注
       Body: { content }
POST   /api/v1/admin/customers/import             # 导入客户（multipart/form-data, CSV 文件）
GET    /api/v1/admin/customers/export             # 导出客户 CSV (?tag=)
```

---

### 八、错误码体系（Phase 3 新增）

在现有错误码枚举中新增以下错误码：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| 3007 | STORE_LOCATION_NOT_FOUND | 404 | 门店地理位置信息不存在 | 门店未设置地理位置 |
| 3007b | STORE_NOT_FOUND | 404 | 门店不存在 | 预约时传入的 store_id 不存在 |
| 3008 | APPOINTMENT_NOT_FOUND | 404 | 预约不存在 | 预约 ID 不存在或已删除 |
| 3009 | SLOT_FULL | 409 | 该时段预约已满，请选择其他时间段 | 预约产能已满 |
| 3010 | APPOINTMENT_DATE_INVALID | 400 | 预约日期不能早于今天 | 预约日期不合法 |
| 3011 | APPOINTMENT_CANCELLED | 400 | 已取消的预约不可再确认 | 状态流转校验 |
| 3012 | CAMPAIGN_NOT_FOUND | 404 | 活动不存在 | 活动 ID 不存在或已删除 |
| 3013 | CAMPAIGN_EXPIRED | 400 | 活动已过期，不可应用 | 活动有效期已过 |
| 3014 | CAMPAIGN_ALREADY_CLAIMED | 409 | 该报价单已参与活动，不可重复参加 | 重复核销校验 |
| 3015 | CAMPAIGN_MIN_AMOUNT_NOT_MET | 400 | 订单金额未达到活动最低消费 | 最低金额门槛未满足 |
| 3016 | CAMPAIGN_NEW_CUSTOMER_ONLY | 400 | 该活动仅限新客户参与 | 客户非首次消费 |
| 3017 | CUSTOMER_NOT_FOUND | 404 | 客户不存在 | 客户 ID 不存在或不属于本门店 |
| 4007 | IMPORT_FILE_TOO_LARGE | 400 | 文件大小不能超过 10MB | CSV 导入文件超标 |
| 4008 | IMPORT_ROW_LIMIT_EXCEEDED | 400 | 单次导入不能超过 5000 行 | CSV 行数超标 |
| 4009 | CAMPAIGN_INVALID_DISCOUNT | 400 | 折扣值不合法 | discount_value 超出允许范围 |
| 5005 | APPOINTMENT_CAPACITY_ERROR | 500 | 产能校验异常，请重试 | 并发校验失败 |

---

### 九、不做的事（Phase 3 更新）

以下为 Phase 1/2 中标记为 Phase 3 但仍不做或 Phase 3 新增的排除项：

| 事项 | 原因 |
|------|------|
| 微信支付 / 任何在线支付 | WrapLab 定位为店内工具，交易在线下完成 |
| 多语言 / 国际化 | 当前仅面向中文门店 |
| 所有车型 3D 模型覆盖 | 不保证所有车型都有 3D 模型 |
| 案例评论功能 | Phase 4 社区功能 |
| 案例排行榜 / 分享 | Phase 4 社区功能 |
| AI 生图队列管理与优先级调度 | Phase 3 仍为即时调用模式，队列优化放 Phase 4 |
| 支持多个 AI 服务商同时接入 | Phase 3 仅维持单一服务商 |
| 短信验证码登录（替代密码登录） | Phase 3 仅提供验证码用于预约校验和辅助身份验证 |
| 部件面积按实际车型精确测量 | 仍使用默认值 |
| AR 预览 | Phase 4 功能 |
| 在线支付预约定金 | 线下交易模式，暂不引入线上支付 |
| 营销活动自动定时发布/下架 | Phase 3 手动管理活动状态，定时调度放 Phase 4 |
| 门店地图导航跳转（调用高德/腾讯地图 App） | 客户端功能，后端提供经纬度，客户端自行实现导航 |
| 数据看板导出 PDF/Excel | Phase 4 功能，Phase 3 仅提供 JSON API |
| 客户合并/去重（同一手机号跨门店） | Phase 3 客户数据按门店隔离，暂不支持跨门店合并 |
| 客户生日/纪念日提醒 | Phase 4 CRM 增强功能 |
| 店员与客户绑定（专属销售） | Phase 4 CRM 增强功能 |

以下从 Phase 2 的"不做的事"中移除（已在 Phase 3 实现）：

| 已移除事项 | Phase 3 实现 |
|-----------|-------------|
| ~~门店地图与预约~~ | FR-140 ~ FR-159 |
| ~~营销活动（优惠券、分享）~~ | FR-160 ~ FR-171 |
| ~~数据统计报表 / Dashboard~~ | FR-172 ~ FR-179 |
| ~~完工案例社区（评论、分享、排行榜）~~ | 部分实现：案例审核上架（见 Phase 2），评论/分享/排行榜仍放 Phase 4 |

---

### 十、风险与开放项（Phase 3）

| 事项 | 状态 | 说明 |
|------|------|------|
| 附近门店搜索是否需要接入第三方地图 API（高德/腾讯） | 待确认 | 当前采用 Haversine 公式直接计算，数据量小时可满足需求。若门店量增长至数千家，需考虑接地图服务的地理编码和 POI 搜索 |
| 预约产能管理是否需要考虑施工时长 | 待确认 | 当前仅按时间段计数，未考虑不同服务类型的施工时长差异。全车改色可能需要整天，局部改色仅需半天。后续可引入时间槽粒度更细的排期系统 |
| 营销活动是否需要审批流程 | 待确认 | 当前设计为门店 manager 直接创建生效。若需总部审批，需增加审批状态机和工作流 |
| 营销活动预算与费用监控 | 待定 | 当前仅提供核销数据统计，未设置活动总预算和超预算告警 |
| Dashboard 数据是否接入 BI 工具（如 Metabase） | 待定 | 当前仅提供 JSON API 供 Admin 前端展示。若需复杂报表，可考虑对接 BI 工具直接读取数据库 |
| CRM 客户数据是否需要对接企业微信/钉钉 | 待定 | 当前仅在后端维护客户数据，未与外部通讯工具打通。若门店使用企业微信管理客户，需考虑数据同步 |
| 客户数据跨门店迁移（门店合并/拆分场景） | 待定 | Phase 3 不支持客户数据跨门店合并，门店拆分/合并时的数据处理策略待定 |
| Dashboard 缓存策略 | 待定 | Redis 缓存 TTL 暂定 5 分钟，可能造成数据展示轻微延迟。若门店运营需要实时数据，可缩短 TTL 或引入主动失效机制 |
| JSON 字段查询性能 | 待关注 | `campaign.target_store_ids` 使用 JSON 字段存储门店范围，`campaigns/available` 接口需对每行执行 `JSON_CONTAINS` 判断当前门店是否在活动范围内。门店量少（< 1000 家）时可接受全表扫描 + 应用层过滤，门店量增长后建议改为多对多中间表 `campaign_stores(campaign_id, store_id)` 以利用索引 |

---

*Phase 3 需求版本：v1.0*
*编写角色：Product Manager*
*更新日期：2026-07-22*
*变更说明：新增 Phase 3 — 门店地图与预约、营销活动系统、数据统计看板、CRM 客户管理 4 大运营模块*

---

## Phase 4 — 社区化 + 智能化 + 精细化运营

**状态**：Draft
**日期**：2026-07-22
**角色**：PM

**优先级定义**（同 Phase 1/2/3）：
- **P0** = Phase 4 必须实现，缺失则业务不可用
- **P1** = Phase 4 应该实现，可适当延后但建议包含
- **P2** = Phase 4 后续版本实现

---

### 一、业务场景

#### 1.1 案例社区化

> Phase 2 实现了案例的发布、浏览和点赞收藏，但缺少互动深度。Phase 4 将案例模块升级为完整的轻社区：用户可对案例发表评论和回复，形成讨论氛围；按热度排行的案例榜单激励门店产出优质内容；一键生成分享卡片（含小程序码），便于门店销售通过微信传播案例引流。

#### 1.2 营销活动自动化

> Phase 3 的营销活动需店长手动上下架，运营效率低。Phase 4 引入定时调度和审批机制：活动可预设生效/失效时间，由系统 Cron 定时任务自动切换状态；门店 manager 创建的活动需经总部 admin 审批通过后方可生效，保障活动质量和合规性。

#### 1.3 CRM 精细化运营

> Phase 3 建了客户档案基础 CRUD。Phase 4 深化 CRM 能力：同一手机号跨门店客户数据合并去重（门店合并/拆分场景）；客户生日/纪念日自动提醒推动店员回访；将客户分配给指定店员形成专属服务关系；通过 Webhook 将客户动态推送至企业微信/钉钉群，打通门店现有通讯工具。

#### 1.4 AI 生图体验升级

> Phase 2 的 AI 生图为即时调用模式——高峰期大量并发请求可能导致 API 限流或超时。Phase 4 将生图改为队列模式（Bull + Redis），支持排队、优先级调度和并发控制，提升系统稳定性和用户体验。同时引入部件面积精确计算，根据实际车型数据动态获取各部件面积，替代 Phase 1 以来固定的 15m² 估算值。

#### 1.5 验证与安全增强

> Phase 2 已实现短信验证码发送能力，但仅用于辅助场景。Phase 4 完成两个高优先级安全需求：(1) 预约创建时通过短信验证码校验客户手机号真实性（NFR-121 P1 提升至 P0）；(2) 完整的短信验证码登录流程，作为密码登录的替代方案，降低店员使用门槛。

#### 1.6 数据导出与分析

> Phase 3 的 Dashboard 仅提供 JSON API 供 Admin 前端展示。Phase 4 新增 Dashboard 数据导出为 PDF/Excel 的能力，满足门店管理者离线分析、打印报表、向上汇报的需求。同时支持门店合并/拆分时的客户数据批量迁移。

#### 1.7 AR 实时预览

> 在真实车辆上叠加改色效果预览是车衣行业的终极体验。Phase 4 通过 WebView 嵌入 AR 能力（基于 WebXR / 小程序 AR API），将选中的改色方案叠加到摄像头实时画面中的车辆上，让客户"所见即所得"。

---

### 二、用户故事

#### 案例评论

| ID | 角色 | 故事 |
|----|------|------|
| US-160 | 门店销售 | 作为门店销售，我想要在案例详情页发表评论（文字内容），以便与其他销售交流改色心得 |
| US-161 | 门店销售 | 作为门店销售，我想要回复他人的评论，以便进行深入讨论 |
| US-162 | 门店销售 | 作为门店销售，我想要删除自己发表的评论，以便撤回不当言论 |
| US-163 | 平台管理员 | 作为平台管理员，我想要审核评论内容（通过/拒绝/删除），以便维护社区内容质量 |

#### 案例排行榜

| ID | 角色 | 故事 |
|----|------|------|
| US-164 | 门店销售 | 作为门店销售，我想要查看按热度排行的案例榜单（日榜/周榜/月榜），以便了解当前流行趋势 |
| US-165 | 门店销售 | 作为门店销售，我想要按不同维度（点赞数/浏览量/评论数）排序案例，以便从不同角度发现优质内容 |

#### 案例分享

| ID | 角色 | 故事 |
|----|------|------|
| US-166 | 门店销售 | 作为门店销售，我想要生成案例分享卡片（含案例封面 + 小程序码），以便分享到微信好友和朋友圈引流 |

#### 营销增强

| ID | 角色 | 故事 |
|----|------|------|
| US-170 | 门店店长 | 作为门店店长，我想要为活动设置自动生效和失效时间，以便活动按时自动上下架无需人工操作 |
| US-171 | 门店店长 | 作为门店店长，我想要将创建的活动提交总部审批，以便确保活动合规 |
| US-172 | 平台管理员 | 作为平台管理员，我想要审批门店提交的活动（通过/拒绝），以便控制全平台活动质量 |

#### CRM 增强

| ID | 角色 | 故事 |
|----|------|------|
| US-180 | 门店店长 | 作为门店店长，我想要合并同一手机号跨门店的重复客户数据，以便门店合并时客户数据不丢失 |
| US-181 | 门店销售 | 作为门店销售，我想要收到客户生日/纪念日的自动提醒，以便主动关怀客户促进复购 |
| US-182 | 门店店长 | 作为门店店长，我想要将客户分配给指定店员作为专属销售，以便责任到人提升服务质量 |
| US-183 | 门店店长 | 作为门店店长，我想要客户动态自动推送到企业微信/钉钉群，以便团队及时掌握客户动向 |

#### 智能增强

| ID | 角色 | 故事 |
|----|------|------|
| US-190 | 门店销售 | 作为门店销售，我想要 AI 生图任务排队执行而非即时超时，以便高峰期也能稳定生成效果图 |
| US-191 | 门店销售 | 作为门店销售，我想要系统按实际车型数据精确计算部件面积，以便报价更准确 |

#### 验证与安全

| ID | 角色 | 故事 |
|----|------|------|
| US-200 | 客户 | 作为客户，我想要通过短信验证码验证手机号后提交预约，以便确保预约信息真实有效 |
| US-201 | 门店销售 | 作为门店销售，我想要通过短信验证码登录系统，以便忘记密码时仍能进入系统 |

#### 导出与分析

| ID | 角色 | 故事 |
|----|------|------|
| US-210 | 门店店长 | 作为门店店长，我想要将 Dashboard 数据导出为 PDF 或 Excel，以便离线分析和向上汇报 |
| US-211 | 平台管理员 | 作为平台管理员，我想要在门店合并/拆分时批量迁移客户数据，以便数据平滑过渡 |

#### AR 预览

| ID | 角色 | 故事 |
|----|------|------|
| US-220 | 客户 | 作为客户，我想要通过 AR 将改色方案叠加到真实车辆上预览，以便直观感受改色后的效果 |

#### US 编号对照表（服务端 vs 客户端）

> 服务端与客户端采用了不同的 US 编号体系，下表为 Phase 4 用户故事的跨仓库映射：

| 服务端 ID | 客户端 ID | 描述 |
|-----------|-----------|------|
| US-160 | US-28 | 案例评论发表与查看 |
| US-161 | US-28 | 评论回复（嵌套一级） |
| US-162 | US-37 | 删除自己的评论 |
| US-163 | — | 评论审核（仅 Admin 端） |
| US-164 | US-29 | 案例排行榜浏览 |
| US-165 | US-29 | 排行榜维度切换（点赞/浏览/评论） |
| US-166 | US-30 | 案例分享卡片生成与转发 |
| US-170 | — | 活动自动定时上下架（后端 Cron） |
| US-171 | — | 活动审批流程（仅 Admin 端） |
| US-172 | — | 活动审批执行（仅 Admin 端） |
| US-180 | — | 客户合并去重（仅 Admin 端） |
| US-181 | US-33 | 客户生日/纪念日提醒 |
| US-182 | US-34 | 专属销售分配 |
| US-183 | — | CRM Webhook 推送（后端能力） |
| US-190 | US-35 | AI 生图队列排队进度 |
| US-191 | US-32 | 部件面积精确展示 |
| US-200 | — | 短信验证码校验预约（后端校验逻辑） |
| US-201 | US-31 | 短信验证码登录 |
| US-210 | — | Dashboard 导出 PDF/Excel（仅 Admin 端） |
| US-211 | — | 客户数据迁移（仅 Admin 端） |
| US-220 | US-36 | AR 实时预览 |

> 注：标记为 "—" 的故事仅在服务端/Admin 端实现，客户端无对应 UI。

---

### 三、功能需求

#### 模块 20：案例评论 (Case Comment)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-190 | 新建 `case_comment` 表，存储案例评论（案例 ID、评论人、内容、父评论 ID、审核状态、软删除标记） | P0 |
| FR-191 | 提供 `GET /api/v1/cases/:id/comments` — 获取案例的评论列表。支持分页（`?page=&size=`），按创建时间倒序。每条评论包含回复列表（子评论嵌套一级，按创建时间正序） | P0 |
| FR-192 | 提供 `POST /api/v1/cases/:id/comments` — 发表评论。请求体：`{ content: string, parent_id?: number }`。需鉴权（staff 及以上角色），自动注入 `store_id` 和 `staff_id`。content 长度限制 1-500 字 | P0 |
| FR-193 | 评论发布后默认状态为 `approved`（无需审核直接展示），同时提供系统配置项 `comment_require_review`（默认 false），开启后新评论状态为 `pending`，需管理员审核通过后才对外展示 | P0 |
| FR-194 | 提供 `DELETE /api/v1/cases/:id/comments/:commentId` — 删除评论。仅允许评论作者本人或本门店 manager 及以上角色删除。软删除（标记 `deleted_at`） | P0 |
| FR-195 | 提供 `GET /api/v1/admin/comments/pending` — 管理员查看待审核评论列表（需 admin 角色），支持分页。返回待审核评论及其关联的案例基本信息 | P1 |
| FR-196 | 提供 `PUT /api/v1/admin/comments/:id/approve` — 审核通过评论（需 admin 角色）。请求体：`{ action: 'approve' | 'reject' }`。approve 将状态改为 approved，reject 改为 rejected | P1 |
| FR-197 | 评论列表返回当前用户是否为评论作者（`is_author` 字段），供前端判断是否展示删除按钮 | P0 |
| FR-198 | 案例详情接口（`GET /api/v1/cases/:id`）的响应中新增 `comment_count` 字段（已审核通过的评论总数，含回复），不返回具体评论内容（评论通过独立接口分页加载） | P0 |
| FR-199 | 评论内容敏感词过滤：发表评论时对 content 进行敏感词检测（通过外部敏感词服务或本地词库），命中敏感词的评论自动设为 `pending` 状态待审核（无论 `comment_require_review` 配置如何） | P1 |
| FR-199a | 评论频率限制：发表评论时（`POST /api/v1/cases/:id/comments`）检查同一店员（`staff_id`）对同一案例（`case_id`）的评论频率。30 秒内最多 1 条评论（通过 Redis `SETNX` 或类似机制实现）。超出限制时返回 429 `{ code: 4019, message: "评论过于频繁，请 30 秒后再试" }`（实现 NFR-131） | P1 |

#### 模块 21：案例排行榜 (Case Ranking)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-200 | 提供 `GET /api/v1/cases/ranking` — 热门案例排行榜。请求参数：`?type=like_count\|view_count\|comment_count&period=daily\|weekly\|monthly&limit=20`。返回指定周期内按指定维度排序的案例列表 | P0 |
| FR-201 | 排行榜周期定义：daily=昨日 00:00 至昨日 23:59，weekly=本周一 00:00 至当前时间，monthly=本月 1 日 00:00 至当前时间 | P0 |
| FR-202 | 排行榜接口无需鉴权（公开读取），供客户端首页和案例页展示 | P0 |
| FR-203 | 排行榜数据使用 Redis Sorted Set 缓存，通过定时任务（每小时执行一次）更新各维度的排行数据。每日凌晨计算日榜、每周一凌晨计算周榜、每月 1 日凌晨计算月榜 | P0 |
| FR-204 | 新建 `case_stats_daily` 表，存储案例每日互动数据快照（案例 ID、日期、日增点赞数、日增浏览数、日增评论数），作为排行榜计算的源数据 | P0 |
| FR-205 | 每日凌晨 Cron 任务将前一天的案例互动增量写入 `case_stats_daily`，同时更新 Redis 排行榜缓存 | P0 |
| FR-206 | 排行榜返回案例基本信息（标题、封面图、点赞数、浏览数、评论数、排名），不返回完整案例详情 | P0 |

#### 模块 22：案例分享 (Case Share)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-207 | 提供 `GET /api/v1/cases/:id/share-card` — 生成案例分享卡片数据。返回分享卡片所需信息：案例封面图 URL、标题、车型颜色摘要、小程序码图片 URL（或 Base64），供前端渲染分享卡片 | P0 |
| FR-208 | 小程序码生成：后端调用微信 `wxacode.getUnlimited` 接口，传入 `scene` 参数（编码案例 ID + 分享店员 ID），生成带参数的小程序码图片并上传至 OSS，返回 OSS URL。小程序码缓存 30 天，相同参数不重复生成 | P0 |
| FR-209 | 提供 `POST /api/v1/cases/:id/share` — 记录分享行为。请求体：`{ platform: 'wechat_friend' | 'wechat_moment' }`。需鉴权，记录分享店员 ID、分享平台和分享时间，用于分享数据统计 | P1 |
| FR-210 | `case` 表新增 `share_count` 字段，每次分享调用 `POST /api/v1/cases/:id/share` 时自增 | P1 |

#### 模块 23：活动定时发布/下架 (Campaign Scheduling)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-211 | 实现 NestJS Cron 定时任务 `CampaignScheduler`，每分钟扫描 `campaign` 表：(a) `status=active` 且当前时间 >= `valid_from` 的活动保持 active；(b) `status=active` 且当前时间 > `valid_to` 的活动自动置为 `expired`；(c) `status=approved` 且当前时间 >= `valid_from` 的活动自动置为 `active` | P0 |
| FR-212 | 定时任务执行日志记录到 `scheduler_log` 表（任务名称、执行时间、处理记录数、异常信息），便于排查问题 | P1 |
| FR-213 | 活动创建时，若 `valid_from` 为未来时间，活动状态初始为 `approved`（需审批通过后进入此状态）或 `draft`（无需审批时），由定时任务在到达 `valid_from` 时自动激活 | P0 |
| FR-214 | 定时任务在 NestJS 应用启动时自动注册，无需手动触发。通过环境变量 `ENABLE_CAMPAIGN_SCHEDULER=true` 控制定时任务开关（多实例部署时仅一个实例运行定时任务） | P0 |

#### 模块 24：活动审批流程 (Campaign Approval)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-215 | `campaign` 表新增 `approval_status` 字段（ENUM: `pending` / `approved` / `rejected`），默认值为 `pending`。`status` 字段新增可选值 `pending_approval` | P0 |
| FR-216 | 门店 manager 创建活动后（`POST /api/v1/admin/campaigns`），活动状态自动设为 `pending_approval`（`status`）和 `pending`（`approval_status`）。活动在审批通过前不出现在 `GET /api/v1/campaigns/available` 中 | P0 |
| FR-217 | 提供 `GET /api/v1/admin/campaigns/approvals` — 管理员查看待审批活动列表（需 admin 角色）。支持筛选：`?creator_store_id=&status=pending`，支持分页 | P0 |
| FR-218 | 提供 `PUT /api/v1/admin/campaigns/:id/approve` — 审批活动（需 admin 角色）。请求体：`{ action: 'approve' | 'reject', reject_reason?: string }`。approve 后：若 `valid_from <= NOW()` 则 `status=active`，否则 `status=approved`（由定时任务在到达 valid_from 时激活）；approval_status 设为 approved。reject 后：status 保持 `pending_approval`，approval_status 设为 rejected | P0 |
| FR-219 | 提供 `GET /api/v1/admin/campaigns/my` — 门店 manager 查看自己创建的活动列表及其审批状态（`?approval_status=pending\|approved\|rejected`） | P0 |
| FR-220 | 活动审批结果通过 WebSocket 或轮询通知创建者（P2）。初期可通过 `GET /api/v1/admin/campaigns/my` 查询审批状态 | P2 |
| FR-221 | 审批操作记录审计日志：`audit_log` 表记录审批人、审批时间、审批动作（approve/reject）、拒绝原因 | P1 |

#### 模块 25：客户合并去重 (Customer Merge)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-222 | 提供 `POST /api/v1/admin/customers/merge` — 客户合并（需 admin 角色，仅平台管理员可操作跨门店合并）。请求体：`{ primary_id: number, secondary_ids: number[] }`。以 primary_id 为主记录，将 secondary_ids 中所有客户数据合并到主记录 | P1 |
| FR-223 | 合并规则：(a) 客户姓名取主记录的 name（若非空）或 secondary 中第一个非空 name；(b) tags 取所有记录的并集去重；(c) notes 按时间倒序合并所有记录的备注；(d) total_visits 取所有记录之和；(e) total_orders 取所有记录之和；(f) total_spent 取所有记录之和；(g) last_visit_at 取所有记录中最大值；(h) vehicle_info 取主记录的值（若为空则取 secondary 中第一个非空值） | P1 |
| FR-224 | 合并后，被合并客户（secondary）的所有关联改色方案和报价单的 `store_id` 更新为主记录的 `store_id`（若不同） | P1 |
| FR-225 | 被合并客户记录软删除（设置 `deleted_at`），不再出现在任何查询中。合并操作记录审计日志 | P1 |
| FR-226 | 提供 `GET /api/v1/admin/customers/duplicates` — 检测跨门店重复客户（需 admin 角色）。按手机号分组，返回同一手机号在多个门店存在的客户列表，供管理员判断是否需要合并 | P1 |

#### 模块 26：客户生日/纪念日提醒 (Customer Reminder)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-227 | `customer` 表新增字段：`birthday`（DATE, NULL，客户生日）、`anniversary_date`（DATE, NULL，纪念日，如首次到店日、成交日等）、`anniversary_label`（VARCHAR(50), NULL，纪念日标签如"首次到店"） | P1 |
| FR-228 | 实现 NestJS Cron 定时任务 `CustomerReminderScheduler`，每日凌晨 8:00 执行。扫描所有门店的 customer 表，查找 `birthday` 为今天或未来 3 天内的客户，以及 `anniversary_date` 为今天或未来 3 天内的客户 | P1 |
| FR-229 | 提醒通知方式：(a) 在门店的 Dashboard 中展示"今日客户关怀"模块（通过 `GET /api/v1/admin/dashboard/customer-care` 接口返回今日和未来 3 天内的生日/纪念日客户列表）；(b) Webhook 推送至企业微信/钉钉群（参见模块 28） | P1 |
| FR-230 | 提供 `GET /api/v1/admin/dashboard/customer-care` — 获取客户关怀提醒。请求参数：`?days=3`（未来 N 天内）。返回：`{ birthdays: [{ customer_id, name, phone, birthday, days_until }], anniversaries: [{ customer_id, name, phone, anniversary_label, anniversary_date, days_until }] }`。需 manager 及以上角色，按门店隔离 | P1 |
| FR-231 | 提供 `PUT /api/v1/admin/customers/:id` 扩展 — 在已有编辑接口中新增 `birthday`、`anniversary_date`、`anniversary_label` 字段的可编辑支持 | P1 |

#### 模块 27：店员与客户绑定 (Staff-Customer Binding)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-232 | `customer` 表新增 `assigned_staff_id` 字段（BIGINT UNSIGNED, NULL, INDEX），记录专属销售店员 ID | P1 |
| FR-233 | 提供 `PUT /api/v1/admin/customers/:id/assign` — 将客户分配给指定店员。请求体：`{ staff_id: number }`。需本门店 manager 及以上角色。校验 staff_id 属于本门店 | P1 |
| FR-234 | 提供 `PUT /api/v1/admin/customers/:id/unassign` — 取消客户与店员的绑定关系（将 `assigned_staff_id` 置为 NULL）。需本门店 manager 及以上角色 | P1 |
| FR-235 | `GET /api/v1/admin/customers` 列表接口新增筛选参数 `?assigned_staff_id=`，支持按专属销售筛选客户 | P1 |
| FR-236 | 自动绑定规则：当店员创建改色方案并填写 `customer_phone` 时，若该客户尚无专属销售（`assigned_staff_id IS NULL`），则自动将该店员设为该客户的专属销售。该逻辑与客户自动同步（FR-182）在同一事件订阅者中完成 | P1 |
| FR-237 | 店员可在我的客户列表中查看自己绑定的所有客户：`GET /api/v1/admin/customers?assigned_staff_id=<当前店员ID>` | P1 |

#### 模块 28：CRM 对接企业微信/钉钉 (CRM Webhook)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-238 | 新建 `webhook_config` 表，存储门店级别的 Webhook 配置（store_id, platform 枚举 wecom/dingtalk, webhook_url, enabled, events 枚举数组） | P1 |
| FR-239 | 提供 `PUT /api/v1/admin/webhook/config` — 配置门店的 Webhook。请求体：`{ platform: 'wecom' | 'dingtalk', webhook_url: string, enabled: boolean, events: string[] }`。需 manager 及以上角色。events 可选值：`customer.created`、`customer.birthday`、`customer.anniversary`、`appointment.created`、`appointment.confirmed`、`quote.confirmed` | P1 |
| FR-240 | 实现 NestJS 事件订阅者，监听客户创建、客户生日/纪念日提醒、预约创建/确认、报价确认等业务事件，根据门店的 Webhook 配置将事件消息推送到对应的 Webhook URL | P1 |
| FR-241 | 消息推送格式：(a) 企业微信：Markdown 格式消息；(b) 钉钉：Markdown 格式消息。消息内容包含事件类型、客户信息摘要、时间戳。模板示例：`## 客户动态提醒\n> 客户：王先生 (138****8000)\n> 事件：新客户到店\n> 专属销售：小李\n> 时间：2026-07-22 14:30` | P1 |
| FR-242 | Webhook 推送失败时（非 2xx 响应），记录失败日志到 `webhook_log` 表（store_id, platform, event, status, response_code, error_message, created_at），并支持手动重试（每条日志独立重试，最多 3 次） | P1 |
| FR-243 | 提供 `GET /api/v1/admin/webhook/config` — 查询本门店 Webhook 配置（需 manager 及以上角色） | P1 |
| FR-244 | 提供 `GET /api/v1/admin/webhook/logs` — 查询本门店 Webhook 推送日志（`?status=success\|failed&page=&size=`，需 manager 及以上角色） | P1 |

#### 模块 29：AI 生图队列管理 (AI Queue)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-245 | 引入 Bull 队列（基于 Redis）管理 AI 生图任务。配置两个队列：`ai-generation`（默认优先级）和 `ai-generation-priority`（高优先级，VIP 门店或付费用户） | P1 |
| FR-246 | 修改 `POST /api/v1/configurations/:id/generate-image` 接口行为：不再直接调用 AI API，改为向 Bull 队列提交任务，立即返回 `{ generation_id, status: 'queued', queue_position: number }`。`queue_position` 为当前队列中排在此任务之前的任务数 | P1 |
| FR-247 | 队列消费者（Queue Worker）从 Redis 中拉取任务，调用 AI API 执行生图。消费者并发数通过环境变量 `AI_QUEUE_CONCURRENCY` 控制（默认 2）。Worker 数量通过 `AI_QUEUE_WORKER_COUNT` 控制（默认 1） | P1 |
| FR-248 | 任务完成后，消费者更新 `ai_generation` 表状态（completed/failed）和结果图 URL。原 Webhook 回调机制保留作为备用方案（AI 服务商异步回调时仍可通过 Webhook 更新结果） | P1 |
| FR-249 | 提供 `GET /api/v1/generations/:id/queue-status` — 查询队列任务状态。返回：`{ generation_id, status: 'queued'|'processing'|'completed'|'failed', queue_position: number|null, estimated_seconds: number|null }` | P1 |
| FR-250 | 队列任务支持超时控制：单任务最大执行时间 120 秒（通过 Bull 的 `timeout` 配置），超时后任务自动标记为 failed，error_message 记录 "AI 生图超时" | P1 |
| FR-251 | 任务失败后支持自动重试：最多重试 2 次，每次间隔 10 秒（通过 Bull 的 `attempts` 和 `backoff` 配置）。耗尽重试次数后任务标记为永久失败 | P1 |
| FR-252 | AI 生图限额控制：每门店每日生图次数上限通过环境变量 `AI_DAILY_GENERATION_LIMIT` 配置（默认 20 次/天）。提交任务时检查该门店当日已提交任务数（含队列中和已完成），超出限额返回 429 `{ code: 4010, message: "本日 AI 生图次数已用完，请明日再试" }` | P1 |
| FR-252a | AI 生图队列容量控制：提交任务时检查当前全队列等待任务数（`waiting` 状态）是否达到上限（默认 500，通过环境变量 `AI_QUEUE_MAX_WAITING` 配置）。超出上限时拒绝新任务提交，返回 429 `{ code: 4018, message: "AI 生图队列已满，请稍后再试" }`（实现 NFR-141） | P1 |
| FR-253 | 提供 `GET /api/v1/admin/ai-queue/stats` — 管理员查看队列统计（需 admin 角色）。返回：`{ waiting, active, completed_today, failed_today, avg_wait_seconds, avg_process_seconds }` | P2 |

#### 模块 30：部件面积精确计算 (Part Area Calculation)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-254 | 提供 `PUT /api/v1/admin/vehicles/models/:id/parts/batch` — 批更新车型部件面积数据（需 admin 角色）。请求体：`{ parts: [{ part_code: string, area_m2: number }] }`。仅更新传入的部件，不影响未传入的部件 | P1 |
| FR-255 | `car_part` 表的 `area_m2` 字段支持按车型独立设置。种子数据中每个车型的部件面积初始化时使用车型特定默认值（优先从车型元数据获取，无数据时回退到全局默认值：FULL=15.0, HOOD=1.5, ROOF=2.0, DOOR=1.2×4=4.8, FENDER=0.8×2=1.6, TRUNK=1.5, BUMPER_FRONT=1.5, BUMPER_REAR=1.5 等） | P1 |
| FR-256 | 提供 `GET /api/v1/admin/vehicles/models/:id/parts/area` — 获取车型部件面积汇总（需 manager 及以上角色）。返回各部件面积及总面积，用于后台面积数据校对 | P1 |
| FR-257 | 报价计算逻辑更新：当方案的 `part_color` 记录中 `part_code` 对应的 `car_part.area_m2 > 0` 时，使用该精确面积；否则回退到全局默认值 15m²（兼容旧数据） | P0 |
| FR-258 | 新增车型时可一键从模板车型复制部件面积数据（`POST /api/v1/admin/vehicles/models/:id/parts/copy-from/:templateModelId`），减少手工录入工作量。需 admin 角色 | P2 |

#### 模块 31：短信验证码校验用于预约 (SMS Appointment Verify)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-259 | `CreateAppointmentDto` 新增可选字段 `sms_code`（VARCHAR(6)）。当请求中包含 `sms_code` 时，后端在预约创建前先调用短信验证码校验服务（复用 Phase 2 FR-130~FR-136 的 `sms_code` 表和校验逻辑） | P0 |
| FR-260 | 验证码校验使用 `type='appointment'`，与登录验证码（type='login'）隔离，防止跨场景混用。短信模板为："您的预约验证码为：XXXXXX，5分钟内有效，请勿泄露" | P0 |
| FR-261 | 验证码校验通过后的预约创建流程与现有逻辑一致。校验失败时根据原因返回不同错误码：验证码不匹配返回 1012（`SMS_CODE_WRONG`）、验证码过期返回 1014（`SMS_CODE_EXPIRED`）、验证码已使用返回 1015（`SMS_CODE_USED`）。所有校验失败均不创建预约 | P0 |

#### 模块 32：短信验证码登录 (SMS Login)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-262 | 提供 `POST /api/v1/auth/sms-login` — 短信验证码登录接口。请求体：`{ phone: string, sms_code: string }` | P0 |
| FR-263 | 验证流程：(a) 校验 sms_code 的有效性（type='login'、未过期、未使用、匹配 phone）：不匹配返回 1012（`SMS_CODE_WRONG`）、已过期返回 1014（`SMS_CODE_EXPIRED`）、已使用返回 1015（`SMS_CODE_USED`）；(b) 校验通过后查找 phone 对应的店员记录。若找到，生成 JWT token 返回（含 store_id、staff_id、role）；若未找到，返回 `{ code: 4011, message: "该手机号未注册" }` | P0 |
| FR-264 | 验证码使用后立即标记 `used=true`，防止重复登录 | P0 |
| FR-265 | `POST /api/v1/auth/send-sms-code` 新增 `type='login'` 支持（Phase 2 已定义 type 枚举但未实现登录场景的完整流程），发送前校验 phone 是否已注册为店员，未注册则返回提示 | P0 |
| FR-266 | 通过验证码登录后首次使用的店员，若未设置密码，系统生成随机密码（16 位）并通过短信发送给店员，同时提示用户可自行修改密码 | P1 |

#### 模块 33：数据看板导出 PDF/Excel (Dashboard Export)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-267 | 提供 `POST /api/v1/admin/dashboard/export/pdf` — 导出 Dashboard 为 PDF。请求体：`{ sections: ('kpi'|'trends'|'top_rankings'|'staff_performance')[], period: string, date?: string }`。需 manager 及以上角色。后端聚合各 Dashboard API 数据，使用 PDF 生成库（如 pdfkit 或 puppeteer）渲染为 PDF 文件，上传至 OSS 后返回下载 URL | P1 |
| FR-268 | 提供 `POST /api/v1/admin/dashboard/export/excel` — 导出 Dashboard 为 Excel。请求体同 PDF 导出。使用 Excel 生成库（如 exceljs）生成 XLSX 文件，每个 section 为一个工作表（Sheet），上传至 OSS 后返回下载 URL | P1 |
| FR-269 | 导出任务异步执行：提交导出请求后立即返回 `{ export_id, status: 'processing' }`。客户端通过 `GET /api/v1/admin/dashboard/exports/:id` 轮询导出状态和下载 URL。导出记录存储在 `export_task` 表 | P1 |
| FR-270 | 导出 PDF 包含门店 Logo、门店名称、导出时间、数据期间、各模块数据的图表和表格。排版风格专业清晰，适合打印和汇报 | P1 |
| FR-271 | 导出频率限制：同一门店每 5 分钟最多发起 1 次导出请求（通过 Redis 记录），超出返回 429 | P1 |

#### 模块 34：客户数据跨门店迁移 (Customer Migration)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-272 | 提供 `POST /api/v1/admin/customers/migrate` — 批量客户数据迁移（需 admin 角色）。请求体：`{ from_store_id: number, to_store_id: number, customer_ids?: number[] }`。若未提供 `customer_ids`，则迁移 `from_store_id` 门店的所有客户 | P1 |
| FR-273 | 迁移规则：(a) 目标门店中已有相同手机号的客户记录时，执行合并逻辑（参见 FR-223）；(b) 目标门店中无相同手机号时，直接更新客户的 `store_id` 为 `to_store_id`；(c) 客户关联的改色方案和报价单的 `store_id` 同步更新 | P1 |
| FR-274 | 迁移操作为原子性事务：全部成功或全部回滚。迁移前自动备份客户数据快照到 `customer_snapshot` 表（JSON 字段存储完整数据），便于迁移异常时恢复 | P1 |
| FR-275 | 迁移结果返回：`{ total: number, merged: number, migrated: number, failed: number, errors: [{ customer_id, reason }] }`。迁移操作记录审计日志 | P1 |
| FR-276 | 提供 `GET /api/v1/admin/customers/migration-history` — 查询迁移历史记录（需 admin 角色），返回历次迁移操作的时间、操作人、源门店、目标门店、迁移数量 | P1 |

#### 模块 35：AR 实时预览 (AR Preview)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-277 | 提供 `GET /api/v1/vehicles/models/:id/ar-config` — 获取车型的 AR 配置信息（需鉴权）。返回：(a) 车型 3D 模型文件 URL（glTF/GLB 格式，用于 AR 渲染）；(b) 车型实际尺寸（长/宽/高，单位米）；(c) AR 跟踪类型（image_tracking / plane_detection / face_mesh） | P2 |
| FR-278 | `car_model` 表新增字段：`ar_model_url`（VARCHAR(500), NULL，AR 专用模型文件 URL，可能为 USDZ/glTF 格式）、`vehicle_length`（DECIMAL(5,2), NULL，车长米）、`vehicle_width`（DECIMAL(5,2), NULL，车宽米）、`vehicle_height`（DECIMAL(5,2), NULL，车高米） | P2 |
| FR-279 | 提供 `GET /api/v1/configurations/:id/ar-texture` — 获取改色方案的 AR 贴图数据。返回：(a) 各部件对应的颜色色值 hex 和材质 roughness/metalness 参数；(b) 部件贴图 UV 映射信息（若存在） | P2 |

---

### 四、非功能需求（Phase 4 新增）

#### 4.14 社区内容安全

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-130 | 评论敏感词检测：接入第三方敏感词过滤服务（如网易易盾、阿里云内容安全），或本地敏感词库（词库从 OSS 动态加载，支持热更新）。检测延迟 < 200ms | P1 |
| NFR-131 | 同一店员对同一案例的评论频率限制：30 秒内最多 1 条评论，超出返回 429 | P1 |

#### 4.15 队列可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-140 | Bull 队列依赖 Redis，Redis 不可用时队列任务不丢失（Bull 自带持久化），恢复后自动继续处理 | P1 |
| NFR-141 | AI 生图队列最大等待任务数 500，超出时拒绝新任务提交（返回 429），防止内存溢出 | P1 |
| NFR-142 | 队列消费者进程崩溃后自动重启（通过 Bull 的进程管理或 PM2/Docker 的 restart policy） | P0 |

#### 4.16 定时任务可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-150 | 定时任务执行互斥：使用 Redis 分布式锁（`SETNX` + TTL）确保多实例部署时同一时刻只有一个实例执行定时任务 | P0 |
| NFR-151 | 定时任务执行超时告警：单次执行超过 60 秒时记录 WARN 日志，超过 120 秒时触发告警（通过企业微信 Webhook 通知运维） | P1 |

#### 4.17 导出性能

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-160 | PDF/Excel 导出生成时间 < 30s（常规数据量下，单门店月度数据） | P1 |
| NFR-161 | 导出文件在 OSS 上保留 7 天，过期后自动清理（通过 OSS 生命周期规则或定时任务） | P1 |

#### 4.18 数据安全

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-170 | 客户数据迁移操作必须经二次确认（请求中需携带 `confirm_token`，通过单独的前置确认接口获取），防止误操作 | P0 |
| NFR-171 | Webhook URL 存储前校验格式（必须是 HTTPS），防止 SSRF 攻击 | P0 |
| NFR-172 | 小程序码生成接口的 `access_token` 从 Redis 缓存获取（TTL=7200s），避免每次调用微信 API 获取新 token | P1 |

---

### 五、验收标准（Phase 4）

#### 5.22 案例评论

- [ ] **AC-173**：Given 案例 ID=1 有 3 条已审核评论（无回复），When `GET /api/v1/cases/1/comments?page=1&size=10`，Then 返回 3 条评论，按创建时间倒序，每条含 `comment_id`、`content`、`staff_name`、`created_at`、`is_author`、`replies: []`。
- [ ] **AC-174**：Given 门店 A 店员登录，When `POST /api/v1/cases/1/comments` 传入 `{ content: "这个哑光黑效果太赞了！" }`，Then 返回 201，评论创建成功，status="approved"，store_id=1，staff_id=当前店员。
- [ ] **AC-175**：Given 已有一条评论 ID=10，门店 A 店员登录，When `POST /api/v1/cases/1/comments` 传入 `{ content: "同意，我也很喜欢", parent_id: 10 }`，Then 返回 201，回复创建成功，parent_id=10。
- [ ] **AC-176**：Given 评论 ID=10 属于店员 A，店员 A 登录，When `DELETE /api/v1/cases/1/comments/10`，Then 返回 200，评论软删除。
- [ ] **AC-177**：Given 评论 ID=10 属于店员 A，店员 B（同门店）尝试删除，When `DELETE /api/v1/cases/1/comments/10`，Then 返回 403（非作者且非 manager）。
- [ ] **AC-178**：Given 发表评论时 content 为空或超过 500 字，When 提交，Then 返回 400 校验错误。
- [ ] **AC-179**：Given 案例详情查询，When `GET /api/v1/cases/1`，Then 响应中新增 `comment_count` 字段，值为已审核评论总数（含回复）。
- [ ] **AC-179b**：Given `comment_require_review=true` 且评论内容含敏感词，When 发表评论，Then 返回 201，status="pending"，评论不在公开评论列表中显示。
- [ ] **AC-179c**：Given 店员 A 在 30 秒内向同一案例发表第 2 条评论，When `POST /api/v1/cases/1/comments`，Then 返回 429 `{ code: 4019, message: "评论过于频繁，请 30 秒后再试" }`。

#### 5.23 案例排行榜

- [ ] **AC-180**：Given 昨日有 5 个案例被点赞（点赞数分别为 10、8、5、3、1），When `GET /api/v1/cases/ranking?type=like_count&period=daily&limit=3`，Then 返回 3 条案例按点赞数降序，每条含 rank、case_id、title、cover_image_url、like_count。
- [ ] **AC-181**：Given 本周没有案例数据，When 查询周榜，Then 返回空数组 `{ items: [], total: 0 }`。
- [ ] **AC-182**：Given 排行榜接口无需鉴权，When 未登录请求，Then 正常返回数据。

#### 5.24 案例分享

- [ ] **AC-183**：Given 案例 ID=1，When `GET /api/v1/cases/1/share-card`，Then 返回案例封面 URL、标题、"宝马 3系 / AX 哑光灰"摘要、小程序码图片 URL。
- [ ] **AC-184**：Given 案例 ID=999 不存在，When 请求分享卡片，Then 返回 404。
- [ ] **AC-185**：Given 店员登录后分享案例到微信好友，When `POST /api/v1/cases/1/share` 传入 `{ platform: "wechat_friend" }`，Then 返回 200，case.share_count +1。

#### 5.25 活动定时发布/下架

- [ ] **AC-186**：Given 活动 A 的 `valid_from=2026-08-01 00:00, valid_to=2026-08-31 23:59, status=approved`，当前时间 2026-08-01 00:01，When 定时任务执行，Then 活动 A 的 status 自动更新为 active。
- [ ] **AC-187**：Given 活动 B 的 `valid_to=2026-07-21 23:59, status=active`，当前时间 2026-07-22 00:01，When 定时任务执行，Then 活动 B 的 status 自动更新为 expired。
- [ ] **AC-188**：Given 定时任务日志正常，When 查询 `scheduler_log`，Then 可见执行记录（任务名、执行时间、处理活动数）。

#### 5.26 活动审批流程

- [ ] **AC-189**：Given 门店 A 的 manager 创建活动，When `POST /api/v1/admin/campaigns`，Then 返回 201，status="pending_approval"，approval_status="pending"。
- [ ] **AC-190**：Given 活动 ID=5 状态为 pending_approval，admin 登录，When `PUT /api/v1/admin/campaigns/5/approve` 传入 `{ action: "approve" }`，Then 返回 200，approval_status="approved"，若 valid_from <= NOW() 则 status="active"，否则 status="approved"。
- [ ] **AC-191**：Given admin 拒绝活动（action="reject"），When `PUT /api/v1/admin/campaigns/5/approve` 传入 `{ action: "reject", reject_reason: "折扣力度过大不符合标准" }`，Then 返回 200，approval_status="rejected"，status 保持 pending_approval。
- [ ] **AC-192**：Given 活动 A 审批未通过（approval_status=pending），When `GET /api/v1/campaigns/available`，Then 活动 A 不在返回结果中。
- [ ] **AC-193**：Given 门店 A 的 manager 查看自己创建的活动，When `GET /api/v1/admin/campaigns/my?approval_status=pending`，Then 返回该门店 manager 创建的待审批活动列表。

#### 5.27 客户合并去重

- [ ] **AC-194**：Given 客户 A（id=1, store_id=1, phone=13800138000, tags=["VIP"], total_visits=5）和客户 B（id=2, store_id=2, phone=13800138000, tags=["奔驰车主"], total_visits=3），平台管理员登录，When `POST /api/v1/admin/customers/merge` 传入 `{ primary_id: 1, secondary_ids: [2] }`，Then 返回 200，客户 A 的 tags=["VIP", "奔驰车主"]，total_visits=8，客户 B 被软删除。
- [ ] **AC-195**：Given 客户 ID=1 和 ID=2 属于同一门店，When 尝试合并，Then 正常合并且 store_id 不变。

#### 5.28 客户生日/纪念日提醒

- [ ] **AC-196**：Given 门店 A 有 3 个客户今天生日，When `GET /api/v1/admin/dashboard/customer-care?days=3`，Then 返回 `birthdays` 数组含 3 条生日客户记录，`days_until=0`。
- [ ] **AC-197**：Given 门店 A 有 1 个客户纪念日是 3 天后，When 查询，Then 返回 `anniversaries` 数组含该客户，`days_until=3`。
- [ ] **AC-198**：Given 门店 A 的 manager 编辑客户，When `PUT /api/v1/admin/customers/5` 传入 `{ birthday: "1990-05-15" }`，Then 返回 200，客户 birthday 字段已更新。

#### 5.29 店员与客户绑定

- [ ] **AC-199**：Given 门店 A 的 manager 登录，When `PUT /api/v1/admin/customers/5/assign` 传入 `{ staff_id: 10 }`（店员 10 属于门店 A），Then 返回 200，客户 assigned_staff_id=10。
- [ ] **AC-200**：Given 店员 10 不属于门店 A，When 尝试将客户分配给店员 10，Then 返回 400 "店员不属于本门店"。
- [ ] **AC-201**：Given 客户尚无专属销售，店员创建方案时填入该客户手机号，When 方案创建成功，Then 客户自动绑定该店员为专属销售。

#### 5.30 CRM Webhook

- [ ] **AC-202**：Given 门店 A 的 manager 配置了企业微信 Webhook URL，When `PUT /api/v1/admin/webhook/config` 传入 `{ platform: "wecom", webhook_url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx", enabled: true, events: ["customer.created", "appointment.created"] }`，Then 返回 200，配置保存成功。
- [ ] **AC-203**：Given Webhook 已启用，当新客户自动创建时，系统向配置的企业微信 Webhook URL 发送 Markdown 格式消息。
- [ ] **AC-204**：Given Webhook URL 无效（返回非 2xx），推送失败后 `webhook_log` 表记录失败日志，含 response_code 和 error_message。

#### 5.31 AI 生图队列管理

- [ ] **AC-205**：Given 队列为空，店员提交 AI 生图任务，When `POST /api/v1/configurations/99/generate-image`，Then 返回 `{ generation_id: 5, status: "queued", queue_position: 0 }`。
- [ ] **AC-206**：Given 队列中有 2 个等待任务，门店 A 店员提交新任务，When 提交，Then 返回 `queue_position: 2`。
- [ ] **AC-207**：Given 门店当日已生成 20 张图（达上限），When 再提交生成请求，Then 返回 429 `{ code: 4010, message: "本日 AI 生图次数已用完，请明日再试" }`。
- [ ] **AC-207a**：Given 全队列等待任务数已达 500（AI_QUEUE_MAX_WAITING=500），When 任意门店店员提交新的 AI 生图任务，Then 返回 429 `{ code: 4018, message: "AI 生图队列已满，请稍后再试" }`，任务不进入队列。
- [ ] **AC-208**：Given 任务正在队列中等待，When `GET /api/v1/generations/5/queue-status`，Then 返回 status="queued"，queue_position 为当前实际排队位置。
- [ ] **AC-209**：Given 任务执行失败（AI API 超时），When 自动重试 2 次后仍失败，Then 任务 status="failed"，error_message="AI 生图超时（已重试 2 次）"。

#### 5.32 部件面积精确计算

- [ ] **AC-210**：Given admin 更新车型 ID=10 的 HOOD 部件面积为 1.8m²（原默认 1.5m²），When `PUT /api/v1/admin/vehicles/models/10/parts/batch` 传入 `{ parts: [{ part_code: "HOOD", area_m2: 1.8 }] }`，Then 返回 200，HOOD 面积更新为 1.8，其他部件面积不变。
- [ ] **AC-211**：Given HOOD 面积 1.8m²、颜色单价 300 元/m²、材质系数 1.2，When 生成报价单，Then HOOD 部件费用 = 1.8 * 300 * 1.2 = 648 元。
- [ ] **AC-212**：Given 某部件 area_m2=0（旧数据未录入精确面积），When 计算报价，Then 回退使用全局默认值 15m²（FULL）或对应部件默认面积。

#### 5.33 短信验证码校验用于预约

- [ ] **AC-213**：Given 客户请求发送预约验证码，When `POST /api/v1/auth/send-sms-code` 传入 `{ phone: "13800138000", type: "appointment" }`，Then 返回 200，短信发送成功，type=appointment。
- [ ] **AC-214**：Given 客户已获取有效预约验证码，When `POST /api/v1/appointments` 传入 `{ ..., sms_code: "123456" }`，Then 验证码校验通过，预约创建成功。
- [ ] **AC-215**：Given 客户提供的 sms_code 错误（code=1012），When 创建预约，Then 返回 400 `{ code: 1012, message: "验证码错误，请重新输入" }`，不创建预约。

#### 5.34 短信验证码登录

- [ ] **AC-216**：Given 店员手机号 13800138000 已注册，且已获取有效登录验证码，When `POST /api/v1/auth/sms-login` 传入 `{ phone: "13800138000", sms_code: "123456" }`，Then 返回 200，含 `{ accessToken, refreshToken, expiresIn }`，解码 accessToken 含 store_id、staff_id、role。
- [ ] **AC-217**：Given 手机号未注册，When `POST /api/v1/auth/sms-login`，Then 返回 `{ code: 4011, message: "该手机号未注册" }`。
- [ ] **AC-217b**：Given 验证码输入错误（不匹配），When `POST /api/v1/auth/sms-login`，Then 返回 400 `{ code: 1012, message: "验证码错误，请重新输入" }`。
- [ ] **AC-217c**：Given 验证码已过期（超过 5 分钟），When `POST /api/v1/auth/sms-login`，Then 返回 400 `{ code: 1014, message: "验证码已过期，请重新获取" }`。
- [ ] **AC-218**：Given 验证码已使用（used=true），When 再次尝试登录，Then 返回 400 `{ code: 1015, message: "验证码已使用" }`。
- [ ] **AC-219**：Given 发送登录验证码时 phone 未注册为店员，When `POST /api/v1/auth/send-sms-code` 传入 `{ phone: "13900000000", type: "login" }`，Then 返回 400 `{ code: 1013, message: "该手机号未注册，请联系店长创建账号" }`。

#### 5.35 数据看板导出

- [ ] **AC-220**：Given 门店 A 的 manager 登录，When `POST /api/v1/admin/dashboard/export/pdf` 传入 `{ sections: ["kpi", "trends"], period: "monthly" }`，Then 返回 `{ export_id: 1, status: "processing" }`。
- [ ] **AC-221**：Given 导出任务完成，When `GET /api/v1/admin/dashboard/exports/1`，Then 返回 status="completed"，download_url 为 OSS 上的 PDF 文件地址。
- [ ] **AC-222**：Given 同一门店 5 分钟内已有导出任务，When 再次请求导出，Then 返回 429 "导出请求过于频繁，请 5 分钟后再试"。

#### 5.36 客户数据跨门店迁移

- [ ] **AC-223**：Given 平台管理员登录，门店 1 有 50 个客户需迁移至门店 2，When `POST /api/v1/admin/customers/migrate` 传入 `{ from_store_id: 1, to_store_id: 2 }`，Then 返回 `{ total: 50, merged: 0, migrated: 50, failed: 0 }`，所有客户 store_id 更新为 2。
- [ ] **AC-224**：Given 迁移时门店 2 已有相同手机号的客户，When 执行迁移，Then 触发合并逻辑（merged 计数增加，而非 migrated）。
- [ ] **AC-225**：Given 迁移过程中发生数据库异常，When 事务回滚，Then 门店 1 和门店 2 的客户数据均保持迁移前状态。

#### 5.37 AR 预览

- [ ] **AC-226**：Given 车型 ID=10 已配置 AR 模型 URL，When `GET /api/v1/vehicles/models/10/ar-config`，Then 返回 ar_model_url、vehicle_length、vehicle_width、vehicle_height。
- [ ] **AC-227**：Given 车型 ID=10 未配置 AR 模型 URL，When 请求 AR 配置，Then 返回 ar_model_url=null，客户端展示"AR 预览暂不支持此车型"。

---

### 六、数据库表结构需求（Phase 4 新增）

#### 6.13 案例评论

**case_comment（案例评论）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| case_id | BIGINT UNSIGNED | NOT NULL, INDEX | 关联案例 ID |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 评论人所属门店 ID（多租户隔离键） |
| staff_id | BIGINT UNSIGNED | NOT NULL | 评论店员 ID |
| parent_id | BIGINT UNSIGNED | NULL, INDEX | 父评论 ID（NULL=顶级评论，非NULL=回复） |
| content | VARCHAR(500) | NOT NULL | 评论内容 |
| status | ENUM('pending','approved','rejected') | NOT NULL, DEFAULT 'approved' | 审核状态 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 评论时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_case_id (case_id)` — 按案例查询评论
- `KEY idx_parent_id (parent_id)` — 按父评论查询回复
- `KEY idx_case_status (case_id, status)` — 已审核评论列表查询

#### 6.14 案例每日统计

**case_stats_daily（案例每日互动快照）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| case_id | BIGINT UNSIGNED | NOT NULL, INDEX | 案例 ID |
| stat_date | DATE | NOT NULL | 统计日期 |
| daily_likes | INT UNSIGNED | NOT NULL, DEFAULT 0 | 当日新增点赞数 |
| daily_views | INT UNSIGNED | NOT NULL, DEFAULT 0 | 当日新增浏览数 |
| daily_comments | INT UNSIGNED | NOT NULL, DEFAULT 0 | 当日新增评论数 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `UNIQUE KEY uk_case_date (case_id, stat_date)` — 每个案例每天仅一条统计记录
- `KEY idx_stat_date (stat_date)` — 按日期范围查询排行

#### 6.15 定时任务执行日志

**scheduler_log（定时任务日志）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| job_name | VARCHAR(100) | NOT NULL, INDEX | 任务名称（如 campaign_scheduler） |
| executed_at | DATETIME | NOT NULL | 执行时间 |
| processed_count | INT UNSIGNED | NOT NULL, DEFAULT 0 | 处理记录数 |
| duration_ms | INT UNSIGNED | NOT NULL | 执行耗时（毫秒） |
| status | ENUM('success','partial','failed') | NOT NULL | 执行状态 |
| error_message | TEXT | NULL | 异常信息 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_job_name_time (job_name, executed_at)` — 按任务名和时间查询日志

#### 6.16 Webhook 配置与日志

**webhook_config（门店 Webhook 配置）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, UNIQUE, INDEX | 所属门店 ID（每门店每种平台仅一条配置） |
| platform | ENUM('wecom','dingtalk') | NOT NULL | 平台类型 |
| webhook_url | VARCHAR(500) | NOT NULL | Webhook URL（必须 HTTPS） |
| enabled | TINYINT(1) | NOT NULL, DEFAULT 0 | 是否启用 |
| events | JSON | NOT NULL | 订阅事件类型列表（如 `["customer.created","appointment.created"]`） |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**webhook_log（Webhook 推送日志）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 门店 ID |
| platform | ENUM('wecom','dingtalk') | NOT NULL | 平台类型 |
| event | VARCHAR(100) | NOT NULL | 事件类型 |
| response_code | SMALLINT UNSIGNED | NULL | HTTP 响应状态码 |
| error_message | TEXT | NULL | 错误信息 |
| retry_count | TINYINT UNSIGNED | NOT NULL, DEFAULT 0 | 已重试次数 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 推送时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

#### 6.17 导出任务

**export_task（数据导出任务）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 门店 ID |
| staff_id | BIGINT UNSIGNED | NOT NULL | 导出操作店员 ID |
| type | ENUM('pdf','excel') | NOT NULL | 导出类型 |
| sections | JSON | NOT NULL | 导出模块列表（如 `["kpi","trends"]`） |
| period | VARCHAR(20) | NOT NULL | 数据周期（daily/weekly/monthly） |
| status | ENUM('processing','completed','failed') | NOT NULL, DEFAULT 'processing' | 任务状态 |
| file_url | VARCHAR(500) | NULL | 导出文件 OSS URL（完成后填充） |
| error_message | TEXT | NULL | 失败原因 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

#### 6.18 客户迁移快照

**customer_snapshot（客户数据快照）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| customer_id | BIGINT UNSIGNED | NOT NULL, INDEX | 客户 ID |
| store_id | BIGINT UNSIGNED | NOT NULL | 迁移前门店 ID |
| snapshot_data | JSON | NOT NULL | 完整客户数据快照 |
| migration_batch_id | VARCHAR(36) | NOT NULL, INDEX | 迁移批次 ID（UUID） |
| operator_id | BIGINT UNSIGNED | NOT NULL | 操作人 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 快照时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

---

### 七、API 接口速览（Phase 4 新增）

#### 7.15 案例评论

```
# 评论（公共读取 + 需鉴权写入）
GET    /api/v1/cases/:id/comments              # 案例评论列表 (?page=&size=)
POST   /api/v1/cases/:id/comments              # 发表评论（需鉴权）
       Body: { content, parent_id? }
DELETE /api/v1/cases/:id/comments/:commentId    # 删除评论（需鉴权，作者或manager）

# 评论审核（后台，需 admin）
GET    /api/v1/admin/comments/pending          # 待审核评论列表 (?page=&size=)
PUT    /api/v1/admin/comments/:id/approve      # 审核评论
       Body: { action: "approve"|"reject" }
```

#### 7.16 案例排行榜与分享

```
# 排行榜（公共读取）
GET    /api/v1/cases/ranking                   # 热门案例排行榜 (?type=like_count|view_count|comment_count&period=daily|weekly|monthly&limit=20)

# 分享（需鉴权）
GET    /api/v1/cases/:id/share-card             # 生成案例分享卡片数据
POST   /api/v1/cases/:id/share                  # 记录分享行为
       Body: { platform: "wechat_friend"|"wechat_moment" }
```

#### 7.17 活动管理扩展

```
# 活动审批（后台，需 admin）
GET    /api/v1/admin/campaigns/approvals        # 待审批活动列表 (?creator_store_id=&status=pending&page=&size=)
PUT    /api/v1/admin/campaigns/:id/approve      # 审批活动
       Body: { action: "approve"|"reject", reject_reason? }

# 我的活动（后台，需 manager 及以上）
GET    /api/v1/admin/campaigns/my               # 我创建的活动列表 (?approval_status=pending|approved|rejected)
```

#### 7.18 CRM 增强

```
# 客户合并（后台，需 admin）
POST   /api/v1/admin/customers/merge            # 客户合并去重
       Body: { primary_id, secondary_ids: number[] }
GET    /api/v1/admin/customers/duplicates        # 检测跨门店重复客户

# 客户分配（后台，需 manager 及以上）
PUT    /api/v1/admin/customers/:id/assign        # 分配专属销售
       Body: { staff_id }
PUT    /api/v1/admin/customers/:id/unassign      # 取消专属销售

# 客户迁移（后台，需 admin）
POST   /api/v1/admin/customers/migrate           # 跨门店客户迁移
       Body: { from_store_id, to_store_id, customer_ids? }
GET    /api/v1/admin/customers/migration-history  # 迁移历史

# 客户关怀（后台，需 manager 及以上）
GET    /api/v1/admin/dashboard/customer-care     # 客户关怀提醒 (?days=3)

# Webhook 配置（后台，需 manager 及以上）
PUT    /api/v1/admin/webhook/config              # 配置门店 Webhook
       Body: { platform, webhook_url, enabled, events }
GET    /api/v1/admin/webhook/config              # 查询 Webhook 配置
GET    /api/v1/admin/webhook/logs                # Webhook 推送日志 (?status=&page=&size=)
```

#### 7.19 AI 队列

```
# AI 生图队列状态（需鉴权）
GET    /api/v1/generations/:id/queue-status      # 查询队列任务状态

# 队列统计（后台，需 admin）
GET    /api/v1/admin/ai-queue/stats              # AI 队列统计
```

#### 7.20 部件面积管理

```
# 部件面积（后台，需 admin）
PUT    /api/v1/admin/vehicles/models/:id/parts/batch        # 批更新部件面积
       Body: { parts: [{ part_code, area_m2 }] }
GET    /api/v1/admin/vehicles/models/:id/parts/area          # 获取面积汇总（需 manager+）
POST   /api/v1/admin/vehicles/models/:id/parts/copy-from/:templateModelId  # 从模板复制面积
```

#### 7.21 短信与登录扩展

```
# 短信验证码登录
POST   /api/v1/auth/sms-login                   # 验证码登录
       Body: { phone, sms_code }

# send-sms-code 扩展 type 值
# type='appointment' — 预约验证码
# type='login' — 登录验证码（已有接口扩展）
```

#### 7.22 数据导出

```
# Dashboard 导出（后台，需 manager 及以上）
POST   /api/v1/admin/dashboard/export/pdf        # 导出 PDF
       Body: { sections: string[], period, date? }
POST   /api/v1/admin/dashboard/export/excel       # 导出 Excel
       Body: { sections: string[], period, date? }
GET    /api/v1/admin/dashboard/exports/:id        # 查询导出任务状态
```

#### 7.23 AR 预览

```
# AR 配置（公共读取）
GET    /api/v1/vehicles/models/:id/ar-config      # 车型 AR 配置（需鉴权）
GET    /api/v1/configurations/:id/ar-texture      # 改色方案 AR 贴图（需鉴权）
```

---

### 八、错误码体系（Phase 4 新增）

在现有错误码枚举中新增以下错误码：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| 1012 | SMS_CODE_WRONG | 400 | 验证码错误，请重新输入 | 验证码不匹配（send-sms-code + verify 共用） |
| 1013 | PHONE_NOT_REGISTERED | 400 | 该手机号未注册，请联系店长创建账号 | 发验证码时手机号未注册为店员（send-sms-code 路径，区别于 4011） |
| 1014 | SMS_CODE_EXPIRED | 400 | 验证码已过期，请重新获取 | 验证码超过 5 分钟有效期 |
| 1015 | SMS_CODE_USED | 400 | 验证码已使用 | 验证码已被消费过 |
| 3018 | COMMENT_NOT_FOUND | 404 | 评论不存在 | 评论 ID 不存在或已删除 |
| 3019 | COMMENT_PERMISSION_DENIED | 403 | 无权删除此评论 | 非作者且非 manager 尝试删除 |
| 4010 | AI_GENERATION_LIMIT_EXCEEDED | 429 | 本日 AI 生图次数已用完，请明日再试 | 每日限额已满 |
| 4011 | PHONE_NOT_REGISTERED_LOGIN | 400 | 该手机号未注册 | 短信登录时手机号未注册为店员（sms-login 路径，区别于 1013） |
| 4012 | COMMENT_CONTENT_TOO_LONG | 400 | 评论内容不能超过 500 字 | 字数超限 |
| 4013 | MERGE_INVALID_PRIMARY | 400 | 主客户 ID 不存在或已删除 | 合并时 primary_id 无效 |
| 4014 | MERGE_SAME_STORE_REQUIRED | 400 | 仅支持跨门店客户合并，同门店请使用编辑功能 | 同门店客户不应合并 |
| 4015 | STAFF_NOT_IN_STORE | 400 | 店员不属于本门店 | 分配专属销售时校验 |
| 4016 | EXPORT_RATE_LIMITED | 429 | 导出请求过于频繁，请 5 分钟后再试 | 同门店导出频率限制 |
| 4017 | CAMPAIGN_APPROVAL_REQUIRED | 400 | 活动需审批通过后方可生效 | 活动未审批 |
| 4018 | AI_QUEUE_FULL | 429 | AI 生图队列已满，请稍后再试 | 队列等待任务数已达上限（500） |
| 4019 | COMMENT_RATE_LIMITED | 429 | 评论过于频繁，请 30 秒后再试 | 同一店员对同一案例 30 秒内评论超限 |
| 5007 | PDF_GENERATION_FAILED | 500 | PDF 生成失败，请重试 | PDF 导出异常 |
| 5008 | WEBHOOK_URL_INVALID | 400 | Webhook URL 必须使用 HTTPS 协议 | URL 格式校验不通过 |

---

### 九、不做的事（Phase 4 更新）

以下为 Phase 1/2/3 中标记为 Phase 4 但 Phase 4 仍不做的项，或 Phase 4 新增的明确排除项：

| 事项 | 原因 |
|------|------|
| 微信支付 / 任何在线支付 | WrapLab 定位为店内工具，交易在线下完成 |
| 多语言 / 国际化 | 当前仅面向中文门店 |
| 所有车型 3D 模型覆盖 | 不保证所有车型都有 3D 模型 |
| 评论的"赞"功能（对评论点赞） | 社区互动简化，仅保留案例级的点赞 |
| 评论举报/申诉机制 | Phase 4 仅做基础评论+审核，举报机制过于复杂 |
| 案例话题/标签系统 | 保持案例结构简洁，通过搜索和排行满足发现需求 |
| 案例的自动推荐/个性化推荐算法 | 推荐系统复杂度高，当前数据量不足以支撑有意义的推荐 |
| 活动 A/B 测试 | 营销系统不包含实验分流能力 |
| AI 生图多服务商支持（同时接入 DALL-E + Stable Diffusion + Midjourney） | 仍维持单一服务商（通过适配器预留扩展），避免运维成本激增 |
| AI 生图效果图智能排序/评分 | AI 生图质量评估需额外引入评价模型 |
| Dashboard 数据对比（同比/环比） | 复杂报表放后续 BI 工具对接 |
| 短信验证码的国际手机号支持 | 当前仅支持中国大陆 +86 手机号 |
| AR 的 WebXR 深度集成（手势识别、空间锚点） | AR 仅做基础的车身叠加预览，高级交互放后续版本 |
| AR 的 iOS ARKit Quick Look 集成 | 优先通过 WebView 通用方案实现，平台专属能力分步迭代 |

以下从 Phase 3 的"不做的事"中移除（已在 Phase 4 实现）：

| 已移除事项 | Phase 4 实现 |
|-----------|-------------|
| ~~案例评论功能~~ | FR-190 ~ FR-199 |
| ~~案例排行榜 / 分享~~ | FR-200 ~ FR-210 |
| ~~AI 生图队列管理与优先级调度~~ | FR-245 ~ FR-253 |
| ~~短信验证码登录（替代密码登录）~~ | FR-262 ~ FR-266 |
| ~~部件面积按实际车型精确测量~~ | FR-254 ~ FR-258 |
| ~~AR 预览~~ | FR-277 ~ FR-279 |
| ~~营销活动自动定时发布/下架~~ | FR-211 ~ FR-214 |
| ~~数据看板导出 PDF/Excel~~ | FR-267 ~ FR-271 |
| ~~客户合并/去重（同一手机号跨门店）~~ | FR-222 ~ FR-226 |
| ~~客户生日/纪念日提醒~~ | FR-227 ~ FR-231 |
| ~~店员与客户绑定（专属销售）~~ | FR-232 ~ FR-237 |

---

### 十、风险与开放项（Phase 4）

| 事项 | 状态 | 说明 |
|------|------|------|
| Bull 队列与 Redis 的运维复杂度 | 待关注 | 引入 Bull 队列后，Redis 不仅是缓存，还承担消息队列职责。Redis 故障将影响 AI 生图功能。需考虑 Redis Sentinel/Cluster 高可用方案 |
| 敏感词过滤服务的接入与成本 | 待确认 | 第三方敏感词服务（如网易易盾）均有调用费用。本地敏感词库方案成本低但覆盖不全。建议初期用本地词库，运营中积累高频敏感词 |
| 小程序码生成接口的配额限制 | 待确认 | 微信 `wxacode.getUnlimited` 接口有每日调用次数限制（通常 10 万次/天），当前规模足够但需关注增长趋势 |
| PDF 生成库的选型 | 待定 | NestJS 环境下的 PDF 生成可选 puppeteer（HTML 模板转 PDF，效果好但资源消耗大）或 pdfkit（原生生成，轻量但排版灵活性差） |
| AR 预览的小程序兼容性 | 待确认 | 微信小程序的 AR 能力（WebXR / VKSession）受基础库版本和机型限制。Phase 4 初期以 WebView 嵌入 WebXR H5 为主，需调研主流机型的兼容性覆盖情况 |
| **FR-257 (P0) 依赖 FR-254~256 (P1)** | **风险** | FR-257（报价计算逻辑使用精确面积）为 P0，但其数据录入途径 FR-254~256 均为 P1。若 P1 未及时完成，报价计算将回退全局默认值 15m²，精确面积能力无法生效。建议将 FR-254（批更新部件面积 API）提升为 P0 或种子数据覆盖主流车型确保 P0 交付时有可用精确数据 |
| 跨门店客户合并的合规性 | 待确认 | 客户数据跨门店合并涉及数据所有权和隐私问题，需法务确认合并操作的合规边界（是否需要客户授权） |
| Webhook 推送的消息模板自定义 | 待定 | 当前使用固定模板，后续可考虑支持门店自定义消息模板（变量替换） |
| 定时任务多实例互斥的 Redis 分布式锁实现 | 待定 | 使用 Redis `SETNX` 简单方案，需验证极端情况下锁释放的可靠性（如实例崩溃时 TTL 未清理） |

---

*Phase 4 需求版本：v1.0*
*编写角色：Product Manager*
*更新日期：2026-07-22*
*变更说明：新增 Phase 4 — 案例社区（评论/排行/分享）、营销自动化（定时发布/审批）、CRM 增强（合并/关怀/绑定/Webhook）、AI 队列、精确面积、短信验证码登录/预约校验、Dashboard 导出、客户迁移、AR 预览 共 16 个模块*

---

## Phase 5 — 多门店与数据智能

**状态**：Draft
**日期**：2026-07-22
**角色**：PM

**优先级定义**（同 Phase 1/2/3/4）：
- **P0** = Phase 5 必须实现，缺失则业务不可用
- **P1** = Phase 5 应该实现，可适当延后但建议包含
- **P2** = Phase 5 后续版本实现

---

### 一、业务场景

#### 1.1 多门店管理

> 当前店员只能属于单一门店。随着连锁门店扩张，店长需要跨店管理、店员需要灵活支援多个门店。Phase 5 引入店员多门店归属机制：一名店员可关联多个门店，登录后选择当前活跃门店进行操作。后台支持完整的门店 CRUD（含位置、营业时间、服务项目、产能配置）以及门店级别的绩效对比看板。

#### 1.2 预约增强

> Phase 3 实现了基础预约功能，但当热门时段约满后客户只能选择其他时间。Phase 5 引入预约候补机制：时段满员后客户可加入候补队列，若有预约取消则自动将首个候补客户提升为正式预约并推送通知。同时引入服务时长粒度——全车改色和局部改色的耗时不同（全天 vs 半天），时段的预约容量据此动态计算。

#### 1.3 数据智能

> Phase 3/4 的 Dashboard 提供了基础 KPI 展示，但缺少同比/环比对比能力。Phase 5 引入看板对比分析（YoY/MoM）、指标下钻（从总览数字逐层穿透到明细数据）、案例智能推荐（"看了这个案例的人也看了..."）和标签系统（管理员打标签，用户按标签筛选）。同时提供门店热力图（地理维度的报价/预约密度分析）、定期报表邮件调度和 BI 工具的 CSV 原始数据导出。

#### 1.4 体验深化

> Phase 5 在多个维度深化用户体验：(1) 离线模式——缓存最近浏览的案例/车型/颜色到本地，断网时仍可浏览历史内容并显示离线提示；(2) 评论赞——对案例评论支持简单上赞（仅赞，不踩），每人每评论仅一票；(3) iOS AR Quick Look——为支持 USDZ 的 Apple 设备生成 .usdz 模型文件，提供原生 AR 快速预览；(4) 案例分享增强——生成视频式预览（封面图 + 颜色渐变动效 + 车型信息），提升微信分享的视觉吸引力。

---

### 二、用户故事

#### 多门店管理

| ID | 角色 | 故事 |
|----|------|------|
| US-230 | 店员 | 作为店员，我想要在多个门店之间切换当前活跃门店，以便支援不同门店时无需重新登录 |
| US-231 | 店长 | 作为店长，我想要管理多个门店（新增/编辑/删除），配置门店的位置、营业时间和服务能力，以便统一管理连锁门店 |
| US-232 | 店长 | 作为店长，我想要查看各门店的营收/预约/报价对比看板，以便识别各门店的经营表现差异 |
| US-233 | 店员 | 作为店员，我登录后想要看到当前所在门店的名称，以便确认我在为正确的门店操作 |
| US-234 | 平台管理员 | 作为平台管理员，我想要将店员分配到多个门店，以便灵活调配人力资源 |

#### 预约增强

| ID | 角色 | 故事 |
|----|------|------|
| US-240 | 客户 | 作为客户，当期望的时段已约满时我想要加入候补队列，以便有客户取消时我能自动获得预约名额 |
| US-241 | 店员 | 作为店员，我想要查看当前门店的候补队列，以便了解预约需求的热度并适时调整排班 |
| US-242 | 店长 | 作为店长，我想要为不同服务类型设置不同时长（全车/局部），以便时段容量的计算更合理 |

#### 数据智能

| ID | 角色 | 故事 |
|----|------|------|
| US-250 | 店长 | 作为店长，我想要查看 Dashboard 指标的同比/环比变化，以便判断门店经营趋势 |
| US-251 | 店长 | 作为店长，我想要点击 Dashboard 指标查看下钻明细数据（如营收 by 销售员、报价 by 品牌），以便定位问题根因 |
| US-252 | 店员 | 作为店员，我在案例详情页想要看到"你可能也喜欢"的推荐案例，以便发现更多灵感和参考 |
| US-253 | 店员 | 作为店员，我想要按标签（如"哑光""渐变""运动风"）筛选案例，以便快速找到特定风格的案例 |
| US-254 | 平台管理员 | 作为平台管理员，我想要为案例打上话题标签，以便统一内容分类和组织 |
| US-255 | 店长 | 作为店长，我想要查看门店热力图（地理维度的客户密度分布），以便优化门店选址和区域性营销 |
| US-256 | 店长 | 作为店长，我想要设置定期报表邮件（如每周一自动发送上周经营周报），以便减少手动导出工作 |
| US-257 | 门店经理 | 作为门店经理，我想要导出 CSV 格式的原始业务数据（自定义日期范围和字段），以便导入 BI 工具做深度分析 |

#### 体验深化

| ID | 角色 | 故事 |
|----|------|------|
| US-260 | 店员 | 作为店员，我想要在网络不好时也能浏览之前看过的案例和车型，以便在店内信号死角仍能服务客户 |
| US-261 | 店员 | 作为店员，我想要给有帮助的评论点赞（上赞），以便表达认同并鼓励优质内容 |
| US-262 | 客户 | 作为 iPhone 客户，我想要通过 iOS AR Quick Look 快速预览改色效果（点击 .usdz 文件即可以原生 AR 查看），以便获得更流畅的 AR 体验 |
| US-263 | 店员 | 作为店员，我想要将案例分享时生成更精美的视频式预览（封面图 + 动效），以便在朋友圈中吸引更多客户点击 |

#### US 编号对照表（服务端 vs 客户端）

> 服务端与客户端采用了不同的 US 编号体系，下表为 Phase 5 用户故事的跨仓库映射：

| 服务端 ID | 客户端 ID | 描述 |
|-----------|-----------|------|
| US-230 | US-40 | 门店切换 |
| US-231 | — | 门店管理 CRUD（仅 Admin 端） |
| US-232 | — | 门店绩效对比看板（仅 Admin 端） |
| US-233 | US-40 | 当前门店指示 |
| US-234 | — | 店员多门店分配（仅 Admin 端） |
| US-240 | US-41 | 预约候补加入与状态 |
| US-241 | — | 候补队列管理（仅 Admin 端） |
| US-242 | — | 服务时长配置（仅 Admin 端） |
| US-250 | — | 看板同比环比（仅 Admin 端） |
| US-251 | — | 看板下钻明细（仅 Admin 端） |
| US-252 | US-42 | 案例推荐"你可能也喜欢" |
| US-253 | US-43 | 案例标签筛选 |
| US-254 | — | 案例标签管理（仅 Admin 端） |
| US-255 | — | 门店热力图（仅 Admin 端） |
| US-256 | — | 定期报表邮件调度（仅 Admin 端） |
| US-257 | — | CSV 原始数据导出（仅 Admin 端） |
| US-260 | US-44 | 离线模式 |
| US-261 | US-45 | 评论上赞 |
| US-262 | US-46 | iOS USDZ AR Quick Look |
| US-263 | US-47 | 案例分享视频式预览 |

> 注：标记为 "—" 的故事仅在服务端/Admin 端实现，客户端无对应 UI。

---

### 三、功能需求

#### 模块 36：店员多门店分配 (Staff Multi-Store Assignment)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-280 | 新建 `staff_store` 中间表，存储店员与门店的多对多关系（staff_id, store_id, role_in_store, assigned_at）。保留现有 `staff.store_id` 作为"主门店"兼容字段，新逻辑以 `staff.current_store_id` 为活跃门店。字段关系说明：(a) 单门店店员：`staff.store_id` 与 `staff.current_store_id` 设置为相同值；(b) 所有业务查询以 `current_store_id` 做门店隔离，`store_id` 仅作为"归属门店"参考和向后兼容；(c) 数据迁移时 `current_store_id` 默认取 `store_id` 的值 | P0 |
| FR-281 | `staff` 表新增 `current_store_id` 字段（BIGINT UNSIGNED, NOT NULL, FK→store.id），记录店员当前活跃门店。每位店员至少有一个关联门店，默认取 `staff_store` 表中最先关联的门店或 `staff.store_id` | P0 |
| FR-282 | 提供 `GET /api/v1/admin/staff/:id/stores` — 查询指定店员关联的所有门店列表（需 admin 角色或本门店 manager）。返回门店 ID、名称、角色、关联时间 | P0 |
| FR-283 | 提供 `PUT /api/v1/admin/staff/:id/stores` — 更新店员的多门店分配（需 admin 角色）。请求体：`{ store_ids: number[], roles?: Record<store_id, role> }`。全量替换模式，校验所有 store_id 存在。若移除当前 `current_store_id`，则自动将店员的 `current_store_id` 切换为剩余门店中的第一个 | P0 |
| FR-284 | 提供 `GET /api/v1/admin/stores/:id/staff` — 查询指定门店的所有店员列表（需 manager 及以上角色，仅限本门店）。返回店员 ID、姓名、角色、是否为当前活跃 | P1 |

#### 模块 37：门店切换与会话管理 (Store Switching & Session)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-285 | 提供 `POST /api/v1/stores/switch` — 店员切换当前活跃门店（需鉴权）。请求体：`{ store_id: number }`。校验店员是否属于该门店（`staff_store` 表中存在关联），若不属于返回 4030 `STORE_ACCESS_DENIED`。切换成功后：(a) 更新 `staff.current_store_id`；(b) 重新签发 JWT（包含新的 store_id），旧 JWT 加入黑名单（Redis，TTL=JWT 剩余有效期）；(c) 返回新 JWT 和门店基本信息 | P0 |
| FR-286 | 提供 `GET /api/v1/stores/current` — 获取当前活跃门店信息（需鉴权，从 JWT 中提取 store_id）。返回门店名称、地址、营业时间、联系电话等基本信息 | P0 |
| FR-287 | 提供 `GET /api/v1/staff/me/stores` — 获取当前登录店员可切换的所有门店列表（需鉴权）。返回门店 ID、名称、角色（`is_current` 标记当前活跃），供前端渲染门店切换器 | P0 |

#### 模块 38：门店管理后台 CRUD (Store Management Admin)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-288 | 提供 `POST /api/v1/admin/stores` — 创建门店（需 admin 角色）。请求体包含：`{ name, address, location: { lat, lng }, business_hours: { open, close, off_days[] }, phone, services_offered: string[], capacity_config: { max_daily_appointments, slot_duration_minutes } }` | P0 |
| FR-289 | 提供 `GET /api/v1/admin/stores/:id` — 获取门店详情（需 manager 及以上角色，manager 仅限查看本门店）。返回完整门店信息含位置坐标、营业时间、服务项目、产能配置、店员数量、创建时间 | P0 |
| FR-290 | 提供 `GET /api/v1/admin/stores` — 门店列表（需 admin 角色）。支持筛选：`?status=active|inactive&region=&keyword=`（按名称搜索），支持分页 | P0 |
| FR-291 | 提供 `PUT /api/v1/admin/stores/:id` — 更新门店信息（需 admin 角色）。请求体同创建接口，部分更新（仅传入需修改的字段）。若更新 `status` 为 inactive，需校验门店无未完成的预约（返回 4038 `STORE_HAS_ACTIVE_APPOINTMENTS`） | P0 |
| FR-292 | 提供 `DELETE /api/v1/admin/stores/:id` — 软删除门店（需 admin 角色）。软删除前校验：(a) 门店无关联的活跃店员；(b) 门店无未完成的预约。校验不通过返回对应错误码。删除操作记录审计日志。注：软删除门店后，需同步软删除 `staff_store` 表中该门店的所有关联记录，并将受影响店员的 `current_store_id` 切换为其剩余关联门店中的第一个（若无剩余门店则标记账号为待分配状态） | P1 |

#### 模块 39：门店绩效看板 (Store Performance Dashboard)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-293 | 提供 `GET /api/v1/admin/stores/:id/dashboard` — 单门店绩效看板（需 manager 及以上角色）。返回该门店指定周期内的核心指标：总营收、报价单数（含转化率）、预约数（含到店率）、新增客户数、Top N 销售员。请求参数：`?period=daily|weekly|monthly&date=`（date 为该周期的代表日期，默认当天） | P0 |
| FR-294 | 提供 `GET /api/v1/admin/stores/comparison` — 多门店绩效对比（需 admin 角色）。请求参数：`?store_ids=1,2,3&period=monthly&date=`。返回各门店在指定周期的指标对比列表（营收、报价数、预约数、转化率、新增客户数），按营收降序排列 | P1 |
| FR-295 | 对比接口支持计算各门店指标相对全平台均值的偏差百分比，便于识别异常门店 | P1 |

#### 模块 40：预约候补队列 (Appointment Waitlist)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-296 | 新建 `appointment_waitlist` 表，存储候补记录（store_id, appointment_date, time_slot_id, customer_name, customer_phone, vehicle_info, service_type, status ENUM: waiting/promoted/cancelled/expired, position, created_at） | P0 |
| FR-297 | 提供 `POST /api/v1/appointments/waitlist` — 加入候补队列（客户侧，无需强制鉴权）。请求体：`{ store_id, appointment_date, time_slot_id, customer_name, customer_phone, vehicle_info, service_type }`。提交时：(a) 校验时段是否确实满员（若已有空位则直接引导创建预约，返回提示"该时段已有空位，建议直接预约"）；(b) 校验同一手机号同一日期同一时段是否已在候补中，避免重复，若重复返回 4032 `ALREADY_IN_WAITLIST`；(c) 队列中该时段等待人数上限默认 20，超出返回 4033 `WAITLIST_FULL`。注：候补提交建议增加短信验证码校验（复用 Phase 4 预约模块的短信验证机制），防止恶意刷候补队列 | P0 |
| FR-298 | 候补自动提升逻辑（事件驱动）：当预约被取消（`POST /api/v1/appointments/:id/cancel`）时，触发候补检查：(a) 查询该日期该时段 status=waiting 的候补记录，按 position 升序取第一条；(b) 将候补记录 status 更新为 promoted，自动创建一份正式预约（复用现有预约创建流程）；(c) 同一时段其余候补记录 position 依次前移（position = position - 1） | P0 |
| FR-299 | 候补提升后通知客户：(a) 短信通知（模板："【WrapLab】您预约的{日期} {时段}已有空位，已自动为您预约成功，请按时到店"）；(b) 小程序模板消息（若客户已授权订阅）。通知发送失败不影响提升操作 | P0 |
| FR-300 | 提供 `GET /api/v1/appointments/waitlist/status` — 客户查询候补状态（需鉴权，通过 customer_phone 匹配）。返回：候补记录 ID、日期、时段、排队位置、状态、预计等待描述（如"前方还有 3 人，预计 1-2 天内可排到"） | P0 |
| FR-301 | 提供 `DELETE /api/v1/appointments/waitlist/:id` — 客户取消候补（需鉴权，校验 customer_phone 归属）。将 status 更新为 cancelled，同队列后方记录 position 前移 | P1 |
| FR-302 | 提供 `GET /api/v1/admin/appointments/waitlist` — 管理员查看候补队列（需 manager 及以上角色，仅限本门店）。支持筛选：`?date=&time_slot_id=&store_id=`，支持分页。返回候补列表含排队位置 | P0 |
| FR-303 | 候补过期清理：每日凌晨定时任务将 `created_at` 超过 7 天且 status=waiting 的记录标记为 expired | P1 |

#### 模块 41：服务时段容量粒度 (Time-Slot Capacity Granularity)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-304 | 新建 `service_type_config` 表，存储每种服务类型的默认时长配置（service_type ENUM: full_wrap/partial_wrap/detail_treatment/color_change/other, duration_minutes, label）。种子数据：seed full_wrap=480分钟(全天), partial_wrap=240分钟(半天), detail_treatment=120分钟, color_change=480分钟, other=120分钟 | P0 |
| FR-305 | `store_service_config` 表（或复用 store.capacity_config JSON 字段）支持门店级别的服务时长覆盖：某门店可针对特定 service_type 自定义 duration_minutes。若门店未配置则使用 `service_type_config` 的全局默认值 | P0 |
| FR-306 | 时段容量计算逻辑更新（修改 Phase 3 FR-148 的容量检查）：(a) 时段的时间范围（如 09:00-12:00）除以该服务类型的 duration_minutes，得到该时段可容纳的预约数；(b) 同一时段可混合不同类型预约（如半天时段可容纳 2 个 partial_wrap 或 1 个 full_wrap 占 2 个半天时段），实现时简化处理——以时段总分钟数除以服务时长计算容量上限 | P0 |
| FR-307 | 提供 `GET /api/v1/stores/:id/service-config` — 获取门店的服务时长配置（公开读取，无需鉴权），供客户端预约页展示不同服务类型的时段选项 | P1 |
| FR-308 | 提供 `PUT /api/v1/admin/stores/:id/service-config` — 更新门店服务时长配置（需 manager 及以上角色）。请求体：`{ services: [{ service_type, duration_minutes }] }` | P1 |

#### 模块 42：看板同比环比 (Dashboard YoY/MoM Comparison)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-309 | 提供 `GET /api/v1/admin/dashboard/comparison` — 看板指标对比（需 manager 及以上角色，按门店隔离）。请求参数：`?compare_type=yoy|mom&period=monthly&date=`（yoy=YoY 同比 Year-over-Year, mom=MoM 环比 Month-over-Month；date 默认为上月/上季最后一天）。返回当前周期 vs 对比周期的指标差异 | P1 |
| FR-310 | 对比指标包含：总营收（含增长率 %）、报价单数（含增长率 %）、预约数（含增长率 %）、转化率（报价→成交）、新增客户数（含增长率 %）、客单价（含增长率 %） | P1 |
| FR-311 | 环比（MoM）定义：当前周期 vs 上一周期。同比（YoY）定义：当前周期 vs 去年同周期。周期支持 monthly（月度对比）和 quarterly（季度对比） | P1 |
| FR-312 | 对比数据使用 Redis 缓存（TTL=1 小时），首次请求同步计算。Dashboard 的 KPI 接口（Phase 3 FR-142）响应体新增对比字段（`last_period_*`），供前端迷你趋势线展示 | P1 |

#### 模块 43：案例推荐引擎 (Case Recommendation)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-313 | 提供 `GET /api/v1/cases/:id/recommendations` — 获取与指定案例相关的推荐案例列表（无需鉴权）。请求参数：`?limit=6`。返回推荐案例的基本信息（标题、封面图、车型颜色摘要、点赞数） | P1 |
| FR-314 | 推荐算法采用混合策略（兼顾效果与实现成本）：(a) 同品牌+同车型的案例（相似度最高，权重 40%）；(b) 同颜色色系（如"哑光"系列）的案例（相似度中等，权重 30%）；(c) 全平台近期热门案例（按点赞数排序，作为兜底填充，权重 30%）。去重：排除当前案例自身。若无足够推荐结果，返回实际可推荐数量（可能 < limit） | P1 |
| FR-315 | 推荐结果使用 Redis 缓存（`case_recommendations:{case_id}`，TTL=24 小时），每日凌晨通过定时任务预计算热门车辆的推荐并写入缓存，冷门案例在首次请求时实时计算并缓存 | P1 |
| FR-316 | 推荐接口支持 `?store_id=` 可选参数，传入时优先推荐本门店发布的案例（门店相关性加成），不传时无门店偏好 | P2 |

#### 模块 44：案例标签系统 (Case Topic/Tag)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-317 | 新建 `case_tag` 表（id, name, color, sort_order, store_id NULLABLE, created_at）和 `case_tag_relation` 中间表（case_id, tag_id, created_at）。store_id 为 NULL 表示平台通用标签，非 NULL 表示门店自定义标签（仅本门店可见） | P1 |
| FR-318 | 提供标签 CRUD（需 admin 角色）：`POST /api/v1/admin/tags` 创建标签（`{ name, color?, sort_order?, store_id? }`，name 同 store_id 下不可重复），`GET /api/v1/admin/tags` 标签列表（`?store_id=&keyword=`，支持分页），`PUT /api/v1/admin/tags/:id` 编辑标签，`DELETE /api/v1/admin/tags/:id` 删除标签（级联删除关联关系） | P1 |
| FR-319 | 提供 `PUT /api/v1/admin/cases/:id/tags` — 为案例设置标签（需 admin 或案例所属门店的 manager）。请求体：`{ tag_ids: number[] }`，全量替换模式 | P1 |
| FR-320 | `GET /api/v1/cases` 案例列表接口新增筛选参数 `?tags=1,2,3`（AND 逻辑，逗号分隔的 tag_ids），返回同时包含所有指定标签的案例 | P1 |
| FR-321 | 提供 `GET /api/v1/tags` — 获取标签列表（公开读取，无需鉴权）。返回所有平台通用标签（store_id IS NULL）和（可选）本门店自定义标签。请求参数：`?store_id=`（可选），供客户端渲染标签筛选栏 | P1 |
| FR-322 | 案例详情接口（`GET /api/v1/cases/:id`）响应体中新增 `tags: [{ id, name, color }]` 字段 | P1 |

#### 模块 45：门店热力图 (Store Heatmap)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-323 | 提供 `GET /api/v1/admin/stores/heatmap` — 门店客户地理密度热力图（需 admin 角色）。请求参数：`?date_from=&date_to=&aggregation=grid|city`（grid=网格聚合, city=城市级聚合），返回 `[{ lat, lng, density }]` 数据点数组，用于前端地图渲染 | P2 |
| FR-324 | 热力图数据来源：(a) 报价记录中客户的所在城市/坐标（若有）；(b) 预约记录中客户地址的经纬度（若有）；(c) 客户档案中的地址信息。若无精确坐标，降级为城市级别的聚合统计 | P2 |
| FR-325 | 热力图服务级别聚合：`?service_type=full_wrap|partial_wrap&date_from=&date_to=`，支持按服务类型筛选密度分布 | P2 |
| FR-326 | 热力图结果使用 Redis 缓存（`store_heatmap:{hash}`，TTL=6 小时），每小时定时任务更新，减少实时计算压力 | P2 |

#### 模块 46：看板下钻 (Dashboard Drill-Down)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-327 | 提供 `GET /api/v1/admin/dashboard/drill-down` — 看板指标下钻明细（需 manager 及以上角色，按门店隔离）。请求参数：`?metric_type=revenue|quotes|appointments|customers&period=monthly&date=&group_by=staff|brand|service_type|day&page=&size=`。根据 `group_by` 返回不同维度的拆分数据 | P1 |
| FR-328 | 下钻规则：(a) metric_type=revenue + group_by=staff → 各销售员贡献的营收排名；(b) metric_type=quotes + group_by=brand → 各汽车品牌的报价数量分布；(c) metric_type=appointments + group_by=day → 每日预约趋势（30 天内逐日数据）；(d) metric_type=customers + group_by=service_type → 各服务类型的客户分布 | P1 |
| FR-329 | 下钻接口支持分页（默认每页 20 条），返回的数据包含当前维度值和对应的指标聚合值 | P1 |
| FR-330 | 下钻数据使用 Redis 缓存（TTL=30 分钟），同一门店同一 metric_type+period 组合共享缓存 | P2 |

#### 模块 47：定期报表导出调度 (Scheduled Export)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-331 | 新建 `scheduled_export` 表，存储定期导出配置（store_id, name, export_type ENUM: pdf/excel/csv, sections JSON, cron_expression, recipients JSON [{ email, phone? }], enabled BOOLEAN, last_executed_at, next_execution_at, created_at, updated_at） | P1 |
| FR-332 | 提供 `POST /api/v1/admin/exports/schedules` — 创建定期导出配置（需 manager 及以上角色，仅限本门店）。请求体：`{ name, export_type, sections, cron_expression, recipients }`。cron_expression 校验合法，recipients 校验 email 格式。同一门店的同一 name 不可重复（返回 4037 `SCHEDULED_EXPORT_DUPLICATE`） | P1 |
| FR-333 | 实现 NestJS Cron 定时任务 `ScheduledExportScheduler`，每分钟扫描 `scheduled_export` 表，对 `enabled=true` 且 `next_execution_at <= NOW()` 的记录：(a) 执行导出（复用 Phase 4 模块 33 的 PDF/Excel 导出能力 + Phase 5 的 CSV 导出）；(b) 将导出文件上传至 OSS；(c) 通过邮件将下载链接发送给 recipients；(d) 更新 `last_executed_at` 和 `next_execution_at`（根据 cron_expression 计算下一次执行时间）；(e) 记录执行日志到 `scheduled_export_log` 表。注：每次定时任务执行时最多处理 5 条待执行记录，防止单次任务执行时间过长阻塞后续调度 | P1 |
| FR-334 | 提供 `GET /api/v1/admin/exports/schedules` — 查询本门店的定期导出配置列表（需 manager 及以上角色）。返回配置列表含上次执行时间、下次执行时间和启用状态 | P1 |
| FR-335 | 提供 `PUT /api/v1/admin/exports/schedules/:id` — 更新定期导出配置（需 manager 及以上角色，仅限本门店）。支持更新 name、export_type、sections、cron_expression、recipients、enabled | P1 |
| FR-336 | 提供 `DELETE /api/v1/admin/exports/schedules/:id` — 删除定期导出配置（需 manager 及以上角色，仅限本门店） | P1 |
| FR-337 | 提供 `GET /api/v1/admin/exports/schedules/:id/logs` — 查看定期导出执行日志（`?page=&size=`，需 manager 及以上角色）。返回执行时间、状态（success/failed）、文件 URL、错误信息 | P1 |

#### 模块 48：BI 数据导出 (BI Data Export)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-338 | 提供 `POST /api/v1/admin/exports/csv` — 导出 CSV 格式的原始业务数据（需 manager 及以上角色，按门店隔离）。请求体：`{ data_type: 'customers'|'quotes'|'appointments'|'revenue', date_from: string, date_to: string, fields?: string[], filters?: object }`。若不传 `fields`，则导出所有标准字段。支持自定义过滤条件（如按品牌、服务类型、销售员筛选） | P1 |
| FR-339 | CSV 导出特性：(a) 第一行为表头（中文字段名）；(b) 日期格式统一为 YYYY-MM-DD HH:mm:ss；(c) 金额字段保留 2 位小数；(d) JSON 字段展开为多列（如 `tags` 数组以逗号分隔的单列展示）；(e) 文件编码 UTF-8 with BOM（兼容 Excel 中文显示） | P1 |
| FR-340 | CSV 导出异步执行（同 PDF/Excel 导出机制，复用 Phase 4 的 `export_task` 表）：提交后返回 `{ export_id, status: 'processing' }`，通过 `GET /api/v1/admin/dashboard/exports/:id` 轮询结果 | P1 |
| FR-341 | CSV 导出数据量上限：单次导出最多 10,000 行（常规业务量下覆盖约 3-6 个月）。超出时返回 4039 `EXPORT_ROW_LIMIT_EXCEEDED`，提示缩小日期范围或分批导出 | P1 |

#### 模块 49：评论赞 (Comment Vote)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-342 | 新建 `comment_vote` 表（comment_id, staff_id, store_id, created_at）。唯一约束：`uk_comment_staff (comment_id, staff_id)` 确保每人每评论仅一票 | P1 |
| FR-343 | 提供 `POST /api/v1/cases/comments/:id/vote` — 评论上赞/取消赞（toggle 模式，需鉴权）。请求体为空。若该店员尚未给该评论点赞，则创建投票记录；若已点赞，则删除投票记录（取消赞）。返回当前评论的赞数（vote_count）和当前用户是否已赞（is_voted） | P1 |
| FR-344 | 评论列表接口（`GET /api/v1/cases/:id/comments`）每条评论新增 `vote_count` 和 `is_voted`（当前登录用户是否已赞，未登录时 is_voted=false）字段。评论按时间倒序排序保持不变（暂不支持按赞数排序） | P1 |
| FR-345 | 赞操作限流：同一店员 1 分钟内最多点赞 30 次（通过 Redis 计数器 `comment_vote_rate:{staff_id}`，TTL=60s），超出时返回 4035 `VOTE_RATE_LIMITED` | P1 |

#### 模块 50：USDZ 模型生成 (USDZ Model Generation)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-346 | `car_model` 表新增 `usdz_url` 字段（VARCHAR(500), NULL），存储 USDZ 格式文件的 OSS URL | P2 |
| FR-347 | 提供 `POST /api/v1/admin/vehicles/models/:id/generate-usdz` — 触发 USDZ 格式转换（需 admin 角色）。后端调用服务端转换工具（如 `usdzconvert` 或 `gltf-to-usdz` CLI），将车型的 glTF/GLB 模型转换为 USDZ，上传至 OSS，更新 `car_model.usdz_url`。转换异步执行，立即返回 `{ status: 'queued' }`，通过轮询或 WebSocket 通知结果。同一车型若已有 usdz_url 且未请求重新生成则返回 4036 `USDZ_GENERATION_ALREADY_EXISTS` | P2 |
| FR-348 | 提供 `GET /api/v1/vehicles/models/:id/usdz` — 获取车型 USDZ 文件信息（需鉴权）。返回 `{ usdz_url, file_size, generated_at }`。若 `usdz_url` 为 NULL 则返回 `{ usdz_url: null, available: false }`，客户端据此判断是否展示 iOS AR Quick Look 入口 | P2 |
| FR-349 | USDZ 转换失败时记录错误日志（`usdz_conversion_log` 表：model_id, status, error_message, created_at），支持手动重试（再次调用 POST generate-usdz） | P2 |

#### 模块 51：离线缓存清单 (Offline Cache Manifest)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-350 | 提供 `GET /api/v1/offline/manifest` — 获取离线缓存清单（需鉴权）。返回客户端可缓存的资源列表及其版本和 TTL。响应体：`{ resources: [{ key: string, type: 'vehicle'|'color'|'case'|'config', url: string, version: string, ttl_seconds: number }], generated_at: string }` | P1 |
| FR-351 | 清单资源范围：(a) 最近 50 条热门案例的封面图 + 基本信息；(b) 当前门店关联的所有车型和颜色数据；(c) 全局配置项（门店营业时间、服务类型列表等）。每个资源带 `version` 字段（由各实体的 `updated_at` 时间戳生成），客户端据此判断是否需要更新本地缓存 | P1 |
| FR-352 | 清单的 `generated_at` 每次请求时实时生成（从数据库/Redis 聚合各资源的版本信息），不额外缓存，确保客户端始终获取最新的版本号 | P1 |
| FR-353 | 清单接口支持增量更新参数 `?since=<timestamp>`：仅返回自该时间戳以来版本发生变化的资源，减少传输量。首次请求（不带 since 参数）返回全量清单 | P1 |

---

### 四、非功能需求（Phase 5 新增）

#### 4.19 门店切换安全性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-173 | 门店切换时旧 JWT 必须立即失效（加入 Redis 黑名单），防止一个账号同时在多门店操作的权限混乱 | P0 |
| NFR-174 | 门店切换操作的审计日志必须记录：切换人 staff_id、源门店 store_id、目标门店 store_id、切换时间、IP 地址 | P0 |

> 注：NFR-175 ~ NFR-179 为预留编号，供后续门店安全相关需求扩展使用。

#### 4.20 候补通知可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-180 | 候补提升通知（短信 + 小程序模板消息）至少送达一种渠道。短信发送失败时重试小程序消息，两者均失败时记录告警日志并通过企业微信 Webhook 通知门店管理员 | P1 |
| NFR-181 | 候补自动提升的数据库操作为原子性事务（更新 waitlist + 创建 appointment），避免并发取消导致同一时段被重复分配 | P0 |

#### 4.21 离线数据安全

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-182 | 缓存在本地的客户手机号等敏感数据必须脱敏后存储（Taro.Storage 中的手机号仅保留前3后4位，如 138****8000），或仅缓存客户 ID 不缓存手机号 | P0 |
| NFR-183 | 离线缓存数据分两级存储：(a) Taro.Storage 缓存文本/JSON 数据，单个 key 最大 1MB，总容量上限 10MB；(b) 文件系统缓存图片等二进制资源，上限 40MB（通过 `Taro.env.USER_DATA_PATH` 存储）。两级合计不超过 50MB。超出时按 LRU 策略淘汰旧数据 | P1 |

#### 4.22 推荐系统性能

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-184 | 案例推荐接口响应时间 < 300ms（基于 Redis 缓存的推荐结果） | P1 |
| NFR-185 | 每门店每日 AI 生图限额从全局默认值提升至可配置：（通过 store.capacity_config.ai_daily_limit 字段控制，默认 20 次/天，VIP 门店可提升） | P1 |

#### 4.23 数据导出可靠性

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-186 | CSV 导出文件大小上限 50MB，超出时分片导出（自动拆分为多个文件并在 ZIP 包中打包），ZIP 包上传至 OSS 返回统一下载链接 | P1 |
| NFR-187 | 定期报表导出在配置的 cron 时间点 ±5 分钟内完成执行（允许调度器的分钟级轮询误差） | P1 |

---

### 五、验收标准（Phase 5）

#### 5.38 店员多门店分配

- [ ] **AC-228**：Given 店员 ID=10 当前仅关联门店 A（store_id=1），平台管理员登录，When `PUT /api/v1/admin/staff/10/stores` 传入 `{ store_ids: [1, 2] }`，Then 返回 200，`staff_store` 表新增（staff_id=10, store_id=2）记录，原有（staff_id=10, store_id=1）记录保留。
- [ ] **AC-229**：Given 店员 ID=10 关联门店 [1, 2]，current_store_id=1，平台管理员更新 stores 为 [2]（移除门店 1），When 更新完成，Then 店员 current_store_id 自动切换为 2，staff_store 表中 store_id=1 的记录被删除。
- [ ] **AC-230**：Given 店员 ID=10 关联门店 [1, 2]，When `GET /api/v1/admin/staff/10/stores`，Then 返回 `[{ store_id: 1, name: "门店A", role: "staff" }, { store_id: 2, name: "门店B", role: "staff" }]`。

#### 5.39 门店切换与会话管理

- [ ] **AC-231**：Given 店员当前在门店 A（store_id=1），JWT 包含 store_id=1，When `POST /api/v1/stores/switch` 传入 `{ store_id: 2 }`（店员属于门店 2），Then 返回新 JWT，解码后 store_id=2，旧 JWT 加入黑名单（使用旧 JWT 访问其他 API 返回 401）。
- [ ] **AC-232**：Given 店员当前在门店 A，尝试切换到门店 3（店员不属于门店 3），When 调用切换接口，Then 返回 403 `{ code: 4030, message: "您不属于该门店，无法切换" }`。
- [ ] **AC-233**：Given 店员登录后有多门店，When `GET /api/v1/staff/me/stores`，Then 返回 `[{ store_id: 1, name: "门店A", is_current: true }, { store_id: 2, name: "门店B", is_current: false }]`。

#### 5.40 门店管理后台 CRUD

- [ ] **AC-234**：Given 平台管理员登录，When `POST /api/v1/admin/stores` 传入完整门店信息，Then 返回 201，门店创建成功，含所有字段（location JSON、business_hours JSON、services_offered 数组、capacity_config JSON）。
- [ ] **AC-235**：Given 门店 A 的 manager 登录，When `GET /api/v1/admin/stores/1`（本门店），Then 返回门店详情。Given 尝试 `GET /api/v1/admin/stores/2`（非本门店），Then 返回 403。
- [ ] **AC-236**：Given 门店 ID=1 有 3 个未完成预约，admin 尝试将门店 status 设为 inactive，When `PUT /api/v1/admin/stores/1` 传入 `{ status: "inactive" }`，Then 返回 400 `{ code: 4038, message: "门店存在未完成的预约，无法停用" }`。

#### 5.41 门店绩效看板

- [ ] **AC-237**：Given 门店 A 本月有 50 个报价单（30 个已成交）、200 个预约（180 个已到店）、营收 150,000 元，When `GET /api/v1/admin/stores/1/dashboard?period=monthly`，Then 返回 total_revenue=150000, quote_count=50, conversion_rate=60%, appointment_count=200, arrival_rate=90%, new_customer_count=N。
- [ ] **AC-238**：Given 平台管理员查询多门店对比 `?store_ids=1,2,3&period=monthly`，When 调用，Then 返回 3 个门店的指标列表，按营收降序，含各指标相对平台均值的偏差百分比。

#### 5.42 预约候补队列

- [ ] **AC-239**：Given 某日期某时段已满，客户提交候补请求，When `POST /api/v1/appointments/waitlist` 传入客户信息，Then 返回 201，`{ waitlist_id: 1, position: 1, status: "waiting" }`。
- [ ] **AC-240**：Given 同一客户再次提交同一日期同时段的候补，When 提交，Then 返回 400 `{ code: 4032, message: "您已在该时段候补队列中，请勿重复提交" }`。
- [ ] **AC-241**：Given 某时段候补队列中有 3 人（position 1/2/3），位置 1 客户的预约被取消，When 取消操作触发候补检查，Then 候补 position=1 的记录 status 更新为 promoted，自动创建正式预约，其余 2 人 position 分别前移为 1 和 2，promoted 客户收到短信通知。
- [ ] **AC-242**：Given 客户在候补队列 position=2，When `GET /api/v1/appointments/waitlist/status?customer_phone=13800138000`，Then 返回 `{ waitlist_id: 1, status: "waiting", position: 2, estimated_description: "前方还有 1 人，预计 1-2 天内可排到" }`。
- [ ] **AC-243**：Given 候补队列已满（该时段 waiting 状态记录数 >= 20），When 新客户提交候补，Then 返回 400 `{ code: 4033, message: "该时段候补队列已满（上限 20 人），请选择其他时段" }`。注：当候补客户被提升为正式预约后（status 从 waiting 变为 promoted），该位置从队列中释放，waiting 计数减少，新的候补名额自动开放。

#### 5.43 服务时段容量粒度

- [ ] **AC-244**：Given 门店配置 full_wrap=480 分钟，时段 09:00-18:00（540 分钟），When 计算该时段容量，Then 最多容纳 floor(540/480)=1 个全车改色预约。
- [ ] **AC-245**：Given 门店配置 partial_wrap=240 分钟，时段 09:00-18:00（540 分钟），When 计算该时段容量，Then 最多容纳 floor(540/240)=2 个局部改色预约。
- [ ] **AC-246**：Given 门店未自定义服务时长配置，When 查询 `GET /api/v1/stores/1/service-config`，Then 返回 `service_type_config` 表的全局默认值（full_wrap=480, partial_wrap=240 等）。

#### 5.44 看板同比环比

- [ ] **AC-247**：Given 门店 A 本月营收 150,000 元，上月营收 120,000 元，When `GET /api/v1/admin/dashboard/comparison?compare_type=mom&period=monthly`，Then 返回 `{ current: { revenue: 150000 }, previous: { revenue: 120000 }, growth: { revenue_pct: 25.0 } }`。
- [ ] **AC-248**：Given 门店 A 本月营收 150,000 元，去年同月营收 100,000 元，When `compare_type=yoy`，Then 返回 `growth.revenue_pct: 50.0`。

#### 5.45 案例推荐引擎

- [ ] **AC-249**：Given 案例 ID=1 是宝马 3 系的哑光黑改色，数据库中有 3 个同车型案例和 2 个同色系案例，When `GET /api/v1/cases/1/recommendations?limit=6`，Then 返回 5 条推荐案例，按相关性排序（同车型在前），每条含标题、封面图、车型颜色摘要、点赞数。
- [ ] **AC-250**：Given 案例 ID=99 是唯一案例（无同品牌同车型），When 请求推荐，Then 返回全平台热门案例作为兜底，数量不超过 6 条，排除案例 99 自身。

#### 5.46 案例标签系统

- [ ] **AC-251**：Given admin 创建标签"哑光系"（color=#666666），When `POST /api/v1/admin/tags`，Then 返回 201，标签创建成功。
- [ ] **AC-252**：Given admin 为案例 ID=1 设置标签 [1, 3]，When `PUT /api/v1/admin/cases/1/tags` 传入 `{ tag_ids: [1, 3] }`，Then 返回 200，`case_tag_relation` 表中案例 1 关联标签 1 和 3。
- [ ] **AC-253**：Given 案例列表查询 `GET /api/v1/cases?tags=1,2`，When 调用，Then 仅返回同时具有标签 1 和标签 2 的案例（AND 逻辑）。
- [ ] **AC-254**：Given 案例详情查询 `GET /api/v1/cases/1`，When 调用，Then 响应体中包含 `tags: [{ id: 1, name: "哑光系", color: "#666666" }, { id: 3, name: "运动风", color: "#FF4444" }]`。

#### 5.47 门店热力图

- [ ] **AC-255**：Given 平台有 50 条报价和 30 条预约包含城市信息，When `GET /api/v1/admin/stores/heatmap?date_from=2026-01-01&date_to=2026-06-30&aggregation=city`，Then 返回各城市的密度数据点 `[{ city: "上海", lat: 31.23, lng: 121.47, density: 25 }, ...]`。
- [ ] **AC-256**：Given 无任何报价/预约数据包含坐标信息，When 请求热力图，Then 返回空数组 `{ data: [], message: "暂无足够的位置数据生成热力图" }`。

#### 5.48 看板下钻

- [ ] **AC-257**：Given 门店 A 本月营收 150,000 元（由 3 名销售贡献），When `GET /api/v1/admin/dashboard/drill-down?metric_type=revenue&period=monthly&group_by=staff`，Then 返回 `[{ staff_name: "张三", revenue: 70000 }, { staff_name: "李四", revenue: 50000 }, { staff_name: "王五", revenue: 30000 }]`。
- [ ] **AC-258**：Given metric_type=appointments + group_by=day，When 查询本月下钻，Then 返回 30 天内每日预约数的时间序列数组。

#### 5.49 定期报表导出调度

- [ ] **AC-259**：Given 门店 A 的 manager 创建每周一 8:00 发送周报的调度，When `POST /api/v1/admin/exports/schedules` 传入 `{ name: "周报", export_type: "pdf", sections: ["kpi","trends"], cron_expression: "0 8 * * 1", recipients: [{ email: "manager@store.com" }] }`，Then 返回 201，`next_execution_at` 计算为下周一 8:00。
- [ ] **AC-260**：Given 定期导出到达 `next_execution_at`，When 定时任务执行，Then 生成 PDF → 上传 OSS → 发送邮件含下载链接 → 更新 `last_executed_at` 和 `next_execution_at`。

#### 5.50 BI 数据导出

- [ ] **AC-261**：Given 门店 A 的 manager 要导出 2026 年 1-6 月的客户数据（CSV），When `POST /api/v1/admin/exports/csv` 传入 `{ data_type: "customers", date_from: "2026-01-01", date_to: "2026-06-30" }`，Then 返回 `{ export_id: 1, status: "processing" }`。
- [ ] **AC-262**：Given CSV 导出完成，下载后检查文件，(a) 第一行为中文表头（姓名、手机号、标签...）；(b) 日期格式为 YYYY-MM-DD HH:mm:ss；(c) 金额保留 2 位小数；(d) UTF-8 with BOM 编码 Excel 可直接打开不乱码。
- [ ] **AC-263**：Given 导出数据量超过 10,000 行，When 提交导出，Then 返回 400 `{ code: 4039, message: "导出数据量超过上限（10,000 行），请缩小日期范围或分批导出" }`。

#### 5.51 评论赞

- [ ] **AC-264**：Given 评论 ID=10 当前 0 赞，店员 A 登录，When `POST /api/v1/cases/comments/10/vote`，Then 返回 `{ vote_count: 1, is_voted: true }`，`comment_vote` 表新增记录（comment_id=10, staff_id=A）。
- [ ] **AC-265**：Given 店员 A 已给评论 10 点赞，When 再次调用 vote 接口，Then 取消赞，返回 `{ vote_count: 0, is_voted: false }`，`comment_vote` 表对应记录被删除。
- [ ] **AC-266**：Given 评论列表查询，When `GET /api/v1/cases/1/comments`，Then 每条评论含 `vote_count` 和 `is_voted`（当前登录用户是否已赞）字段。
- [ ] **AC-267**：Given 店员 A 在 60 秒内点赞超过 30 次，When 第 31 次调用 vote 接口，Then 返回 429 `{ code: 4035, message: "点赞过于频繁，请稍后再试" }`。

#### 5.52 USDZ 模型生成

- [ ] **AC-268**：Given 车型 ID=10 已有 glTF 模型在 OSS，admin 登录，When `POST /api/v1/admin/vehicles/models/10/generate-usdz`，Then 返回 `{ status: "queued" }`，后台异步转换完成后 `car_model.usdz_url` 更新为 OSS 上的 .usdz 文件 URL。
- [ ] **AC-269**：Given 车型 ID=10 已生成 USDZ，When `GET /api/v1/vehicles/models/10/usdz`，Then 返回 `{ usdz_url: "https://oss.xxx.com/models/10/model.usdz", file_size: 5242880, generated_at: "2026-07-22T10:00:00Z" }`。
- [ ] **AC-270**：Given 车型 ID=99 未配置 glTF 模型，When 请求 USDZ 生成，Then 返回 400 `{ code: 3034, message: "该车型未配置 3D 模型，无法生成 USDZ" }`。

#### 5.53 离线缓存清单

- [ ] **AC-271**：Given 店员登录，When `GET /api/v1/offline/manifest`，Then 返回包含最近 50 条案例、当前门店关联的车型/颜色、全局配置的缓存清单，每条含 key、type、url、version、ttl_seconds。
- [ ] **AC-272**：Given 客户端首次请求后本地缓存了所有资源，When 再次请求 `GET /api/v1/offline/manifest?since=2026-07-21T00:00:00Z`，Then 仅返回自该时间以来版本变化的资源（增量更新），未变化的不在返回列表中。

---

### 六、数据库表结构需求（Phase 5 新增）

#### 6.19 店员-门店关联

**staff_store（店员门店关联）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| staff_id | BIGINT UNSIGNED | NOT NULL, INDEX | 店员 ID |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 门店 ID |
| role_in_store | ENUM('staff','manager') | NOT NULL, DEFAULT 'staff' | 在该门店的角色 |
| assigned_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 分配时间 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `UNIQUE KEY uk_staff_store (staff_id, store_id)` — 同一店员在同一门店仅一条记录

#### 6.20 预约候补

**appointment_waitlist（预约候补队列）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 门店 ID |
| appointment_date | DATE | NOT NULL | 预约日期 |
| time_slot_id | BIGINT UNSIGNED | NOT NULL, INDEX | 时段 ID（关联 store_time_slot） |
| customer_name | VARCHAR(50) | NOT NULL | 客户姓名 |
| customer_phone | VARCHAR(20) | NOT NULL | 客户手机号 |
| vehicle_info | VARCHAR(200) | NULL | 车辆信息描述 |
| service_type | ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') | NOT NULL | 服务类型 |
| position | INT UNSIGNED | NOT NULL | 排队位置（1 为最前） |
| status | ENUM('waiting','promoted','cancelled','expired') | NOT NULL, DEFAULT 'waiting', INDEX | 候补状态 |
| promoted_appointment_id | BIGINT UNSIGNED | NULL | 提升后关联的预约 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `KEY idx_slot_status (time_slot_id, appointment_date, status)` — 按时段和状态查询候补
- `KEY idx_phone_date (customer_phone, appointment_date)` — 客户查询自己的候补

#### 6.21 服务类型配置

**service_type_config（服务类型全局时长配置）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| service_type | ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') | NOT NULL, UNIQUE | 服务类型 |
| duration_minutes | INT UNSIGNED | NOT NULL | 默认时长（分钟） |
| label | VARCHAR(50) | NOT NULL | 显示标签（如"全车改色"） |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**种子数据**：
- full_wrap: 480 分钟, "全车改色"
- partial_wrap: 240 分钟, "局部改色"
- detail_treatment: 120 分钟, "细节处理"
- color_change: 480 分钟, "改色方案"
- other: 120 分钟, "其他服务"

#### 6.22 案例标签

**case_tag（案例标签）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| name | VARCHAR(30) | NOT NULL | 标签名称 |
| color | VARCHAR(7) | NOT NULL, DEFAULT '#1890FF' | 标签颜色（十六进制） |
| sort_order | INT UNSIGNED | NOT NULL, DEFAULT 0 | 排序权重 |
| store_id | BIGINT UNSIGNED | NULL, INDEX | 所属门店 ID（NULL=平台通用标签） |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `UNIQUE KEY uk_name_store (name, store_id)` — 同门店下标-签名称唯一(NULL store_id 视为同一组)

**case_tag_relation（案例-标签关联）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| case_id | BIGINT UNSIGNED | NOT NULL, INDEX | 案例 ID |
| tag_id | BIGINT UNSIGNED | NOT NULL, INDEX | 标签 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 关联时间 |

**索引**：
- `UNIQUE KEY uk_case_tag (case_id, tag_id)` — 同一案例同一标签仅一条关联
- `KEY idx_tag_id (tag_id)` — 按标签反向查案例

#### 6.23 评论赞

**comment_vote（评论赞记录）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| comment_id | BIGINT UNSIGNED | NOT NULL | 评论 ID |
| staff_id | BIGINT UNSIGNED | NOT NULL | 点赞店员 ID |
| store_id | BIGINT UNSIGNED | NOT NULL | 门店 ID |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 点赞时间 |

**索引**：
- `UNIQUE KEY uk_comment_staff (comment_id, staff_id)` — 每人每评论仅一票
- `KEY idx_comment_id (comment_id)` — 按评论查赞数

#### 6.24 定期导出配置

**scheduled_export（定期导出配置）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| store_id | BIGINT UNSIGNED | NOT NULL, INDEX | 门店 ID |
| name | VARCHAR(100) | NOT NULL | 配置名称（如"周报"） |
| export_type | ENUM('pdf','excel','csv') | NOT NULL | 导出类型 |
| sections | JSON | NOT NULL | 导出模块（如 `["kpi","trends"]`） |
| cron_expression | VARCHAR(50) | NOT NULL | Cron 表达式 |
| recipients | JSON | NOT NULL | 接收人列表 `[{ email, phone? }]` |
| enabled | TINYINT(1) | NOT NULL, DEFAULT 1 | 是否启用 |
| last_executed_at | DATETIME | NULL | 上次执行时间 |
| next_execution_at | DATETIME | NULL | 下次执行时间 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | 更新时间 |
| deleted_at | DATETIME | NULL | 软删除标记 |

**索引**：
- `UNIQUE KEY uk_store_name (store_id, name)` — 同门店下配置名称唯一
- `KEY idx_next_execution (enabled, next_execution_at)` — 定时任务扫描

**scheduled_export_log（定期导出执行日志）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| schedule_id | BIGINT UNSIGNED | NOT NULL, INDEX | 定期导出配置 ID |
| status | ENUM('success','failed') | NOT NULL | 执行状态 |
| file_url | VARCHAR(500) | NULL | 导出文件 OSS URL |
| error_message | TEXT | NULL | 失败原因 |
| executed_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 执行时间 |

#### 6.25 USDZ 转换日志

**usdz_conversion_log（USDZ 转换日志）**

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT UNSIGNED AUTO_INCREMENT | NOT NULL, PK | 主键 |
| model_id | BIGINT UNSIGNED | NOT NULL, INDEX | 车型 ID |
| status | ENUM('processing','completed','failed') | NOT NULL | 转换状态 |
| error_message | TEXT | NULL | 失败原因 |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 6.26 staff 表新增字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| current_store_id | BIGINT UNSIGNED | NOT NULL, FK→store.id | 当前活跃门店 ID。已有数据迁移时默认取 store_id 的值 |

#### 6.27 car_model 表新增字段

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| usdz_url | VARCHAR(500) | NULL | USDZ 格式模型文件的 OSS URL |

---

### 七、API 接口速览（Phase 5 新增）

#### 7.24 多门店与门店切换

```
# 店员多门店（后台，需 admin 或 manager）
GET    /api/v1/admin/staff/:id/stores              # 查询店员关联门店
PUT    /api/v1/admin/staff/:id/stores              # 更新店员多门店分配
       Body: { store_ids: number[], roles?: Record<store_id, role> }
GET    /api/v1/admin/stores/:id/staff              # 查询门店店员列表（需 manager+）

# 门店切换（需鉴权）
POST   /api/v1/stores/switch                       # 切换活跃门店
       Body: { store_id: number }
GET    /api/v1/stores/current                      # 获取当前活跃门店信息
GET    /api/v1/staff/me/stores                     # 获取我的门店列表（含 is_current）
```

#### 7.25 门店管理后台

```
# 门店 CRUD（后台，需 admin，部分需 manager+）
POST   /api/v1/admin/stores                        # 创建门店
GET    /api/v1/admin/stores                        # 门店列表 (?status=&region=&keyword=&page=&size=)
GET    /api/v1/admin/stores/:id                    # 门店详情（manager 仅限本门店）
PUT    /api/v1/admin/stores/:id                    # 更新门店
DELETE /api/v1/admin/stores/:id                    # 软删除门店

# 门店绩效看板（后台，需 manager+）
GET    /api/v1/admin/stores/:id/dashboard          # 单门店看板 (?period=&date=)
GET    /api/v1/admin/stores/comparison              # 多门店对比 (?store_ids=&period=&date=)
```

#### 7.26 预约候补

```
# 候补（客户侧 + 后台）
POST   /api/v1/appointments/waitlist               # 加入候补
       Body: { store_id, appointment_date, time_slot_id, customer_name, customer_phone, vehicle_info, service_type }
GET    /api/v1/appointments/waitlist/status         # 查询候补状态 (?customer_phone=)
DELETE /api/v1/appointments/waitlist/:id            # 取消候补（需鉴权，校验 phone 归属）

# 候补管理（后台，需 manager+）
GET    /api/v1/admin/appointments/waitlist          # 候补队列列表 (?date=&time_slot_id=&store_id=&page=&size=)
```

#### 7.27 服务时段容量

```
# 服务时长配置（公开读取 + 后台管理）
GET    /api/v1/stores/:id/service-config            # 获取门店服务时长配置（公开）
PUT    /api/v1/admin/stores/:id/service-config       # 更新门店服务时长配置（需 manager+）
       Body: { services: [{ service_type, duration_minutes }] }
```

#### 7.28 看板对比与下钻

```
# 看板对比（后台，需 manager+）
GET    /api/v1/admin/dashboard/comparison           # 看板对比 (?compare_type=yoy|mom&period=monthly&date=)

# 看板下钻（后台，需 manager+）
GET    /api/v1/admin/dashboard/drill-down            # 指标下钻 (?metric_type=revenue|quotes|appointments|customers&period=monthly&date=&group_by=staff|brand|service_type|day&page=&size=)
```

#### 7.29 案例推荐与标签

```
# 案例推荐（公开读取）
GET    /api/v1/cases/:id/recommendations             # 案例推荐 (?limit=6)

# 标签管理（后台 + 公开读取）
GET    /api/v1/tags                                  # 标签列表 (?store_id=)
POST   /api/v1/admin/tags                            # 创建标签（需 admin）
       Body: { name, color?, sort_order?, store_id? }
PUT    /api/v1/admin/tags/:id                        # 编辑标签（需 admin）
DELETE /api/v1/admin/tags/:id                        # 删除标签（需 admin）
PUT    /api/v1/admin/cases/:id/tags                  # 设置案例标签（需 admin 或本门店 manager）
       Body: { tag_ids: number[] }
```

#### 7.30 门店热力图

```
# 热力图（后台，需 admin）
GET    /api/v1/admin/stores/heatmap                  # 门店热力图 (?date_from=&date_to=&aggregation=grid|city&service_type=)
```

#### 7.31 定期报表导出

```
# 定期导出配置（后台，需 manager+）
POST   /api/v1/admin/exports/schedules               # 创建定期导出配置
       Body: { name, export_type, sections, cron_expression, recipients }
GET    /api/v1/admin/exports/schedules               # 查询定期导出配置列表
PUT    /api/v1/admin/exports/schedules/:id            # 更新定期导出配置
DELETE /api/v1/admin/exports/schedules/:id            # 删除定期导出配置
GET    /api/v1/admin/exports/schedules/:id/logs       # 查询执行日志 (?page=&size=)
```

#### 7.32 BI 数据导出

```
# CSV 导出（后台，需 manager+）
POST   /api/v1/admin/exports/csv                     # 导出 CSV 原始数据
       Body: { data_type, date_from, date_to, fields?, filters? }
```

#### 7.33 评论赞

```
# 评论赞（需鉴权）
POST   /api/v1/cases/comments/:id/vote               # 上赞/取消赞（toggle）
```

#### 7.34 USDZ 模型

```
# USDZ 管理（后台 + 客户端读取）
POST   /api/v1/admin/vehicles/models/:id/generate-usdz  # 触发 USDZ 转换（需 admin）
GET    /api/v1/vehicles/models/:id/usdz                  # 获取 USDZ 文件信息（需鉴权）
```

#### 7.35 离线缓存清单

```
# 离线缓存（需鉴权）
GET    /api/v1/offline/manifest                       # 获取缓存清单 (?since=)
```

---

### 八、错误码体系（Phase 5 新增）

在现有错误码枚举中新增以下错误码：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| 3030 | STORE_NOT_EXISTS | 404 | 门店不存在 | 门店 ID 无效或已删除（区别于 Phase 3 的 STORE_NOT_FOUND，此处用于门店管理 CRUD 上下文） |
| 3031 | STAFF_STORE_MISMATCH | 403 | 店员与门店不匹配 | 店员所属门店与请求中的门店不一致，无权操作该门店数据 |
| 3032 | TAG_NOT_FOUND | 404 | 标签不存在 | 标签 ID 无效或已删除 |
| 3033 | WAITLIST_ENTRY_NOT_FOUND | 404 | 候补记录不存在 | 候补 ID 无效或已取消 |
| 3034 | MODEL_NOT_CONFIGURED | 400 | 该车型未配置 3D 模型，无法生成 USDZ | 车型无 glTF/GLB 模型文件，USDZ 转换缺少源文件 |
| 4030 | STORE_ACCESS_DENIED | 403 | 您不属于该门店，无法切换 | 店员尝试切换到未关联的门店 |
| 4031 | STORE_SWITCH_FAILED | 500 | 门店切换失败，请重试 | JWT 签发或更新 current_store_id 异常 |
| 4032 | ALREADY_IN_WAITLIST | 400 | 您已在该时段候补队列中，请勿重复提交 | 同一手机号同一日期同时段重复候补 |
| 4033 | WAITLIST_FULL | 400 | 该时段候补队列已满（上限 20 人），请选择其他时段 | 候补队列容量上限 |
| 4034 | VOTE_ALREADY_CAST | 409 | 您已对该评论点赞 | 保留的错误码，用于并发冲突或数据异常时的防御性返回。正常 toggle 流程中不会触发（重复请求会自动取消赞，不会走到此分支） |
| 4035 | VOTE_RATE_LIMITED | 429 | 点赞过于频繁，请稍后再试 | 60 秒内点赞超过 30 次 |
| 4036 | USDZ_GENERATION_ALREADY_EXISTS | 409 | 该车型已有 USDZ 文件，如需重新生成请先删除 | 防止重复转换覆盖 |
| 4037 | SCHEDULED_EXPORT_DUPLICATE | 409 | 同名定期导出配置已存在 | 同一门店下 name 唯一 |
| 4038 | STORE_HAS_ACTIVE_APPOINTMENTS | 400 | 门店存在未完成的预约，无法停用 | 软删除/停用门店的前置校验 |
| 4039 | EXPORT_ROW_LIMIT_EXCEEDED | 400 | 导出数据量超过上限（10,000 行），请缩小日期范围或分批导出 | CSV 导出行数限制 |
| 4040 | STORE_HAS_ACTIVE_STAFF | 400 | 门店仍有活跃店员，请先转移或移除店员 | 删除门店的前置校验 |
| 5010 | USDZ_GENERATION_FAILED | 500 | USDZ 模型生成失败 | 转换工具异常或模型文件损坏 |
| 5011 | HEATMAP_COMPUTATION_FAILED | 500 | 热力图数据计算失败 | 坐标聚合或数据库查询异常 |
| 5012 | EXPORT_EMAIL_SEND_FAILED | 500 | 定期报表邮件发送失败 | SMTP 或邮件服务异常 |

---

### 九、不做的事（Phase 5 更新）

以下为 Phase 1/2/3/4 中标记为后续版本但 Phase 5 仍不做的项，或 Phase 5 新增的明确排除项：

| 事项 | 原因 |
|------|------|
| 微信支付 / 任何在线支付 | WrapLab 定位为店内工具，交易在线下完成 |
| 多语言 / 国际化 | 当前仅面向中文门店 |
| 所有车型 3D 模型覆盖 | 不保证所有车型都有 3D 模型 |
| 门店之间的库存/物料调拨 | 连锁门店库存管理系统复杂度高，放后续版本 |
| 多门店统一权限管理（RBAC 细粒度） | 当前权限模型（staff/manager/admin）已满足需求，细粒度 RBAC 待规模化后建设 |
| 门店排班/考勤系统 | 属于人力资源系统范畴，非 WrapLab 核心场景 |
| 候补的"顺延多时段"自动匹配（客户勾选多个时段自动排位） | 交互和算法复杂度高，Phase 5 仅做单时段手动候补 |
| 案例推荐的多模态分析（基于图片相似度的推荐） | 算法复杂度高，Phase 5 基于标签+品牌+车型的规则推荐已够用 |
| AI 生图的多风格定制（客户照片融合改色效果） | 需要额外的图像分割+融合模型，成本和技术门槛较高 |
| 离线模式的全量数据同步 | Phase 5 仅做最近浏览内容的缓存，不做全量同步 |
| 评论 "踩" / 点踩功能 | 仅做上赞，保持社区调性正面 |
| USDZ 的 Apple Vision Pro 空间视频格式 | 设备普及率极低，优先支持 iPhone/iPad |
| 案例视频式预览的自动生成（服务端渲染视频） | 技术复杂度高（需要视频合成服务），Phase 5 客户端用 Canvas 帧动画模拟 |
| 多门店实时数据大屏 | 数据大屏为独立可视化项目，通过 BI 导出对接 |

以下从 Phase 4 的"不做的事"中移除（已在 Phase 5 实现）：

| 已移除事项 | Phase 5 实现 |
|-----------|-------------|
| ~~案例话题/标签系统~~ | FR-317 ~ FR-322 |
| ~~案例的个性化推荐~~ | FR-313 ~ FR-316 |
| ~~iOS AR Quick Look USDZ 支持~~ | FR-346 ~ FR-349 |
| ~~离线模式~~ | FR-350 ~ FR-353 |
| ~~评论点赞/点踩（仅做上赞）~~ | FR-342 ~ FR-345 |
| ~~预约排队/候补功能~~ | FR-296 ~ FR-303 |
| ~~Dashboard 同比/环比~~ | FR-309 ~ FR-312 |
| ~~BI 数据导出~~ | FR-338 ~ FR-341 |

---

### 十、风险与开放项（Phase 5）

| 事项 | 状态 | 说明 |
|------|------|------|
| **店员多门店归属时的权限边界** | 待确认 | 店员从门店 A 切换到门店 B 后，是否能查看门店 B 的历史客户数据？建议按"所属门店"隔离，切换后仅可见当前门店的客户和预约 |
| **JWT 黑名单的 Redis 内存压力** | 待关注 | 每次门店切换旧 JWT 进黑名单，若切换频繁（如每日每店员切换 10+ 次），黑名单条目可能累积。建议使用 JWT `jti` + Redis `EXPIREAT` 自动过期清理（过期时间=JWT 剩余有效期） |
| **候补自动提升的并发安全** | 待验证 | 同一时段多个预约同时取消时，候补提升可能产生竞态条件。需确保"查询首位候补 → 提升 → 更新"流程在事务中完成，或使用 Redis 分布式锁（`acquireLock(waitlist_promotion:{time_slot_id})`） |
| **USDZ 转换工具的可用性** | 待定 | 开源的 glTF→USDZ 转换工具（如 `usdzconvert`、`gltf-to-usdz`）的兼容性和稳定性需验证。Apple 官方的 Reality Converter 仅限 macOS，服务端（Linux）需使用社区工具或调用 macOS 构建节点 |
| **离线缓存数据一致性** | 待关注 | 客户端离线缓存的数据可能因服务端更新而过期。manifest 接口的 version 机制可解决增量更新，但客户端需正确处理缓存过期和存储空间清理（LRU） |
| **推荐系统的冷启动问题** | 待关注 | 新门店或新品牌车型上线初期，推荐引擎因数据稀疏无法生成有意义的推荐。Phase 5 通过热门案例兜底缓解，长期需引入内容属性（颜色/材质/车型）的协同过滤 |
| **定期报表邮件的可靠性** | 待关注 | 邮件发送依赖第三方 SMTP 服务，可能存在送达延迟或进入垃圾箱的风险。需配置 SPF/DKIM 记录并使用可靠的邮件发送服务（如 SendCloud、阿里云邮件推送） |
| **标签系统的自由泛滥** | 待关注 | 门店自定义标签缺乏管控可能导致标签冗余和命名不一致。建议初期仅开放平台通用标签（admin 创建），门店自定义标签为 P2 能力 |
| **CSV 大文件导出的内存管理** | 待关注 | 10,000 行 CSV 生成使用流式写入（避免一次性加载全部数据到内存）。若数据量持续增长，考虑使用分片或离线队列异步生成 |
| **门店热力图的地理编码依赖** | 待定 | 客户地址需先地理编码（地址→经纬度）才能参与热力图聚合。地理编码服务（如高德/百度地图 API）有调用配额限制，需评估数据规模和成本 |

---

*Phase 5 需求版本：v1.0*
*编写角色：Product Manager*
*更新日期：2026-07-22*
*变更说明：新增 Phase 5 — 多门店管理（店员多门店分配/门店切换/门店CRUD/绩效看板）、预约增强（候补队列/时段容量粒度）、数据智能（看板同比环比/案例推荐/标签系统/门店热力图/看板下钻/定期报表/BI导出）、体验深化（评论赞/USDZ生成/离线缓存清单）共 16 个模块*
