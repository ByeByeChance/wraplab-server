# 需求文档：wraplab-server Phase 1 — 核心后端 API

**状态**：Draft
**日期**：2026-07-21 | **优先级**：P0/P1

---

## 一、业务场景

车衣门店的销售人员在店内接待客户时，需要在平板/手机上快速完成"选车型 → 3D 看效果 → 选颜色 → 出报价"的完整流程。后端 API 需要支撑小程序的全部数据读写操作，同时为后续后台管理系统提供相同的接口。

当前门店的痛点：
- 车型数据和色卡信息分散在 Excel 和纸质色卡本上，查找效率低
- 改色方案没有系统化保存，客户回头再问时找不到记录
- 报价依赖人工计算，容易出错且不统一

## 二、用户故事

| ID | 角色 | 故事 |
|----|------|------|
| US-01 | 门店销售 | 作为门店销售，我想要按品牌→车系→年代查看可选车型，以便快速定位客户车辆 |
| US-02 | 门店销售 | 作为门店销售，我想要查看所有可用的色卡品牌和颜色，以便为客户推荐颜色 |
| US-03 | 门店销售 | 作为门店销售，我想要将选好的颜色和车型保存为改色方案，以便客户确认后生成报价 |
| US-04 | 门店销售 | 作为门店销售，我想要根据改色方案生成报价单，以便联系客服下单 |
| US-05 | 门店销售 | 作为门店销售，我想要登录系统后才能操作，以确保门店数据安全隔离 |
| US-06 | 门店店长 | 作为门店店长，我想要管理店员的登录账号，以便控制门店系统权限 |
| US-07 | 门店销售 | 作为门店销售，我想要查看不同材质的区别和价格，以便向客户推荐 |

## 三、功能需求

### 模块 1：认证与授权 (FR-01 ~ FR-04)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-01 | 门店店员可通过微信授权或手机号登录系统 | P0 |
| FR-02 | 登录成功后返回 JWT token，token 中需包含 `store_id` 和 `role` | P0 |
| FR-03 | 所有业务 API 需验证 JWT token 有效性，从 token 中提取门店上下文 | P0 |
| FR-04 | 门店店长可创建/停用店员账号（平台管理员有全局权限） | P1 |

### 模块 2：车型数据 (FR-05 ~ FR-08)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-05 | 获取所有汽车品牌列表（按排序字段倒序） | P0 |
| FR-06 | 根据品牌 ID 获取该品牌下的车系列表 | P0 |
| FR-07 | 根据车系 ID 获取该车系下的具体车型（含年款、车身类型、3D 模型 URL） | P0 |
| FR-08 | 车型数据由平台管理员在后台维护（车型数据无门店隔离，全局共享） | P1 |

### 模块 3：色卡与材质 (FR-09 ~ FR-12)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-09 | 获取所有色卡品牌列表（如 3M、AX、HEXIS） | P0 |
| FR-10 | 根据色卡品牌 ID 获取该品牌下的所有颜色（含 HEX、RGB、单价） | P0 |
| FR-11 | 获取所有材质类型列表（哑光/亮面/磨砂/变色龙）及价格系数 | P0 |
| FR-12 | 色卡和颜色的价格支持按门店维度覆盖（不同门店可设置不同价格） | P1 |

### 模块 4：改色方案 (FR-13 ~ FR-17)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-13 | 创建改色方案：选择车型 + 整体颜色 + 客户姓名/电话备注 | P0 |
| FR-14 | 获取门店下的改色方案列表（分页，按创建时间倒序） | P0 |
| FR-15 | 获取单个改色方案的详情（含所有部件颜色配置） | P0 |
| FR-16 | 更新改色方案（修改颜色、客户信息、状态） | P0 |
| FR-17 | 删除改色方案 | P1 |

### 模块 5：报价单 (FR-18 ~ FR-20)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-18 | 根据改色方案生成报价单（自动计算总价 = 各部件面积 × 颜色单价 × 材质系数） | P0 |
| FR-19 | 获取报价单详情（关联的改色方案、部件明细、总价、生成时间） | P0 |
| FR-20 | 报价单关联客服联系方式，支持一键拨号或发送消息 | P1 |

### 模块 6：文件存储 (FR-21)

| 编号 | 需求描述 | 优先级 |
|------|----------|--------|
| FR-21 | 3D 模型文件（glTF/GLB 格式）上传到 OSS，数据库只存 URL | P0 |

---

## 四、非功能需求

| 编号 | 分类 | 需求 | 优先级 |
|------|------|------|--------|
| NFR-01 | 多租户 | 所有业务数据表携带 `store_id`，查询自动按门店过滤 | P0 |
| NFR-02 | 安全 | API 请求需 JWT 鉴权，敏感接口需角色校验（manager 以上） | P0 |
| NFR-03 | 错误处理 | 统一错误响应格式 `{ code, message, data }`，3 层数据校验 | P0 |
| NFR-04 | 数据一致性 | 改色方案和报价单使用数据库事务，确保一致 | P0 |
| NFR-05 | API 规范 | RESTful 风格，路径 `/api/v1/{resource}`，支持分页 `?page=&size=` | P0 |
| NFR-06 | 性能 | 车型列表、色卡列表接口响应时间 < 200ms（缓存优化） | P1 |

---

## 五、验收标准

### 认证模块

- [ ] AC-01: Given 有效的门店店员账号, When 使用手机号+验证码登录, Then 返回 JWT token（含 store_id 和 role）
- [ ] AC-02: Given 无效的账号或密码, When 尝试登录, Then 返回 401 错误
- [ ] AC-03: Given 过期的 JWT token, When 请求业务 API, Then 返回 401 错误并提示重新登录
- [ ] AC-04: Given 没有 token 的请求, When 访问需要鉴权的 API, Then 返回 401 Unauthorized

### 车型数据

- [ ] AC-05: Given 系统中有 5 个品牌数据, When GET /api/v1/vehicles/brands, Then 返回按排序字段排列的品牌列表
- [ ] AC-06: Given 品牌 A 下有 3 个车系, When GET /api/v1/vehicles/series?brandId=A, Then 返回该品牌下的车系列表
- [ ] AC-07: Given 车系 B 下有 5 个车型, When GET /api/v1/vehicles/models?seriesId=B, Then 返回车型列表含 3d_model_url 字段
- [ ] AC-08: Given 数据库中暂无车型数据, When 查询车型列表, Then 返回空数组而非错误

### 色卡与材质

- [ ] AC-09: Given 系统有 3 个色卡品牌, When GET /api/v1/colors/brands, Then 返回色卡品牌列表
- [ ] AC-10: Given 品牌下有 20 个颜色, When GET /api/v1/colors/swatches?brandId=X, Then 返回颜色列表含 hex、rgb、price 字段
- [ ] AC-11: Given 系统有 4 种材质, When GET /api/v1/colors/materials, Then 返回材质列表含 price_multiplier

### 改色方案

- [ ] AC-12: Given 选择了车型 A 和颜色 B, When 创建改色方案 POST /api/v1/configurations, Then 返回创建成功的方案对象，含 id
- [ ] AC-13: Given 门店下有 10 个改色方案, When GET /api/v1/configurations?page=1&size=5, Then 返回 5 条记录和总条数 10
- [ ] AC-14: Given 方案 ID 不存在, When GET /api/v1/configurations/{id}, Then 返回 404 错误
- [ ] AC-15: Given store_id=A, When 查询改色方案列表, Then 只返回 store_id=A 的数据，不返回其他门店的数据

### 报价单

- [ ] AC-16: Given 改色方案已创建, When POST /api/v1/quotes 传入方案 ID, Then 返回报价单，total_price > 0
- [ ] AC-17: Given 报价单已生成, When GET /api/v1/quotes/{id}, Then 返回完整报价单含方案详情和所有部件明细

### 异常流程

- [ ] EF-01: Given 数据库连接失败, When 请求任一 API, Then 返回 500 + 统一错误格式，不暴露内部错误详情
- [ ] EF-02: Given 门店 A 的店员使用门店 B 的 store_id, When 请求获取方案列表, Then 只返回门店 A 的数据
- [ ] EF-03: Given JWT token 签名不正确, When 请求业务 API, Then 返回 401 + "token invalid"
- [ ] EF-04: Given 请求缺少必填字段, When 创建改色方案, Then 返回 400 + 字段校验错误详情

---

## 六、不做的事

| 事项 | 原因 |
|------|------|
| 微信支付集成 | 门店线下收款，非必须 |
| 实时推送/消息系统 | Phase 2 再纳入 |
| 数据统计报表 | Phase 3 后台管理功能 |
| 完整的 CRM 客户管理 | Phase 3 后台管理功能 |
| AI 生图 API 集成 | Phase 2 功能 |
| 门店预约系统 | Phase 3 功能 |
| 营销活动系统 | Phase 3 功能 |
| WebSocket/SSE 实时通信 | 当前无实时场景需求 |

---

## 七、API 接口速览（草案）

> 设计原则：小程序和后台管理共享数据接口，后台独有功能通过 `/api/v1/admin/` 前缀区分，权限由 JWT role 控制。

### 共享接口（小程序 + 后台均可调用）

```
POST   /api/v1/auth/login              # 登录
POST   /api/v1/auth/refresh            # 刷新 token

GET    /api/v1/vehicles/brands         # 品牌列表
GET    /api/v1/vehicles/series         # 车系列表 (?brandId=)
GET    /api/v1/vehicles/models         # 车型列表 (?seriesId=)

GET    /api/v1/colors/brands           # 色卡品牌列表
GET    /api/v1/colors/swatches         # 颜色列表 (?brandId=)
GET    /api/v1/colors/materials        # 材质列表

POST   /api/v1/configurations          # 创建改色方案
GET    /api/v1/configurations          # 方案列表 (?page=&size=)
GET    /api/v1/configurations/{id}     # 方案详情
PUT    /api/v1/configurations/{id}     # 更新方案
DELETE /api/v1/configurations/{id}     # 删除方案

POST   /api/v1/quotes                  # 生成报价单
GET    /api/v1/quotes/{id}             # 报价单详情

POST   /api/v1/files/upload            # OSS 文件上传
```

### 后台专属接口（需 admin / manager 角色）

```
GET    /api/v1/admin/store             # 获取/编辑门店信息
GET    /api/v1/admin/staff             # 店员列表
POST   /api/v1/admin/staff             # 创建店员
PUT    /api/v1/admin/staff/{id}        # 编辑店员

POST   /api/v1/admin/vehicles/brands   # 创建品牌
PUT    /api/v1/admin/vehicles/brands/{id} # 编辑品牌
POST   /api/v1/admin/vehicles/series   # 创建车系
POST   /api/v1/admin/vehicles/models   # 创建车型
PUT    /api/v1/admin/vehicles/models/{id} # 编辑车型

POST   /api/v1/admin/colors/brands     # 创建色卡品牌
POST   /api/v1/admin/colors/swatches   # 创建颜色
PUT    /api/v1/admin/colors/swatches/{id} # 编辑颜色
POST   /api/v1/admin/colors/materials  # 创建材质
PUT    /api/v1/admin/colors/materials/{id} # 编辑材质
```

---

*需求版本：v0.1（Draft）*
*编写角色：🧭 Product Manager*
*更新日期：2026-07-21*
