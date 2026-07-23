# 架构设计：wraplab-server Phase 1

**状态**：Draft
**日期**：2026-07-21 | **角色**：🏛️ Software Architect

---

## 1. 总体架构

```
┌──────────────────────────────────────────────┐
│                 Taro 小程序                     │
│         (wraplab-client: WebView + Three.js)   │
└──────────────┬───────────────────────────────┘
               │ HTTPS / RESTful API
               │ (JWT Auth Header)
┌──────────────▼───────────────────────────────┐
│               API Gateway                      │
│          Nginx / 域名转发                       │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│         NestJS Application (wraplab-server)    │
│                                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Guards   │ │ Filters │ │Interceptors│       │
│  └────▲────┘ └────▲────┘ └────▲────┘         │
│       │           │           │                │
│  ┌────┴───────────┴───────────┴────┐           │
│  │         Controllers              │           │
│  │  (RESTful /api/v1/*)            │           │
│  └──────────────┬──────────────────┘           │
│                 │                              │
│  ┌──────────────▼──────────────────┐           │
│  │          Services                │           │
│  │  (Business Logic + TypeORM)      │           │
│  └──────────────┬──────────────────┘           │
│                 │                              │
│  ┌──────────────▼──────────────────┐           │
│  │         TypeORM Entities         │           │
│  │  (MySQL 8 + store_id scoping)    │           │
│  └──────────────┬──────────────────┘           │
│                 │                              │
└─────────────────┼──────────────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
  MySQL 8      Redis       OSS (阿里云/S3)
  (主库)      (会话/缓存)   (3D模型/图片)
```

---

## 2. 数据库表结构

### 2.1 全局数据表（无门店隔离）

**car_brand — 汽车品牌**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| name | varchar(50) | 品牌名称（如 BMW、奔驰） |
| logo | varchar(255) | 品牌 Logo URL |
| sort_order | int | 排序（数字越大越靠前） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

**car_series — 车系**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| brand_id | int FK | 关联 car_brand |
| name | varchar(50) | 车系名称（如 3系、C级） |
| year_start | int | 起始年款 |
| year_end | int | 截止年款（0=至今） |
| created_at | datetime | |
| updated_at | datetime | |

**car_model — 车型**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| series_id | int FK | 关联 car_series |
| name | varchar(100) | 型号名称 |
| year | int | 年款 |
| body_type | varchar(20) | 车身类型（sedan/suv/coupe） |
| 3d_model_url | varchar(255) | 3D 模型 OSS URL |
| thumbnail_url | varchar(255) | 缩略图 URL |
| created_at | datetime | |
| updated_at | datetime | |

**color_brand — 色卡品牌**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| name | varchar(50) | 品牌名称（3M、AX、HEXIS） |
| description | text | 品牌描述 |
| created_at | datetime | |

**color_swatch — 颜色**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| brand_id | int FK | 关联 color_brand |
| name | varchar(50) | 颜色名称 |
| hex | varchar(7) | HEX 色值（#RRGGBB） |
| rgb_r | int | R 0-255 |
| rgb_g | int | G 0-255 |
| rgb_b | int | B 0-255 |
| price_per_m2 | decimal(10,2) | 每平米单价 |
| image_url | varchar(255) | 色卡实物图 URL |
| created_at | datetime | |

**material — 材质**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| name | varchar(50) | 材质名称（哑光、亮面） |
| description | text | 材质描述 |
| price_multiplier | decimal(3,2) | 价格系数（1.00=基准） |
| image_url | varchar(255) | 材质效果图 URL |
| created_at | datetime | |

### 2.2 业务数据表（带 store_id 多租户）

**store — 门店**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| name | varchar(100) | 门店名称 |
| address | varchar(255) | 地址 |
| phone | varchar(20) | 联系电话 |
| logo | varchar(255) | 门店 Logo |
| status | tinyint | 1=启用 0=停用 |
| created_at | datetime | |

**staff — 店员**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| store_id | int FK | 🔑 关联 store |
| name | varchar(50) | 姓名 |
| phone | varchar(20) | 手机号（登录账号） |
| password | varchar(255) | 密码（bcrypt 加密） |
| role | varchar(20) | 角色：sales / manager |
| avatar | varchar(255) | 头像 URL |
| status | tinyint | 1=启用 0=停用 |
| created_at | datetime | |

**configuration — 改色方案**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| store_id | int FK | 🔑 |
| model_id | int FK | 关联 car_model |
| name | varchar(100) | 方案名称 |
| note | text | 备注 |
| customer_name | varchar(50) | 客户姓名 |
| customer_phone | varchar(20) | 客户电话 |
| status | varchar(20) | draft / quoted / completed |
| thumbnail_url | varchar(255) | 方案缩略图 |
| created_at | datetime | |
| updated_at | datetime | |
| deleted_at | datetime | 软删除 |

**part_color — 部件颜色配置**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| store_id | int FK | 🔑 |
| configuration_id | int FK | 关联 configuration |
| part_code | varchar(20) | 部件编码（HOOD/ROOF/FULL 等） |
| color_swatch_id | int FK | 关联 color_swatch |
| material_id | int FK | 关联 material |
| created_at | datetime | |

**quote — 报价单**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| store_id | int FK | 🔑 |
| configuration_id | int FK | 关联 configuration |
| total_price | decimal(10,2) | 总价 |
| status | varchar(20) | pending / quoted / confirmed |
| staff_id | int FK | 关联 staff（报价人） |
| customer_name | varchar(50) | 客户姓名（冗余） |
| customer_phone | varchar(20) | 客户电话（冗余） |
| remark | text | 备注 |
| created_at | datetime | |
| deleted_at | datetime | 软删除 |

**favorite — 收藏（Phase 2 预留，先建表）**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK AI | 主键 |
| store_id | int FK | 🔑 |
| configuration_id | int FK | 关联 configuration |
| type | varchar(20) | 收藏类型（config / case） |
| created_at | datetime | |

### 2.3 数据模型关系图

```
car_brand ──┬── car_series ──┬── car_model
            │                │
            │                └── configuration ──┬── part_color
            │                    │               │
            │                    │               └── color_swatch
            │                    │                     │
            │                    │                     └── color_brand
            │                    │
            │                    └── quote
            │
color_brand ──┬── color_swatch
              │
              └── material

store ──┬── staff
        │
        ├── configuration (store_id)
        ├── quote (store_id)
        └── favorite (store_id)
```

---

## 3. NestJS 模块结构

```
src/
├── main.ts                           # 入口
├── app.module.ts                     # 根模块
├── common/                           # 公共模块
│   ├── guards/
│   │   ├── jwt-auth.guard.ts         # JWT 鉴权
│   │   └── roles.guard.ts            # 角色校验（sales / manager / admin）
│   ├── decorators/
│   │   ├── current-staff.decorator.ts # 获取当前登录店员
│   │   └── roles.decorator.ts        # 角色装饰器
│   ├── filters/
│   │   └── http-exception.filter.ts  # 统一错误处理
│   ├── interceptors/
│   │   ├── transform.interceptor.ts  # 统一响应格式
│   │   └── store-scope.interceptor.ts # store_id 自动注入
│   ├── middleware/
│   │   └── store-context.middleware.ts # 门店上下文中间件
│   └── dto/
│       └── pagination.dto.ts         # 通用分页 DTO
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts        # POST /auth/login, /auth/refresh
│   │   ├── auth.service.ts
│   │   ├── auth.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts       # JWT 策略（解析 store_id + role）
│   │   └── dto/
│   │       └── login.dto.ts
│   │
│   ├── store/
│   │   ├── store.module.ts
│   │   ├── store.controller.ts       # GET/PUT /admin/store
│   │   ├── store.service.ts
│   │   ├── staff.controller.ts       # CRUD /admin/staff
│   │   └── entities/
│   │       ├── store.entity.ts
│   │       └── staff.entity.ts
│   │
│   ├── vehicle/
│   │   ├── vehicle.module.ts
│   │   ├── vehicle.controller.ts     # GET /vehicles/brands|series|models
│   │   ├── vehicle-admin.controller.ts # CRUD /admin/vehicles/*
│   │   ├── vehicle.service.ts
│   │   └── entities/
│   │       ├── car-brand.entity.ts
│   │       ├── car-series.entity.ts
│   │       └── car-model.entity.ts
│   │
│   ├── color/
│   │   ├── color.module.ts
│   │   ├── color.controller.ts       # GET /colors/brands|swatches|materials
│   │   ├── color-admin.controller.ts # CRUD /admin/colors/*
│   │   ├── color.service.ts
│   │   └── entities/
│   │       ├── color-brand.entity.ts
│   │       ├── color-swatch.entity.ts
│   │       └── material.entity.ts
│   │
│   ├── configuration/
│   │   ├── configuration.module.ts
│   │   ├── configuration.controller.ts # CRUD /configurations
│   │   ├── configuration.service.ts
│   │   └── entities/
│   │       ├── configuration.entity.ts
│   │       └── part-color.entity.ts
│   │
│   ├── quote/
│   │   ├── quote.module.ts
│   │   ├── quote.controller.ts       # POST/GET /quotes
│   │   ├── quote.service.ts          # 价格计算引擎
│   │   └── entities/
│   │       └── quote.entity.ts
│   │
│   └── file/
│       ├── file.module.ts
│       ├── file.controller.ts        # POST /files/upload
│       └── file.service.ts           # OSS 上传服务
│
├── config/
│   ├── database.config.ts            # TypeORM 数据库配置
│   ├── jwt.config.ts                 # JWT 配置
│   └── oss.config.ts                 # OSS 配置
│
├── shared/
│   ├── interfaces/
│   │   └── store-scope.interface.ts  # store_id 接口定义
│   └── types/
│       └── part-code.type.ts         # 部件编码枚举
│
└── database/
    ├── migrations/                   # 数据库迁移文件
    └── seeds/                        # 种子数据
        ├── brands.seed.ts            # 品牌数据
        └── colors.seed.ts            # 色卡数据
```

---

## 4. 多租户实现方案

### 4.1 JWT Token 结构

```json
{
  "sub": 1,
  "store_id": 1,
  "role": "sales",
  "staff_name": "张三",
  "iat": 1620000000,
  "exp": 1620086400
}
```

### 4.2 Store Scope 自动注入

```
请求 → JwtAuthGuard (验证 token) 
     → 解析 store_id → 注入请求对象 req.storeId 
     → StoreScopeInterceptor 
     → 自动拦截所有带 @StoreScoped() 装饰器的查询
     → 在 WHERE 条件中附加 AND store_id = :storeId
```

### 4.3 数据隔离层级

| 层级 | 策略 | 适用表 |
|------|------|--------|
| 全局数据 | 无 store_id，所有门店共享 | car_brand, car_series, car_model, color_brand, color_swatch, material |
| 门店数据 | 带 store_id，查询自动过滤 | configuration, part_color, quote, favorite |
| 用户数据 | store_id + 角色控制 | staff（管理员可查全店，店员只看自己） |

### 4.4 TypeORM 实现

```typescript
// store-scope.subscriber.ts — TypeORM 订阅者
@EventSubscriber()
export class StoreScopeSubscriber implements EntitySubscriberInterface {
  // 在每次 SELECT 前自动注入 store_id 条件
  beforeQuery(event: QueryEvent) {
    if (event.entity?.meta?.storeScoped) {
      event.query.where += ' AND store_id = :storeId';
      event.query.parameters.storeId = StoreContext.getCurrentStoreId();
    }
  }
}
```

---

## 5. API 设计规范

### 5.1 通用约定

| 规范 | 规则 |
|------|------|
| 基础路径 | `/api/v1/{resource}` |
| 分页 | `?page=1&size=10`，响应包含 `{ data: [], total: N, page: N, size: N }` |
| 排序 | `?sort=created_at&order=DESC`（默认按创建时间倒序） |
| 请求体 | JSON，Content-Type: application/json |
| 响应格式 | `{ code: 200, message: "success", data: {...} }` |
| 错误格式 | `{ code: 4xx/5xx, message: "错误描述", errors?: [...] }` |


### 5.2 API 文档

使用 `@nestjs/swagger` 自动生成 OpenAPI 文档，所有 DTO 和 Controller 添加 Swagger 装饰器：

```typescript
@ApiTags('车型管理')
@Controller('vehicles')
export class VehicleController {
  @ApiOperation({ summary: '获取品牌列表' })
  @Get('brands')
  async getBrands() { ... }
}
```

开发环境访问 `http://localhost:3000/api/docs` 查看 Swagger UI。

### 5.3 通用 Guard 链

```
Controller
  → JwtAuthGuard（验证 token 有效性）
  → RolesGuard（校验角色权限，可选）
  → StoreScopeGuard（验证 store_id 一致性）
  → Handler（实际业务逻辑）
```

### 5.4 接口清单（完整版）

详见需求文档 `docs/00_requirements.md` §七。

---

## 6. 价格计算引擎

### 报价单计算规则

```
总价 = Σ(各部件面积 × 颜色单价 × 材质系数)

价格计算公式：
part_total_price = part_color.price_per_m2 × material.price_multiplier × part_area
quote.total_price = Σ(所有 part_total_price)
```

- **部件面积标准**：车型无关的固定面积模板（后续可车型定制）
- **价格精度**：使用 `decimal(10,2)`，避免浮点数精度问题
- **材质系数**：哑光 1.0 / 亮面 1.0 / 磨砂 1.2 / 变色龙 1.5

### 价格模板（车型无关，MVP 阶段使用固定值）

| 部件编码 | 部件名称 | 标准面积 (㎡) |
|----------|----------|--------------|
| HOOD | 引擎盖 | 1.5 |
| ROOF | 车顶 | 1.2 |
| TRUNK | 后备箱盖 | 0.8 |
| FL_DOOR | 左前门 | 0.8 |
| FR_DOOR | 右前门 | 0.8 |
| RL_DOOR | 左后门 | 0.8 |
| RR_DOOR | 右后门 | 0.8 |
| FENDER_FL | 左前翼子板 | 0.4 |
| FENDER_FR | 右前翼子板 | 0.4 |
| BUMPER_F | 前保险杠 | 0.6 |
| BUMPER_R | 后保险杠 | 0.6 |
| MIRROR_L | 左后视镜 | 0.1 |
| MIRROR_R | 右后视镜 | 0.1 |
| **FULL** | **全车统一色** | **8.0** |

---

## 7. 文件存储（OSS）

### 上传流程

```
小程序/后台 → POST /api/v1/files/upload (multipart/form-data)
  → 文件校验（类型 / 大小限制）
  → 生成 OSS 路径: /wraplab/{store_id}/{type}/{uuid}.{ext}
  → 上传到 OSS
  → 返回 URL: https://oss.wraplab.com/{path}
```

### 存储类型

| 类型 | 路径前缀 | 文件类型 | 大小限制 |
|------|----------|----------|----------|
| 3D 模型 | `models/` | .glb, .gltf | 50MB |
| 图片 | `images/` | .jpg, .png, .webp | 10MB |
| 缩略图 | `thumbnails/` | .jpg, .png, .webp | 2MB |

### OSS 访问控制

- 公有读 + 私有写
- 图片支持动态缩放（通过 CDN 参数 `?x-oss-process=image/resize,w_200`）
- 3D 模型通过 CDN 加速分发

---

## 8. 错误处理体系

### 8.1 异常层级

```
HttpException
├── BadRequestException（400）
├── UnauthorizedException（401）
├── ForbiddenException（403）
├── NotFoundException（404）
├── ConflictException（409）
└── InternalServerErrorException（500）
```

### 8.2 HttpExceptionFilter — 统一过滤

```typescript
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const status = exception.getStatus?.() ?? 500;
    const message = exception.message ?? 'Internal Server Error';
    
    response.status(status).json({
      code: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### 8.3 全局校验管道

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // 自动剔除未定义的字段
  forbidNonWhitelisted: true,   // 拒绝未定义字段
  transform: true,              // 自动类型转换
}));
```

---

## 9. 开发环境与启动

### 环境变量 (.env)

```
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=wraplab

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# OSS
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=wraplab

# Redis (可选，Phase 1 可暂不使用)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 启动命令

```bash
# 开发
npm run start:dev

# 数据库迁移
npm run migration:run

# 种子数据
npm run seed

### 数据初始化

**车型数据 seed**：包含常见品牌（BBA/特斯拉/丰田等）、车系、车型。首次部署时通过 `npm run seed` 导入。

**色卡数据 seed**：包含主流色卡品牌（3M/AX/HEXIS）及其颜色数据（HEX + RGB + 单价）。种子数据可从 JSON 文件读取，方便后续更新。

**门店初始化**：系统首次启动时需创建默认门店和管理员账号，通过 seed 脚本或初始化 API 完成。

# 测试
npm run test
```

---

## 10. 技术决策与权衡

| 决策 | 选择 | 备选方案 | 理由 |
|------|------|----------|------|
| ORM | TypeORM | Prisma / Sequelize | 与 NestJS 生态集成最佳，装饰器模式 |
| 鉴权 | JWT | Session | 无状态，适合小程序场景 |
| 多租户 | store_id 列隔离 | 独立数据库 | 轻量级，初期成本低，扩展方便 |
| 报价计算 | 服务端计算 | 前端计算 | 确保计算一致性和数据准确性 |
| 颜色存储 | HEX + RGB 分开存 | 只存 HEX | RGB 方便前端做颜色运算（调亮/调暗） |
| 软删除 | deleted_at 字段 | 物理删除 | 业务数据安全性，方便恢复 |
| 迁移工具 | TypeORM migrations | 手动 SQL | 和 ORM 一致，类型安全 |
| API 文档 | @nestjs/swagger | 手动维护文档 | 自动生成，与代码同步，零维护成本 |
| 缓存策略 | Phase 1 先直接查库，Phase 2 引入 Redis | 一开始就上缓存 | 初期数据量小，Redis 增加复杂度，后期缓存热点数据 |
| 日志框架 | NestJS 内置 Logger | Winston / Pino | 内置 Logger 足够，区分 info/warn/error 级别，后期可切换 |

---

*架构版本：v0.1（Draft）*
*编写角色：🏛️ Software Architect*
*更新日期：2026-07-21*


---

## Phase 2 Architecture -- 体验完善模块

> Phase 2 在 Phase 1 核心选色报价能力基础上，增加案例展示（Case）、AI 生图（Ai）、收藏（Favorite）、WebSocket 实时协作（Ws）、微信登录（Auth 扩展）、短信验证（Sms）、文件上传（File）7 大模块。新增 4 张业务表，错误码扩展至 1006-1008（Auth）、3004-3006（Resource）、4003-4006（Business）、5004（Server）。

### P2.1 Module Architecture Diagram (Extended)

```
src/modules/
│
├── auth/                                  # Phase 1 + Phase 2 extensions
│   ├── auth.module.ts
│   ├── auth.controller.ts                 # POST /auth/login, /auth/refresh
│   │                                      # 【P2新增】POST /auth/wechat-login
│   │                                      # 【P2新增】POST /auth/bind-wechat
│   ├── auth.service.ts                    # 微信 code2session 交换 + openid 绑定
│   ├── guards/
│   │   └── refresh-token.guard.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts               # 增加 token_version 校验 + 60s in-memory cache
│   └── dto/
│       ├── login.dto.ts
│       ├── refresh-token.dto.ts
│       └── wechat-login.dto.ts            # 【P2新增】WechatLoginDto, BindWechatDto
│
├── store/                                 # (Phase 1)
├── vehicle/                               # (Phase 1, unchanged)
├── color/                                 # (Phase 1, unchanged)
├── configuration/                         # (Phase 1, unchanged)
├── quote/                                 # (Phase 1, unchanged)
│
├── file/                                  # 【P2新增】
│   ├── file.module.ts
│   ├── file.controller.ts                 # POST /files/upload?type=images|models
│   ├── file.service.ts                    # OSS adapter pattern (LocalStorageAdapter dev, OSS prod)
│   ├── uploaded-file.interface.ts
│   ├── interfaces/
│   │   └── storage-adapter.interface.ts   # IStorageAdapter (upload/getUrl/delete/exists)
│   └── adapters/
│       └── local-storage.adapter.ts       # 本地磁盘 (开发环境)
│
├── case/                                  # 【P2新增】
│   ├── case.module.ts
│   ├── case.controller.ts                 # GET /cases (public 跨门店), GET /cases/:id
│   │                                      # POST /cases (仅 confirmed 配置可发布)
│   │                                      # PUT /cases/:id, DELETE /cases/:id (软删除)
│   │                                      # POST /cases/:id/like (public, 事务幂等)
│   ├── case.service.ts                    # 事务点赞 (ER_DUP_ENTRY 兜底幂等), view_count 原子自增
│   ├── dto/
│   │   ├── create-case.dto.ts             # CreateCaseDto, UpdateCaseDto
│   │   └── query-case.dto.ts              # QueryCaseDto (分页+排序: like_count|view_count|created_at)
│   └── entities/
│       ├── case.entity.ts                 # title, images(JSON), view_count, like_count, soft-delete
│       └── case-like.entity.ts            # UNIQUE(case_id, staff_id), UNIQUE(case_id, anonymous_id)
│
├── favorite/                              # 【P2新增】
│   ├── favorite.module.ts
│   ├── favorite.controller.ts             # POST /favorites/:configId (幂等), DELETE /favorites/:configId, GET /favorites
│   ├── favorite.service.ts               # 先查后插实现幂等; isFavorited 辅助查询
│   └── entities/
│       └── favorite.entity.ts             # store_id, staff_id, configuration_id
│
├── ai/                                    # 【P2新增】
│   ├── ai.module.ts
│   ├── ai.controller.ts                   # POST /configurations/:id/generate-image (返回202)
│   │                                      # GET /configurations/:id/generations, GET /generations/:id
│   ├── ai-webhook.controller.ts           # POST /internal/ai-callback (@Public + HmacGuard)
│   ├── ai.service.ts                      # Prompt组装 + 月度配额检查 + fire-and-forget + 超时兜底
│   ├── dto/
│   │   └── generate-image.dto.ts          # GenerateImageDto, AiCallbackDto
│   ├── entities/
│   │   └── ai-generation.entity.ts        # status: pending|processing|completed|failed
│   ├── guards/
│   │   └── hmac.guard.ts                  # HMAC-SHA256 + crypto.timingSafeEqual
│   ├── interfaces/
│   │   └── ai-provider.interface.ts       # IAiProvider (generateImage, queryTask)
│   └── adapters/
│       └── openai.provider.ts             # DALL-E 3 (可扩展 StableDiffusion)
│
├── sms/                                   # 【P2新增】
│   ├── sms.module.ts
│   ├── sms.controller.ts                  # POST /auth/send-sms-code (@Public)
│   ├── sms.service.ts                     # crypto.randomInt 生成6位码, Atomic UPDATE 防重复使用
│   ├── sms-cleanup.task.ts                # @Cron EVERY_DAY_AT_3AM 清理过期验证码
│   ├── dto/
│   │   └── send-sms-code.dto.ts           # phone (1[3-9]\\d{9}) + type (login|verify)
│   ├── entities/
│   │   └── sms-code.entity.ts             # phone, code, type, expires_at, used
│   ├── interfaces/
│   │   └── sms-provider.interface.ts      # ISmsProvider (send)
│   └── adapters/
│       ├── aliyun-sms.provider.ts
│       └── tencent-sms.provider.ts
│
└── ws/                                    # 【P2新增】
    ├── ws.module.ts
    ├── viewer.gateway.ts                  # @WebSocketGateway('/ws/3d-viewer')
    │                                      # SET_COLOR / SET_PART_COLOR / SET_MATERIAL
    └── guards/
        └── ws-auth.guard.ts               # JWT from handshake.query.token
```

### P2.2 Database Design -- New Tables

#### P2.2.1 case -- 案例

```sql
CREATE TABLE `case` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT UNSIGNED NOT NULL,
  `configuration_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `cover_image_url` VARCHAR(500) NULL,
  `images` JSON NULL COMMENT '图片URL数组，最多20张',
  `status` ENUM('draft','published') NOT NULL DEFAULT 'published',
  `view_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `like_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `staff_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL COMMENT '软删除',
  INDEX `idx_store_id` (`store_id`),
  INDEX `idx_configuration_id` (`configuration_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_like_count` (`like_count`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### P2.2.2 case_like -- 案例点赞

```sql
CREATE TABLE `case_like` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT UNSIGNED NOT NULL,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `staff_id` BIGINT UNSIGNED NULL COMMENT '已登录用户',
  `anonymous_id` VARCHAR(64) NULL COMMENT '匿名用户标识',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_case_staff` (`case_id`, `staff_id`),
  UNIQUE KEY `uk_case_anonymous` (`case_id`, `anonymous_id`),
  INDEX `idx_case_id` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**设计说明**: 双唯一约束支持已登录用户（按 staff_id 去重）和匿名用户（按 anonymous_id 去重）两种场景。点赞操作在事务内执行 INSERT + INCREMENT like_count，若 INSERT 触发 ER_DUP_ENTRY 则提交事务返回成功（幂等）。

#### P2.2.3 ai_generation -- AI 生图任务

```sql
CREATE TABLE `ai_generation` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `store_id` BIGINT UNSIGNED NOT NULL,
  `configuration_id` BIGINT UNSIGNED NOT NULL,
  `prompt_text` TEXT NOT NULL COMMENT '组装后的完整 Prompt',
  `style` ENUM('scene','studio','outdoor') NOT NULL,
  `status` ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `result_image_url` VARCHAR(500) NULL,
  `error_message` TEXT NULL,
  `staff_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_store_id` (`store_id`),
  INDEX `idx_configuration_id` (`configuration_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### P2.2.4 sms_code -- 短信验证码

```sql
CREATE TABLE `sms_code` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL,
  `code` VARCHAR(6) NOT NULL COMMENT '6位数字验证码',
  `type` ENUM('login','verify') NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_phone_type` (`phone`, `type`),
  INDEX `idx_expires_at` (`expires_at`),
  INDEX `idx_used` (`used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### P2.2.5 ALTER TABLE staff -- 微信登录扩展

```sql
-- 实体中 wechat_openid 已存在，此为 formal DDL
ALTER TABLE `staff` ADD COLUMN `wechat_openid` VARCHAR(100) NULL AFTER `status`;
ALTER TABLE `staff` ADD COLUMN `token_version` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `wechat_openid`;
```

- `wechat_openid`: 微信小程序 openid，用于 wx.login() -> code2session -> openid 快速登录
- `token_version`: 修改密码时自增，配合 JWT payload 中的 token_version 实现"修改密码后所有旧 token 立即失效"
- 实体定义: `Staff` entity 使用 `role: ENUM('admin','manager','staff')`, `status: ENUM('active','disabled')`

### P2.3 API Design -- New Endpoints

#### P2.3.1 案例管理

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/cases` | Public | 案例列表 (跨门店公开，分页+排序) |
| GET | `/api/v1/cases/:id` | Public | 案例详情 (含 view_count 原子自增) |
| POST | `/api/v1/cases` | JWT | 创建案例 (仅 confirmed 配置可发布，防重复) |
| PUT | `/api/v1/cases/:id` | JWT | 更新案例 (store_id 所有权校验) |
| DELETE | `/api/v1/cases/:id` | JWT | 软删除案例 |
| POST | `/api/v1/cases/:id/like` | Public | 点赞 (事务幂等，支持匿名) |

**创建案例 DTO (CreateCaseDto)**:

```typescript
class CreateCaseDto {
  @IsInt() @Min(1)
  configuration_id: number;

  @IsString() @Min(1) @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(500)
  cover_image_url?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20)
  images?: string[];
}
```

**查询案例 DTO (QueryCaseDto)**:

```typescript
class QueryCaseDto {
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1;
  @IsOptional() @IsInt() @Min(1)
  size?: number = 20;
  @IsOptional() @IsInt() @Min(1)
  model_id?: number;
  @IsOptional() @IsInt() @Min(1)
  color_swatch_id?: number;
  @IsOptional() @IsString() @MaxLength(20)
  status?: string = 'published';
  @IsOptional() @IsString() @MaxLength(50)
  sort?: string = 'created_at';  // like_count | view_count | created_at
  get skip(): number { return ((this.page ?? 1) - 1) * (this.size ?? 20); }
  get take(): number { return this.size ?? 20; }
}
```

#### P2.3.2 收藏管理

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/favorites/:configId` | JWT | 添加收藏 (幂等，已存在则直接返回) |
| DELETE | `/api/v1/favorites/:configId` | JWT | 移除收藏 |
| GET | `/api/v1/favorites` | JWT | 收藏列表 (分页，按 created_at DESC) |

**业务逻辑**: 添加前先查询 `staff_id + configuration_id` 是否存在，存在则直接返回（幂等）；添加时校验 configuration 属于本门店且未软删除。

#### P2.3.3 AI 生图

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/configurations/:id/generate-image` | JWT | 提交生图任务 (202 ACCEPTED) |
| GET | `/api/v1/configurations/:id/generations` | JWT | 某方案的历史生图列表 (DESC) |
| GET | `/api/v1/generations/:id` | JWT | 查询生图状态/结果 |
| POST | `/api/v1/internal/ai-callback` | HMAC | AI 服务异步回调 (推送结果) |

**GenerateImageDto**:

```typescript
class GenerateImageDto {
  @IsEnum(['scene', 'studio', 'outdoor'])
  style: 'scene' | 'studio' | 'outdoor';

  @IsOptional() @IsString() @MaxLength(500)
  custom_prompt?: string;
}

class AiCallbackDto {
  @IsInt() @Min(1)
  generation_id: number;
  @IsEnum(['completed', 'failed'])
  status: 'completed' | 'failed';
  @IsOptional() @IsString() @MaxLength(500)
  result_image_url?: string;
  @IsOptional() @IsString()
  error_message?: string;
}
```

**服务端约束**:
- 月度配额: `AI_GENERATION_MONTHLY_QUOTA` 环境变量（默认 100），按 `store_id + created_at >= 月初` 统计
- 超时兜底: `AI_GENERATION_TIMEOUT_MS`（默认 300000ms = 5min），超时后自动将 status 标记为 failed
- 并发控制: 异步 fire-and-forget 模式，POST 立即返回 `{ generation_id, status: 'pending' }` 后由后台 processGeneration() 异步处理

#### P2.3.4 短信验证码

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/send-sms-code` | Public | 发送验证码 |

**SendSmsCodeDto**:

```typescript
class SendSmsCodeDto {
  @IsString() @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @IsEnum(['login', 'verify'])
  type: 'login' | 'verify';
}
```

**频控策略**:
- 60 秒频控: 同一 phone + type 在 60s 内不可重复发送 (查询最近 60s 内记录)
- 日限 10 次: 同一 phone 每日最多 10 条 (COUNT WHERE phone = ? AND created_at >= 当天 00:00)
- 5 分钟过期: `expires_at = NOW() + 5min`
- 定时清理: `@Cron(EVERY_DAY_AT_3AM)` DELETE WHERE `expires_at < NOW()`
- 验证码生成: `crypto.randomInt(100000, 999999)` 保证密码学安全

#### P2.3.5 微信登录（Auth 扩展）

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/wechat-login` | Public | 微信登录 (code -> openid -> JWT) |
| POST | `/api/v1/auth/bind-wechat` | JWT | 绑定微信 (已登录用户关联 openid) |

**WechatLoginDto**:

```typescript
class WechatLoginDto {
  @IsString() @MinLength(1)
  code: string;        // wx.login() 返回的临时 code

  @IsOptional() @IsInt() @Min(1)
  staff_id?: number;   // 绑定场景: 提供已有 staff_id
}

class BindWechatDto {
  @IsString() @MinLength(1)
  code: string;
}
```

**wechatLogin 流程**:
1. `code` -> 微信 `jscode2session` API 换取 `openid`
2. 按 wechat_openid 查 staff: 找到 -> 直接签发 JWT
3. 未找到 + staff_id 提供: bind wechat_openid to staff -> 签发 JWT
4. 未找到 + 无 staff_id: throw `WECHAT_NOT_BOUND`

**bindWechat 流程** (已登录用户):
1. code -> openid
2. 校验 openid 未绑定其他 staff
3. 校验当前 staff 未绑定其他 wechat
4. UPDATE staff SET wechat_openid = ?

#### P2.3.6 文件上传

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/files/upload?type=images\|models\|thumbnails` | JWT | 文件上传 (multipart/form-data, max 50MB) |

**校验规则**:
- 图片 (type=images): mimetype 限制 `image/jpeg|image/png|image/webp`
- 3D 模型 (type=models): extname 限制 `.glb|.gltf`
- 文件大小: max 50MB (`MaxFileSizeValidator`)
- OSS 路径: `wraplab/{store_id}/{type}/{YYYY-MM-DD}/{uuid}.{ext}`
- 适配器模式: `IStorageAdapter` 接口解耦，dev 用 `LocalStorageAdapter`，prod 换 OSS adapter

#### P2.3.7 WebSocket 实时协作

| Namespace | Event | Direction | Payload | Description |
|-----------|-------|-----------|---------|-------------|
| `/ws/3d-viewer` | `SET_COLOR` | Client->Server | `{ color_swatch_id, material_id }` | 设置全车统一色 |
| `/ws/3d-viewer` | `SET_PART_COLOR` | Client->Server | `{ part_code, color_swatch_id, material_id }` | 设置部件颜色 |
| `/ws/3d-viewer` | `SET_MATERIAL` | Client->Server | `{ material_id }` | 设置全部件材质 |
| `/ws/3d-viewer` | `COLOR_APPLIED` | Server->Room | `{ configuration_id, color_swatch_id, material_id }` | 广播全车色变更 |
| `/ws/3d-viewer` | `PART_COLOR_APPLIED` | Server->Room | `{ configuration_id, part_code, color_swatch_id, material_id }` | 广播部件色变更 |
| `/ws/3d-viewer` | `MATERIAL_APPLIED` | Server->Room | `{ configuration_id, material_id }` | 广播材质变更 |
| `/ws/3d-viewer` | `CONNECTED` | Server->Client | `{ configurationId, timestamp }` | 连接成功 |
| `/ws/3d-viewer` | `MODEL_READY` | Server->Client | `{ configurationId, timestamp }` | 模型就绪 |
| `/ws/3d-viewer` | `ERROR` | Server->Client | `{ message, code, timestamp }` | 错误通知 |

**连接鉴权**: 客户端通过 query string 传递 `token` (JWT) + `configurationId`，WsAuthGuard 在握手时校验 JWT 有效性并将 user payload 绑定到 socket。连接后加入 room `config:{configurationId}`，后续变更广播到同 room 所有客户端。

### P2.4 Key Data Flows

#### P2.4.1 AI Image Generation Flow

```
Client                          AiController               AiService                OpenAiProvider
  │                                  │                          │                         │
  │ POST /configs/:id/generate-image │                          │                         │
  │ { style: 'scene',               │                          │                         │
  │   custom_prompt?: '...' }       │                          │                         │
  │─────────────────────────────────►│                          │                         │
  │                                  │ generateImage(id, dto)  │                         │
  │                                  │────────────────────────►│                         │
  │                                  │                          │                         │
  │                                  │                          │ 1. Validate config      │
  │                                  │                          │    belongs to store     │
  │                                  │                          │    (store_id + not      │
  │                                  │                          │     soft-deleted)       │
  │                                  │                          │ 2. Check monthly quota  │
  │                                  │                          │    (COUNT where         │
  │                                  │                          │     store_id + created  │
  │                                  │                          │     >= month start)     │
  │                                  │                          │ 3. Assemble prompt:     │
  │                                  │                          │    brand + series +     │
  │                                  │                          │    model + color.name + │
  │                                  │                          │    material finish +    │
  │                                  │                          │    style preset +       │
  │                                  │                          │    custom_prompt        │
  │                                  │                          │ 4. INSERT ai_generation │
  │                                  │                          │    (status=pending)     │
  │                                  │                          │                         │
  │                                  │                          │ 5. processGeneration()  │
  │                                  │                          │    in background        │
  │                                  │                          │    (fire-and-forget)    │
  │                                  │                          │                         │
  │ { generation_id: 42,            │                          │                         │
  │   status: 'pending' }           │                          │                         │
  │◄─────────────────────────────────│                          │                         │
  │                                  │                          │                         │
  │ (Client polls GET /generations/42 every 5s until            │                         │
  │  status becomes 'completed' or 'failed')                    │                         │
  │                                  │                          │                         │
  │                                  │                          │ [Background Thread]     │
  │                                  │                          │ UPDATE status=processing│
  │                                  │                          │ aiProvider.generateImage│
  │                                  │                          │────────────────────────►│
  │                                  │                          │                         │ POST DALL-E 3
  │                                  │                          │◄── { url } ────────────│
  │                                  │                          │                         │
  │                                  │                          │ UPDATE status=completed │
  │                                  │                          │ + result_image_url      │
  │                                  │                          │                         │
  │                                  │                          │ [Safety timeout 300s]   │
  │                                  │                          │ If still pending/       │
  │                                  │                          │ processing -> fail      │
```

**Prompt 组装逻辑** (AiService.assemblePrompt):

```typescript
const basePrompt = `A ${brandName} ${seriesName} ${modelName} with ${colorName} car wrap`;

const stylePresets: Record<string, string> = {
  scene:   'parked on a city street, natural lighting, photorealistic, 8k',
  studio:  'studio lighting, white background, product photography, 8k',
  outdoor: 'outdoor scenic mountain road, golden hour lighting, photorealistic, 8k',
};

const materialPrompt = materialName === '亮面' ? 'glossy finish' : 'matte finish';

let prompt = `${basePrompt}, ${materialPrompt}, ${stylePresets[dto.style]}`;
if (dto.custom_prompt) prompt += `, ${dto.custom_prompt}`;
```

**Provider 适配器** (IAiProvider interface, DI 注册):

```typescript
interface IAiProvider {
  generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>;
  queryTask(taskId: string): Promise<GenerateImageResult>;
}

// AiModule DI: 根据 AI_PROVIDER env 选择实现
{
  provide: 'IAiProvider',
  useFactory: (httpService: HttpService) =>
    process.env.AI_PROVIDER === 'stable-diffusion'
      ? new OpenAiProvider(httpService) // TODO: swap to StableDiffusionProvider
      : new OpenAiProvider(httpService),
  inject: [HttpService],
}
```

#### P2.4.2 WebSocket Real-Time Collaboration Protocol

```
Client A (销售员A)              Server (ViewerGateway)            Client B (销售员B)
       │                              │                               │
       │ connect /ws/3d-viewer         │                               │
       │ ?token=JWT&configurationId=42 │                               │
       │──────────────────────────────►│                               │
       │                              │ WsAuthGuard.verify(token)     │
       │                              │ Validate config belongs        │
       │                              │   to store (configService      │
       │                              │   .findById)                   │
       │                              │ Join socket.io room:           │
       │                              │   config:42                    │
       │   CONNECTED { configId: 42 } │                               │
       │◄─────────────────────────────│                               │
       │   MODEL_READY  { configId:42}│                               │
       │◄─────────────────────────────│                               │
       │                              │                               │ connect /ws/3d-viewer
       │                              │                               │ ?token=JWT&configId=42
       │                              │                               │──────────────────►
       │                              │                               │ Join room config:42
       │                              │                               │ CONNECTED/MODEL_READY
       │                              │                               │◄───────────────────
       │                              │                               │
       │ SET_COLOR {                  │                               │
       │   color_swatch_id: 15,      │                               │
       │   material_id: 3            │                               │
       │ }                            │                               │
       │─────────────────────────────►│                               │
       │                              │ configService.updatePartColor  │
       │                              │ (configId, 'FULL', 15, 3)     │
       │                              │                               │
       │                              │ COLOR_APPLIED broadcast to    │
       │                              │ room "config:42"              │
       │                              │──────────────────────────────►│
       │◄─────────────────────────────│                               │
       │                              │                               │ 3D 模型实时
       │                              │                               │ 颜色同步更新
       │                              │                               │
       │ SET_PART_COLOR {             │                               │
       │   part_code: 'HOOD',        │                               │
       │   color_swatch_id: 8,       │                               │
       │   material_id: 2            │                               │
       │ }                            │                               │
       │─────────────────────────────►│                               │
       │                              │ configService.updatePartColor  │
       │                              │ PART_COLOR_APPLIED broadcast  │
       │                              │──────────────────────────────►│
```

**连接鉴权 (WsAuthGuard)**:

```typescript
canActivate(context: ExecutionContext): boolean {
  const client = context.switchToWs().getClient<Socket>();
  const token = client.handshake.query.token as string;

  if (!token) {
    client.emit('ERROR', { message: 'Unauthorized: missing token', code: 1000, timestamp: Date.now() });
    client.disconnect();
    return false;
  }

  try {
    const payload = this.jwtService.verify(token, { secret: JWT_ACCESS_SECRET });
    (client as AuthenticatedSocket).user = payload;
    return true;
  } catch {
    client.emit('ERROR', { message: 'Unauthorized: invalid token', code: 1002, timestamp: Date.now() });
    client.disconnect();
    return false;
  }
}
```

#### P2.4.3 WeChat Login Flow

```
Client (微信小程序)            AuthController           AuthService             微信服务器
       │                             │                        │                     │
       │ 1. wx.login()               │                        │                     │
       │─────────────────────────────────────────────────────────────────────────────►│
       │◄── code (临时凭证)           │                        │                     │
       │                             │                        │                     │
       │ POST /auth/wechat-login     │                        │                     │
       │ { code, staff_id? }        │                        │                     │
       │────────────────────────────►│                        │                     │
       │                             │ wechatLogin(code, sid) │                     │
       │                             │───────────────────────►│                     │
       │                             │                        │                     │
       │                             │                        │ GET /sns/            │
       │                             │                        │   jscode2session     │
       │                             │                        │ ?appid=&secret=&code │
       │                             │                        │─────────────────────►│
       │                             │                        │◄── { openid }       │
       │                             │                        │                     │
       │                             │                        │ Lookup staff by     │
       │                             │                        │ wechat_openid       │
       │                             │                        │                     │
       │                             │                        │ ┌─ found:           │
       │                             │                        │ │  check status==    │
       │                             │                        │ │  active → issue JWT│
       │                             │                        │ ├─ not found:       │
       │                             │                        │ │  ┌ staff_id given:│
       │                             │                        │ │  │ verify staff   │
       │                             │                        │ │  │ check openid   │
       │                             │                        │ │  │ not bound      │
       │                             │                        │ │  │ UPDATE bind    │
       │                             │                        │ │  │ issue JWT      │
       │                             │                        │ │  └ no staff_id:   │
       │                             │                        │ │     throw         │
       │                             │                        │ │     WECHAT_NOT_   │
       │                             │                        │ │     BOUND (1006)  │
       │                             │                        │ └                  │
       │                             │                        │                     │
       │ { accessToken,              │                        │                     │
       │   refreshToken,             │                        │                     │
       │   expiresIn }               │                        │                     │
       │◄────────────────────────────│                        │                     │
```

**绑定微信流程 (已登录用户)**:

```
Client (已登录, 带JWT)      AuthController           AuthService
       │                           │                       │
       │ POST /auth/bind-wechat    │                       │
       │ { code }                  │                       │
       │ JWT Header: Bearer <token>│                       │
       │──────────────────────────►│                       │
       │                           │ bindWechat(sub, code) │
       │                           │──────────────────────►│
       │                           │                       │ 1. code -> openid
       │                           │                       │ 2. Check openid not
       │                           │                       │    bound to other staff
       │                           │                       │ 3. Check current staff
       │                           │                       │    has no wechat_openid
       │                           │                       │ 4. UPDATE staff SET
       │                           │                       │    wechat_openid = ?
       │                           │                       │
       │ { success: true }         │                       │
       │◄──────────────────────────│                       │
```

### P2.5 Error Codes (Phase 2 Additions)

Phase 2 新增错误码，不与 Phase 1 冲突，且后续 Phase 3 不再使用以下编号：

```
// Auth 1xxx — Phase 2 新增
WECHAT_NOT_BOUND      = 1006   // 微信未绑定，请先用手机号登录后绑定微信
WECHAT_LOGIN_FAILED   = 1007   // 微信登录失败 (jscode2session 返回错误或超时)
WECHAT_ALREADY_BOUND  = 1008   // 该微信已绑定其他账号

// Resource 3xxx — Phase 2 新增
PART_NOT_FOUND        = 3004   // 部件不存在
CASE_NOT_FOUND        = 3005   // 案例不存在
GENERATION_NOT_FOUND  = 3006   // 生图任务不存在 ← 注意: Phase 3 的 STORE_NOT_FOUND 必须跳过3006, 使用 3019

// Business 4xxx — Phase 2 新增
SMS_RATE_LIMITED            = 4003   // 验证码发送过于频繁（60秒频控或日限10次）
SMS_CODE_INVALID            = 4004   // 验证码错误或已失效
CONFIGURATION_NOT_CONFIRMED = 4005   // 方案未确认，不可发布为案例
AI_GENERATION_QUOTA_EXCEEDED = 4006  // 本月 AI 生图次数已用完

// Server 5xxx — Phase 2 新增
AI_SERVICE_ERROR     = 5004   // AI 服务调用失败 (DALL-E API error / network timeout)
```

### P2.6 Security Considerations

#### P2.6.1 HMAC Callback Verification (timingSafeEqual)

AI 服务回调使用 HMAC-SHA256 签名验证，防止伪造回调请求：

```typescript
// HmacGuard.canActivate()
const rawBody = request.rawBody as string; // 原始未解析 body 保证签名确定性
const signature = request.headers['x-signature'] as string;

if (!signature) {
  throw new BusinessException(ErrorCode.FORBIDDEN, 'Missing callback signature');
}

const secret = process.env.AI_CALLBACK_SECRET;
const expected = crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');

// 使用 timingSafeEqual 防止时序攻击
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  throw new BusinessException(ErrorCode.FORBIDDEN, 'Invalid callback signature');
}
```

**安全要点**:
- `timingSafeEqual` 而非 `===`：防止通过比较耗时推断有效签名（时序攻击）
- `rawBody` 而非 `JSON.stringify(body)`：保证签名计算与回调发送方一致，避免 JSON 序列化差异导致的签名不匹配
- 回调端点标记 `@Public()` + `@UseGuards(HmacGuard)`：绕过 JWT 鉴权但保留 HMAC 验证

#### P2.6.2 SMS Rate Limiting (4-Layer Defense)

```
Layer 1: 60s per-phone rate limit
  SELECT * FROM sms_code
  WHERE phone = ? AND type = ? AND created_at > NOW() - INTERVAL 60 SECOND
  → if found: throw SMS_RATE_LIMITED (4003)

Layer 2: 10/day per-phone limit
  SELECT COUNT(*) FROM sms_code
  WHERE phone = ? AND created_at >= CURDATE()
  → if >= 10: throw SMS_RATE_LIMITED (4003)

Layer 3: 5-minute expiry
  expires_at = NOW() + 5 minutes
  → Atomic verify: UPDATE WHERE used=0 AND expires_at > NOW()

Layer 4: Cron cleanup
  @Cron(EVERY_DAY_AT_3AM)
  DELETE FROM sms_code WHERE expires_at < NOW()
```

#### P2.6.3 Atomic SMS Verification

防止同一验证码被并发请求重复使用：

```typescript
async verifyCode(phone: string, code: string, type: 'login' | 'verify'): Promise<boolean> {
  // Step 1: Atomic UPDATE — 将首个匹配行标记为已使用
  const result = await this.smsCodeRepo.update(
    { phone, type, used: 0, expires_at: MoreThan(new Date()) },
    { used: 1 },
  );

  // affected=0 意味着: 验证码不存在 / 已过期 / 已被使用
  if (!result.affected || result.affected === 0) {
    throw new BusinessException(ErrorCode.SMS_CODE_INVALID, '验证码错误或已失效');
  }

  // Step 2: 二次确认 code 值匹配
  const smsCode = await this.smsCodeRepo.findOne({
    where: { phone, type, used: 1, expires_at: MoreThan(new Date()) },
    order: { created_at: 'DESC' },
  });

  if (!smsCode || smsCode.code !== code) {
    throw new BusinessException(ErrorCode.SMS_CODE_INVALID, '验证码错误或已失效');
  }

  return true;
}
```

**并发安全分析**: UPDATE 的 `WHERE used=0` 条件在数据库层面是原子的。两个并发请求同时验证同一手机号时，只有第一个 UPDATE 的 `affected` > 0，第二个请求获得 `affected=0` 直接拒绝。

#### P2.6.4 Case Like Idempotency (Transaction + ER_DUP_ENTRY)

点赞操作使用事务 + 唯一约束实现幂等：

```typescript
async like(id: number, anonymousId?: string): Promise<{ like_count: number; is_liked: boolean }> {
  const caseEntity = await this.caseRepo.findOne({ where: { id, deleted_at: IsNull() } });
  if (!caseEntity) throw new BusinessException(ErrorCode.CASE_NOT_FOUND);

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    await queryRunner.manager.insert(CaseLike, { case_id: id, staff_id, store_id, ... });
    await queryRunner.manager.increment(Case, { id }, 'like_count', 1);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // 重复点赞 → 幂等返回成功，不抛异常
      await queryRunner.commitTransaction();
      const updated = await this.caseRepo.findOne({ where: { id } });
      return { like_count: updated?.like_count ?? 0, is_liked: true };
    }
    throw err;
  }

  await queryRunner.commitTransaction();
  const updated = await this.caseRepo.findOne({ where: { id } });
  return { like_count: updated?.like_count ?? 0, is_liked: true };
}
```

#### P2.6.5 JWT Token Version Invalidation

修改密码后，`staff.token_version` 自增。JWT payload 中包含 `token_version` 字段。`JwtStrategy.validate()` 每次请求时校验 payload 中的 token_version 与数据库值一致。不一致则拒绝请求，实现"修改密码后所有旧 token 立即失效"。

配合 60 秒 in-memory cache 减少数据库查询：

```typescript
// JwtStrategy.validate()
const cached = this.statusCache.get(payload.sub);
if (cached && Date.now() - cached.ts < 60_000) {
  if (!cached.active || cached.tokenVersion !== payload.token_version) {
    throw new BusinessException(ErrorCode.ACCOUNT_DISABLED, '账号已被停用或密码已修改，请重新登录');
  }
  return payload;
}
// ... fallback to DB query
```

#### P2.6.6 Favorite Idempotency (Check-Before-Insert)

收藏的幂等通过先查后插实现（非事务路径，适合低并发场景）：

```typescript
async add(configId: number): Promise<Favorite> {
  const config = await this.configRepo.findOne({
    where: { id: configId, store_id: storeId, deleted_at: IsNull() },
  });
  if (!config) throw new BusinessException(ErrorCode.CONFIGURATION_NOT_FOUND);

  // Idempotent check: restore existing favorite
  const existing = await this.favoriteRepo.findOne({
    where: { staff_id, configuration_id: configId },
  });
  if (existing) return existing; // 幂等返回已有记录

  const favorite = this.favoriteRepo.create({ store_id, staff_id, configuration_id: configId });
  return this.favoriteRepo.save(favorite);
}
```

---

### P3.1 NestJS 模块架构（Phase 3 全景）

#### P3.1.1 新增模块

```
AppModule (Phase 3)
│
│  === Phase 1/2 模块（不变）===
├── ConfigModule (global)
├── DatabaseModule (global)
├── CommonModule (global)
├── AuthModule
├── VehicleModule
├── ColorModule
├── ConfigurationModule ─── 修改: 发布 CustomerCreatedEvent
├── QuoteModule ─────────── 修改: 新增 updateStatus()
├── StoreModule
├── FileModule
├── PartModule
├── CaseModule
├── FavoriteModule
├── AiModule
├── SmsModule
├── WsModule
│
│  === Phase 3 新增模块 ===
├── StoreLocationModule ──── 门店地理位置 (多租户, 与 store 一对一)
│   ├── StoreLocationController     (PUT|GET /api/v1/admin/store/location  — manager+)
│   │                               (GET  /api/v1/stores/nearby|:id        — 公开)
│   └── StoreLocationService
│
├── AppointmentModule ────── 预约管理 (多租户, 部分公开)
│   ├── AppointmentController       (POST /api/v1/appointments              — 公开 + IP限流)
│   │                               (GET  /api/v1/appointments/service-types — 公开)
│   │                               (GET  /api/v1/appointments/slots         — 公开)
│   │                               (GET  /api/v1/appointments/mine/*       — JWT)
│   │                               (PUT  /api/v1/appointments/mine/:id/cancel — JWT)
│   ├── AdminAppointmentController  (GET|PUT /api/v1/admin/appointments/*   — manager+)
│   │                               (GET  /api/v1/admin/appointments/calendar — manager+)
│   └── AppointmentService
│
├── CampaignModule ────────── 营销活动 + 核销 (跨门店共享)
│   ├── CampaignController          (GET  /api/v1/campaigns/available       — 公开)
│   │                               (POST /api/v1/campaigns/:id/view        — 公开 + IP去重)
│   │                               (POST /api/v1/quotes/:id/apply-campaign — JWT + staff+)
│   ├── AdminCampaignController     (POST|GET|PUT|DELETE /api/v1/admin/campaigns/* — manager+)
│   │                               (GET  /api/v1/admin/campaigns/:id/analytics — manager+)
│   ├── CampaignService
│   └── CampaignClaimService        (核销逻辑, 读写 Quote + 写入 campaign_claim)
│
├── DashboardModule ───────── 数据统计看板 (多租户, Redis 缓存)
│   ├── DashboardController         (GET /api/v1/admin/dashboard/kpi             — manager+)
│   │                               (GET /api/v1/admin/dashboard/trends          — manager+)
│   │                               (GET /api/v1/admin/dashboard/top-rankings    — manager+)
│   │                               (GET /api/v1/admin/dashboard/staff-performance — manager+)
│   └── DashboardService
│
└── CustomerModule ────────── CRM 客户管理 (多租户)
    ├── CustomerController          (GET|PUT /api/v1/admin/customers/*       — manager+)
    │                               (POST /api/v1/admin/customers/:id/notes  — manager+)
    │                               (POST /api/v1/admin/customers/import     — manager+)
    │                               (GET  /api/v1/admin/customers/export     — manager+)
    ├── CustomerService
    └── CustomerSyncSubscriber       (事件订阅者 — 监听 ConfigurationCreated 自动同步客户)
```

#### P3.1.2 Phase 3 模块依赖关系图

```
                          ┌──────────────────┐
                          │   CommonModule    │  (global)
                          └────────┬─────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────▼──────┐          ┌──────▼──────┐          ┌──────▼─────┐
    │  AuthModule │          │VehicleModule │         │ ColorModule │
    │  (不变)     │          │  (不变)      │         │  (不变)     │
    └─────────────┘          └──────────────┘         └─────────────┘

          │          ┌───────────────────────┼───────────────────────┐
          │          │                       │                       │
    ┌─────▼────┐ ┌───▼──────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
    │  Store   │ │Configuration │  │    QuoteModule    │  │    SmsModule      │
    │  Module  │ │   Module     │  │   (modified)      │  │    (复用)          │
    │ (不变)   │ │  (modified)  │  │                   │  │                   │
    └────┬─────┘ │              │  │ + updateStatus()  │  └───────────────────┘
         │       │ + EventBus   │  └────────┬──────────┘
         │       └──────┬───────┘           │
         │              │                   │
         │              │ EventBus:         │
         │              │ ConfigurationCreated │
         │              │                   │
    ┌────▼──────────────┼───────────────────┼──────────────────┐
    │                   │                   │                   │
    │  === Phase 3 新增模块 ================│================== │
    │                   │                   │                   │
    │  ┌────────────────▼──┐  ┌─────────────▼──────┐  ┌───────▼──────────┐
    │  │  StoreLocation    │  │   Appointment      │  │   Campaign       │
    │  │     Module        │  │     Module         │  │     Module       │
    │  │                   │  │                    │  │                  │
    │  │  depends:         │  │  depends:          │  │  depends:        │
    │  │  Store (验证)     │  │  StoreLocation     │  │  Quote (核销读    │
    │  │                   │  │  (读 capacity)     │  │   写 quote)      │
    │  │                   │  │  Sms (可选, TS=N)  │  │  Customer (校验) │
    │  │                   │  │  Configuration     │  │                  │
    │  │                   │  │  (关联方案)        │  │  campaign 表     │
    │  │                   │  │                    │  │  无 store_id     │
    │  │                   │  │                    │  │  (JSON 字段跨    │
    │  │                   │  │                    │  │   门店共享)      │
    │  └───────────────────┘  └────────────────────┘  └──────────────────┘
    │
    │  ┌─────────────────────┐  ┌──────────────────────────┐
    │  │    Dashboard        │  │      Customer            │
    │  │      Module         │  │       Module             │
    │  │                     │  │                          │
    │  │  depends:           │  │  depends:                │
    │  │  Quote (聚合查询)   │  │  Configuration (关联)    │
    │  │  Configuration      │  │  Quote (关联)            │
    │  │  Redis (缓存)       │  │  EventBus (订阅)         │
    │  │  Customer (排名)    │  │                          │
    │  └─────────────────────┘  └──────────────────────────┘
    │
    └──────────────────────────────────────────────────────────────┘
```

**依赖说明（Phase 3 新增/变更）：**
- **StoreLocationModule** 依赖 StoreModule（验证 store 存在性）。StoreLocation 与 Store 一对一（`store_id` 为 unique key）。
- **AppointmentModule** 依赖 StoreLocationModule（读取 `daily_slot_capacity` 配置）+ ConfigurationModule（关联方案）+ SmsModule（可选短信验证，P1）。公开接口（POST /appointments）无需 JWT 鉴权，但需 IP 限流。
- **CampaignModule** 依赖 QuoteModule（核销时读写报价单，apply-campaign 端点由 CampaignModule 的 CampaignClaimService 处理，避免与 QuoteModule 的循环依赖）+ CustomerModule（校验 `new_customer_only` 条件）。campaign 表无 store_id，作用范围通过 `target_store_ids` JSON 字段控制。
- **DashboardModule** 依赖 QuoteModule + ConfigurationModule + CustomerModule（聚合查询）+ Redis（缓存）。纯读模块，不产生新业务实体。
- **CustomerModule** 依赖 ConfigurationModule + QuoteModule（关联查询历史方案/报价单）+ EventBus（订阅 ConfigurationCreated 事件自动同步）。
- **QuoteModule（修改）** 新增 `updateStatus()` 方法（支持报价单状态流转）。`applyCampaign()` 逻辑由 CampaignModule 的 CampaignClaimService 处理，通过 POST `/api/v1/quotes/:id/apply-campaign` 端点调用（端点虽含 `/quotes/` 路径，但由 CampaignModule 注册），避免 QuoteModule 与 CampaignModule 之间的循环依赖。
- **ConfigurationModule（修改）** 在创建方案成功后通过 NestJS EventBus 发布 `ConfigurationCreated` 事件。

#### P3.1.3 Phase 3 各模块 Controller + Service + Entity 对应关系

| 模块 | Controllers | Services | Entities | 数据隔离 |
|------|------------|----------|----------|----------|
| **StoreLocationModule** | `StoreLocationController` | `StoreLocationService` | `StoreLocation` | store_id 一对一 |
| **AppointmentModule** | `AppointmentController`, `AdminAppointmentController` | `AppointmentService` | `Appointment` | store_id 多租户 |
| **CampaignModule** | `CampaignController` (含 `apply-campaign` 端点), `AdminCampaignController` | `CampaignService`, `CampaignClaimService` | `Campaign`（无 store_id）, `CampaignClaim` | Campaign: 跨门店 JSON 字段; CampaignClaim: store_id |
| **DashboardModule** | `DashboardController` | `DashboardService` | 无新实体（只读聚合） | store_id 多租户（查询隔离） |
| **CustomerModule** | `CustomerController` | `CustomerService` | `Customer` | store_id 多租户 |
| **QuoteModule** (修改) | 无新端点 | `QuoteService` + `updateStatus()` | `Quote` + `campaign_id`, `discount_amount`, `final_price`, `status` 扩展 | store_id 多租户 |

---

### P3.2 数据库设计（Phase 3 新增）

#### P3.2.1 实体分类（Phase 3 更新）

| 类别 | 表名 | store_id | 说明 |
|------|------|----------|------|
| **全局数据** | `car_brand`, `car_series`, `car_model` | 无 | Phase 1 已有 |
| **全局数据** | `color_brand`, `color_swatch`, `material` | 无 | Phase 1 已有 |
| **全局数据** | `car_part` | 无 | Phase 2 已有 |
| **配置数据** | `store` | 无 | Phase 1 已有 |
| **配置数据** | `store_location` | 有 (一对一) | Phase 3 新增 — 门店地理位置扩展 |
| **租户数据** | `staff` | 有 | Phase 1 已有 |
| **租户数据** | `configuration` | 有 | Phase 1 已有 |
| **租户数据** | `part_color` | 有 | Phase 1 已有 |
| **租户数据** | `quote` | 有 | Phase 1 已有, Phase 3 新增 `campaign_id`, `discount_amount`, `final_price`, `status` 扩展 |
| **租户数据** | `case` | 有 | Phase 2 已有 |
| **租户数据** | `case_like` | 有 | Phase 2 已有 |
| **租户数据** | `favorite` | 有 | Phase 2 已有 |
| **租户数据** | `ai_generation` | 有 | Phase 2 已有 |
| **无租户** | `sms_code` | 无 | Phase 2 已有 |
| **租户数据** | `appointment` | 有 | Phase 3 新增 — 预约记录 |
| **跨门店** | `campaign` | 无 (通过 target_store_ids JSON) | Phase 3 新增 — 营销活动 |
| **租户数据** | `campaign_claim` | 有 | Phase 3 新增 — 活动核销记录 |
| **租户数据** | `customer` | 有 | Phase 3 新增 — 客户档案 |
| **审计数据** | `audit_log` | 有 | Phase 3 新增 — 操作审计日志 |

#### P3.2.2 完整 DDL（Phase 3 新增表）

##### P3.2.2.1 store_location（门店地理位置 — 与 store 一对一）

```sql
-- ============================================================
-- store_location: 门店地理位置扩展（与 store 一对一）
-- ============================================================
CREATE TABLE `store_location` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL,
  `lat`                   DECIMAL(9,6)    NOT NULL              COMMENT '纬度 (-90 ~ 90)',
  `lng`                   DECIMAL(9,6)    NOT NULL              COMMENT '经度 (-180 ~ 180)',
  `address`               VARCHAR(500)    NOT NULL              COMMENT '详细地址',
  `business_hours`        VARCHAR(200)    NULL                  COMMENT '营业时间说明 (如 "09:00-18:00")',
  `services`              JSON            NULL                  COMMENT '服务项目 JSON 数组 ["FULL_WRAP","PAINT_PROTECTION"]',
  `description`           TEXT            NULL                  COMMENT '门店简介',
  `images`                JSON            NULL                  COMMENT '门店图片集 JSON 字符串数组, 最多 6 张',
  `daily_slot_capacity`   TINYINT UNSIGNED NOT NULL DEFAULT 3   COMMENT '每时段预约容量上限',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_id` (`store_id`),
  KEY `idx_lat_lng` (`lat`, `lng`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店地理位置';
```

> **请注意**：经纬度查询使用应用层 Haversine 公式计算距离，不依赖 MySQL 空间索引（SPATIAL INDEX）。Phase 3 初期门店量小（< 1000 家），应用层计算足够。`idx_lat_lng` 复合索引用于加速 BBOX 经纬度粗筛查询。详见 P3.8。

##### P3.2.2.2 appointment（预约记录 — 带 store_id 多租户）

```sql
-- ============================================================
-- appointment: 客户预约记录
-- ============================================================
CREATE TABLE `appointment` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL,
  `customer_name`         VARCHAR(100)    NOT NULL              COMMENT '客户姓名',
  `customer_phone`        VARCHAR(20)     NOT NULL              COMMENT '客户电话',
  `appointment_date`      DATE            NOT NULL              COMMENT '预约日期',
  `time_slot`             ENUM('MORNING','AFTERNOON','EVENING') NOT NULL COMMENT '时间段',
  `service_type`          ENUM('FULL_WRAP','PARTIAL_WRAP','PAINT_PROTECTION','OTHER') NOT NULL COMMENT '服务类型',
  `status`                ENUM('pending','confirmed','cancelled','completed','rescheduled') NOT NULL DEFAULT 'pending' COMMENT '预约状态',
  `configuration_id`      BIGINT UNSIGNED NULL                  COMMENT '关联的改色方案 ID',
  `staff_id`              BIGINT UNSIGNED NULL                  COMMENT '确认/操作预约的店员 ID',
  `note`                  TEXT            NULL                  COMMENT '客户备注',
  `reason`                VARCHAR(500)    NULL                  COMMENT '取消原因',
  `reschedule_date`       DATE            NULL                  COMMENT '改期后的日期',
  `reschedule_time_slot`  ENUM('MORNING','AFTERNOON','EVENING') NULL COMMENT '改期后的时间段',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_date` (`store_id`, `appointment_date`),
  KEY `idx_store_date_slot` (`store_id`, `appointment_date`, `time_slot`),
  KEY `idx_phone` (`customer_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户预约记录';
```

##### P3.2.2.3 campaign（营销活动 — 无 store_id，跨门店共享）

```sql
-- ============================================================
-- campaign: 营销活动定义（跨门店共享，通过 target_store_ids 控制范围）
-- ============================================================
CREATE TABLE `campaign` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `creator_store_id`      BIGINT UNSIGNED NOT NULL              COMMENT '创建活动的门店 ID（记录来源）',
  `name`                  VARCHAR(200)    NOT NULL              COMMENT '活动名称',
  `banner_url`            VARCHAR(500)    NULL                  COMMENT 'Banner 图片 URL',
  `description`           TEXT            NULL                  COMMENT '活动描述',
  `discount_type`         ENUM('PERCENTAGE','FIXED_AMOUNT','GIFT') NOT NULL COMMENT '折扣类型',
  `discount_value`        DECIMAL(10,2)   NOT NULL              COMMENT '折扣值: PERCENTAGE=折扣率(0.01-1.00), FIXED_AMOUNT=减免金额(元), GIFT=赠品价值(元)',
  `gift_name`             VARCHAR(200)    NULL                  COMMENT '赠品名称 (discount_type=GIFT 时必填)',
  `min_order_amount`      DECIMAL(12,2)   NULL                  COMMENT '最低订单金额门槛 (NULL=无门槛)',
  `new_customer_only`     TINYINT(1)      NOT NULL DEFAULT 0    COMMENT '是否仅新客户可用',
  `target_store_ids`      JSON            NOT NULL              COMMENT '目标门店 ID 数组, 如 [1,2,3]; 空数组 [] 表示全平台门店',
  `valid_from`            DATETIME        NOT NULL              COMMENT '有效期起始',
  `valid_to`              DATETIME        NOT NULL              COMMENT '有效期截止',
  `status`                ENUM('draft','active','paused','expired','disabled') NOT NULL DEFAULT 'draft' COMMENT '活动状态',
  `view_count`            INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '曝光次数 (Banner 点击量)',
  `claim_count`           INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '核销次数',
  `total_discount_amount` DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT '累计优惠金额 (元)',
  `staff_id`              BIGINT UNSIGNED NOT NULL              COMMENT '创建店员 ID',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_valid_range` (`valid_from`, `valid_to`),
  KEY `idx_creator_store` (`creator_store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销活动';
```

##### P3.2.2.4 campaign_claim（活动核销记录 — 带 store_id 多租户）

```sql
-- ============================================================
-- campaign_claim: 活动核销记录
-- ============================================================
CREATE TABLE `campaign_claim` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '核销门店 ID（多租户隔离键）',
  `campaign_id`           BIGINT UNSIGNED NOT NULL              COMMENT '关联活动 ID',
  `staff_id`              BIGINT UNSIGNED NOT NULL              COMMENT '核销操作店员 ID',
  `configuration_id`      BIGINT UNSIGNED NULL                  COMMENT '关联方案 ID',
  `quote_id`              BIGINT UNSIGNED NOT NULL              COMMENT '关联报价单 ID',
  `discount_amount`       DECIMAL(12,2)   NOT NULL              COMMENT '实际优惠金额 (元)',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '核销时间',
  `deleted_at`            DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_campaign_id` (`campaign_id`),
  KEY `idx_quote_id` (`quote_id`),
  UNIQUE KEY `uk_quote_campaign` (`quote_id`, `campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动核销记录';
```

##### P3.2.2.5 customer（客户档案 — 带 store_id 多租户）

```sql
-- ============================================================
-- customer: 门店客户档案
-- ============================================================
CREATE TABLE `customer` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '所属门店 ID（多租户隔离键）',
  `name`                  VARCHAR(100)    NULL                  COMMENT '客户姓名',
  `phone`                 VARCHAR(20)     NOT NULL              COMMENT '手机号（本门店内唯一）',
  `vehicle_info`          JSON            NULL                  COMMENT '车辆信息 { brand, series, model, year, plate_number?, color? }',
  `tags`                  JSON            NULL                  COMMENT '标签列表 JSON 字符串数组 ["VIP","奔驰车主","哑光偏好"]',
  `notes`                 JSON            NULL                  COMMENT '跟进备注 JSON 数组 [{ content, staff_id, staff_name, created_at }]',
  `total_visits`          INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '累计来店次数',
  `total_orders`          INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '累计下单次数 (quote status=confirmed 计数)',
  `total_spent`           DECIMAL(14,2)   NOT NULL DEFAULT 0.00 COMMENT '累计消费金额 (元)',
  `last_visit_at`         DATETIME        NULL                  COMMENT '最近到访时间',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_phone` (`store_id`, `phone`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_last_visit` (`store_id`, `last_visit_at`),
  KEY `idx_store_visits` (`store_id`, `total_visits`),
  KEY `idx_store_spent` (`store_id`, `total_spent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店客户档案';
```

#### P3.2.3 Phase 3 对现有表的 DDL 修改

```sql
-- ============================================================
-- quote: 新增 campaign_id, discount_amount, final_price 列 + status 枚举扩展 (Phase 3)
-- ============================================================
ALTER TABLE `quote`
  ADD COLUMN `campaign_id`     BIGINT UNSIGNED NULL                  COMMENT '关联的营销活动 ID' AFTER `total_price`,
  ADD COLUMN `discount_amount` DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT '活动优惠金额 (元)' AFTER `campaign_id`,
  ADD COLUMN `final_price`     DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT '最终价格 (total_price - discount_amount)' AFTER `discount_amount`,
  MODIFY COLUMN `status` ENUM('pending','confirmed','cancelled','submitted','followed_up','closed','expired') NOT NULL DEFAULT 'pending' COMMENT '报价单状态',
  ADD KEY `idx_campaign_id` (`campaign_id`);
```

> **向后兼容说明**: `final_price` 初始默认值 0，对于 Phase 1/2 中未应用活动的历史报价单，`final_price = total_price`（通过数据迁移脚本回填）。新增的 `status` 枚举值（`submitted`, `followed_up`, `closed`, `expired`）用于 CRM 销售跟进流程（FR-169b P1）。

#### P3.2.4 Phase 3 索引设计说明

| 表 | 索引 | 类型 | 覆盖查询场景 |
|-----|------|------|-------------|
| `store_location` | `uk_store_id` | UNIQUE | `WHERE store_id = ?` — 门店地理位置查询（一对一） |
| `store_location` | `idx_lat_lng` | 复合 INDEX | `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?` — BBOX 经纬度粗筛查询 |
| `appointment` | `idx_store_id` | INDEX | 多租户过滤 |
| `appointment` | `idx_store_date` | 复合 INDEX | `WHERE store_id = ? AND appointment_date = ?` — 门店日期查询 |
| `appointment` | `idx_store_date_slot` | 复合 INDEX | `WHERE store_id = ? AND appointment_date = ? AND time_slot = ?` — 产能校验 COUNT |
| `appointment` | `idx_phone` | INDEX | `WHERE customer_phone = ?` — 按客户电话查询预约历史 |
| `campaign` | `idx_status` | INDEX | `WHERE status = 'active'` — 活动状态筛选 |
| `campaign` | `idx_valid_range` | 复合 INDEX | `WHERE valid_from <= NOW() AND valid_to >= NOW()` — 有效期筛选 |
| `campaign` | `idx_creator_store` | INDEX | `WHERE creator_store_id = ?` — 按创建门店查询 |
| `campaign_claim` | `idx_store_id` | INDEX | 多租户过滤 |
| `campaign_claim` | `idx_campaign_id` | INDEX | `WHERE campaign_id = ?` — 活动核销列表 |
| `campaign_claim` | `idx_quote_id` | INDEX | `WHERE quote_id = ?` — 报价单关联核销 |
| `campaign_claim` | `uk_quote_campaign` | UNIQUE | 同一报价单不可重复核销同一活动 |
| `customer` | `uk_store_phone` | UNIQUE | 门店内手机号唯一 + 按手机号精确查询 |
| `customer` | `idx_store_id` | INDEX | 多租户过滤 |
| `customer` | `idx_store_last_visit` | 复合 INDEX | `WHERE store_id = ? ORDER BY last_visit_at DESC` — 最近到访排序 |
| `customer` | `idx_store_visits` | 复合 INDEX | `WHERE store_id = ? ORDER BY total_visits DESC` — 高频客户排序 |
| `customer` | `idx_store_spent` | 复合 INDEX | `WHERE store_id = ? ORDER BY total_spent DESC` — 高消费客户排序 |
| `quote` (修改) | `idx_campaign_id` | INDEX | `WHERE campaign_id = ?` — 活动效果分析 |

---

### P3.3 API 接口规范（Phase 3 新增/变更）

#### P3.3.1 统一响应格式

**与 Phase 1/2 完全一致**，使用相同的 `{ code, message, data, requestId }` 信封和分页格式。无变更。

#### P3.3.2 鉴权策略（Phase 3 补充）

在 Phase 1/2 的基础上新增两类鉴权模式：

| 类别 | 路径模式 | 鉴权要求 | 实现方式 |
|------|----------|----------|----------|
| **公开接口（IP 限流）** | `POST /api/v1/appointments` | 无 JWT | `@Public()` + `@Throttle(3, 60)` IP 限流 |
| **公开接口（IP 限流）** | `GET /api/v1/campaigns/available` | 无 JWT | `@Public()` + `@Throttle(30, 60)` IP 限流（防爬取活动信息） |
| **公开接口（无鉴权）** | `GET /api/v1/stores/*`, `GET /api/v1/appointments/slots`, `GET /api/v1/appointments/service-types` | 无 | `@Public()` 直接放行 |
| **JWT + Manager** | `/api/v1/admin/dashboard/*`, `/api/v1/admin/customers/*`, `/api/v1/admin/appointments/*`, `/api/v1/admin/campaigns/*` | JWT + manager 及以上 | `JwtAuthGuard` + `@Roles('manager','admin')` |
| **JWT + Staff** | `/api/v1/appointments/mine/*`, `POST /api/v1/quotes/:id/apply-campaign` | JWT + staff 及以上 | `JwtAuthGuard` + `@Roles('staff','manager','admin')` |
| **Admin 专属** | 部分 Dashboard 接口的 `?store_id=` 参数 | JWT + admin only | Controller 层判断 `req.user.role === 'admin'` |

#### P3.3.3 新增 API 端点清单

##### 门店地理位置（Store Location）

| Method | Path | Auth | 说明 | 请求体 / 查询参数 | 响应 data | HTTP |
|--------|------|------|------|-------------------|-----------|------|
| GET | `/api/v1/stores/nearby` | 无 | 附近门店搜索 | `?lat=&lng=&radius=5000&page=1&size=20` (radius 单位: 米) | `PaginatedResponse<StoreNearby>` (含 `distance_meters` 字段) | 200 |
| GET | `/api/v1/stores/:id` | 无 | 门店详情（含地理位置） | 路径参数 `id` | `StoreDetail` (Store + StoreLocation) | 200 |
| GET | `/api/v1/admin/store/location` | JWT + manager+ | 获取本门店地理位置 | 无 | `StoreLocation` | 200 |
| PUT | `/api/v1/admin/store/location` | JWT + manager+ | 设置/更新门店地理位置（upsert） | `{ lat, lng, address, business_hours?, services?, description?, images? }` | `StoreLocation` | 200 |

**StoreNearby 响应结构：**

```json
{
  "list": [
    {
      "id": 1,
      "name": "WrapLab 上海南京东路店",
      "address": "上海市黄浦区南京东路100号",
      "phone": "021-12345678",
      "logo": "https://oss.example.com/stores/1/logo.png",
      "lat": 31.230416,
      "lng": 121.473701,
      "distance_meters": 1200,
      "business_hours": "09:00-18:00",
      "services": ["FULL_WRAP", "PAINT_PROTECTION"]
    }
  ],
  "total": 3,
  "page": 1,
  "size": 20
}
```

**StoreDetail 响应结构：**

```json
{
  "id": 1,
  "name": "WrapLab 上海南京东路店",
  "address": "上海市黄浦区南京东路100号",
  "phone": "021-12345678",
  "logo": "https://oss.example.com/stores/1/logo.png",
  "status": "active",
  "location": {
    "lat": 31.230416,
    "lng": 121.473701,
    "address": "上海市黄浦区南京东路100号",
    "business_hours": "09:00-18:00",
    "services": ["FULL_WRAP", "PAINT_PROTECTION"],
    "description": "WrapLab 旗舰门店，提供全车改色、漆面保护等专业服务。",
    "images": ["url1", "url2"],
    "daily_slot_capacity": 3
  },
  "distance_meters": null
}
```

##### 预约管理（Appointment）

| Method | Path | Auth | 说明 | 请求体 / 查询参数 | 响应 data | HTTP |
|--------|------|------|------|-------------------|-----------|------|
| POST | `/api/v1/appointments` | 无 (IP 限流) | 客户在线预约 | `{ store_id, customer_name, customer_phone, appointment_date, time_slot, service_type, configuration_id?, note? }` | `Appointment` | 201 |
| GET | `/api/v1/appointments/service-types` | 无 | 获取服务类型列表 | 无 | `ServiceType[]` | 200 |
| GET | `/api/v1/appointments/slots` | 无 | 获取可用时段 | `?store_id=&date=` | `{ store_id, date, slots: [{ time_slot, available, remaining }] }` | 200 |
| GET | `/api/v1/appointments/mine` | JWT | 我的预约列表 | `?status=&page=1&size=20` | `PaginatedResponse<Appointment>` | 200 |
| GET | `/api/v1/appointments/mine/:id` | JWT | 我的预约详情 | 路径参数 `id` | `Appointment` | 200 |
| PUT | `/api/v1/appointments/mine/:id/cancel` | JWT | 客户自助取消预约 | `{ reason: string }` | `Appointment` | 200 |
| GET | `/api/v1/admin/appointments` | JWT + manager+ | 门店预约列表 | `?from=&to=&status=&page=1&size=20` | `PaginatedResponse<Appointment>` | 200 |
| GET | `/api/v1/admin/appointments/:id` | JWT + manager+ | 预约详情 | 路径参数 `id` | `Appointment` | 200 |
| PUT | `/api/v1/admin/appointments/:id` | JWT + manager+ | 管理预约状态 | `{ status, reschedule_date?, reschedule_time_slot?, note? }` | `Appointment` | 200 |
| GET | `/api/v1/admin/appointments/calendar` | JWT + manager+ | 预约日历视图 | `?year=&month=` | `CalendarView` | 200 |

**POST /api/v1/appointments 请求体示例：**

```json
{
  "store_id": 1,
  "customer_name": "王先生",
  "customer_phone": "13800138000",
  "appointment_date": "2026-08-01",
  "time_slot": "MORNING",
  "service_type": "FULL_WRAP",
  "configuration_id": 99,
  "note": "客户希望用 AX 超亮金属黄全车改色"
}
```

**GET /api/v1/appointments/slots 响应结构：**

```json
{
  "store_id": 1,
  "date": "2026-08-01",
  "slots": [
    { "time_slot": "MORNING",  "label": "上午 09:00-12:00", "available": true,  "remaining": 2 },
    { "time_slot": "AFTERNOON", "label": "下午 13:00-17:00", "available": true,  "remaining": 3 },
    { "time_slot": "EVENING",  "label": "晚间 17:00-20:00", "available": false, "remaining": 0 }
  ]
}
```

**GET /api/v1/admin/appointments/calendar 响应结构：**

```json
{
  "year": 2026,
  "month": 8,
  "days": [
    {
      "date": "2026-08-01",
      "slots": {
        "MORNING": 2,
        "AFTERNOON": 1,
        "EVENING": 0
      },
      "total": 3
    },
    { "date": "2026-08-02", "slots": { "MORNING": 0, "AFTERNOON": 0, "EVENING": 0 }, "total": 0 }
  ]
}
```

**服务类型列表响应：**

```json
{
  "items": [
    { "value": "FULL_WRAP", "label": "全车改色" },
    { "value": "PARTIAL_WRAP", "label": "局部改色" },
    { "value": "PAINT_PROTECTION", "label": "漆面保护" },
    { "value": "OTHER", "label": "其他服务" }
  ]
}
```

##### 营销活动（Campaign）

| Method | Path | Auth | 说明 | 请求体 / 查询参数 | 响应 data | HTTP |
|--------|------|------|------|-------------------|-----------|------|
| GET | `/api/v1/campaigns/available` | 无 (IP 限流) | 获取当前门店可用活动列表 | Header `X-Store-Id` 或 query `?store_id=` 指定门店（公开接口无 JWT，需显式传入门店 ID） | `Campaign[]` | 200 |
| POST | `/api/v1/campaigns/:id/view` | 无 (IP 去重) | 记录活动曝光 | 路径参数 `id` | `{ view_count: number }` | 200 |
| POST | `/api/v1/quotes/:id/apply-campaign` | JWT + staff+ | 对报价单应用活动 | `{ campaign_id: number }` | `QuoteDetail` (含 `discount_amount`, `final_price`) | 200 |
| PUT | `/api/v1/quotes/:id` | JWT + manager+ | 更新报价单状态 | `{ status: string }` | `Quote` | 200 |
| POST | `/api/v1/admin/campaigns` | JWT + manager+ | 创建营销活动 | `{ name, banner_url?, discount_type, discount_value, gift_name?, min_order_amount?, new_customer_only?, valid_from, valid_to, target_store_ids, description? }` | `Campaign` | 201 |
| GET | `/api/v1/admin/campaigns` | JWT + manager+ | 活动列表 | `?status=&page=1&size=20` | `PaginatedResponse<Campaign>` | 200 |
| PUT | `/api/v1/admin/campaigns/:id` | JWT + manager+ | 编辑活动 | `{ name?, banner_url?, description?, discount_value?, ... }` | `Campaign` | 200 |
| DELETE | `/api/v1/admin/campaigns/:id` | JWT + manager+ | 软删除活动（仅 draft） | 路径参数 `id` | `null` | 200 |
| GET | `/api/v1/admin/campaigns/:id/analytics` | JWT + manager+ | 活动效果数据 | 路径参数 `id` | `{ view_count, claim_count, total_discount_amount, affected_revenue, claim_rate }` | 200 |

**POST /api/v1/admin/campaigns 请求体示例：**

```json
{
  "name": "新店开业 8 折",
  "banner_url": "https://oss.example.com/banners/sale-banner.jpg",
  "discount_type": "PERCENTAGE",
  "discount_value": 0.8,
  "min_order_amount": 3000,
  "new_customer_only": true,
  "valid_from": "2026-08-01T00:00:00+08:00",
  "valid_to": "2026-08-31T23:59:59+08:00",
  "target_store_ids": [1, 2],
  "description": "新店开业促销，全车改色享 8 折优惠"
}
```

**POST /api/v1/quotes/:id/apply-campaign 响应示例：**

```json
{
  "id": 5,
  "store_id": 1,
  "configuration_id": 99,
  "total_price": 10000.00,
  "campaign_id": 1,
  "discount_amount": 2000.00,
  "final_price": 8000.00,
  "status": "pending",
  "staff_id": 3,
  "created_at": "2026-07-22T10:00:00Z",
  "updated_at": "2026-07-22T10:05:00Z"
}
```

##### 数据统计看板（Dashboard）

| Method | Path | Auth | 说明 | 请求体 / 查询参数 | 响应 data | HTTP |
|--------|------|------|------|-------------------|-----------|------|
| GET | `/api/v1/admin/dashboard/kpi` | JWT + manager+ | KPI 概览 | `?period=daily\|weekly\|monthly&date=2026-07-22` (admin 可追加 `&store_id=`) | `KpiOverview` | 200 |
| GET | `/api/v1/admin/dashboard/trends` | JWT + manager+ | 销售趋势 | `?period=daily\|weekly\|monthly&from=&to=` | `TrendData[]` | 200 |
| GET | `/api/v1/admin/dashboard/top-rankings` | JWT + manager+ | 热门排行 | `?type=model\|color\|material&period=monthly&limit=10` | `RankingItem[]` | 200 |
| GET | `/api/v1/admin/dashboard/staff-performance` | JWT + manager+ | 店员业绩 | `?period=monthly&from=&to=` | `StaffPerformance[]` | 200 |

**GET /api/v1/admin/dashboard/kpi 响应结构：**

```json
{
  "total_quotes": 45,
  "total_confirmed": 28,
  "total_revenue": 224000.00,
  "avg_order_value": 8000.00,
  "conversion_rate": 62.2,
  "date_range": {
    "from": "2026-07-01",
    "to": "2026-07-22"
  }
}
```

**GET /api/v1/admin/dashboard/trends 响应结构：**

```json
{
  "period": "daily",
  "data": [
    { "date": "2026-07-01", "quote_count": 3, "confirmed_count": 2, "revenue": 16000.00 },
    { "date": "2026-07-02", "quote_count": 5, "confirmed_count": 3, "revenue": 24000.00 },
    { "date": "2026-07-03", "quote_count": 0, "confirmed_count": 0, "revenue": 0 }
  ]
}
```

> **零值填充策略**: 对于有日期范围但无数据的日期，`quote_count`、`confirmed_count`、`revenue` 均为 0，保证前端图表连续性。

**GET /api/v1/admin/dashboard/top-rankings 响应结构：**

```json
{
  "type": "model",
  "period": "monthly",
  "items": [
    { "model_id": 10, "model_name": "宝马 3系 325Li", "count": 15, "percentage": 33.3 },
    { "model_id": 20, "model_name": "奔驰 C级 C260L", "count": 10, "percentage": 22.2 },
    { "model_id": 30, "model_name": "奥迪 A4L 40TFSI", "count": 5, "percentage": 11.1 }
  ]
}
```

**GET /api/v1/admin/dashboard/staff-performance 响应结构：**

```json
{
  "period": "monthly",
  "items": [
    { "staff_id": 3, "staff_name": "小李", "quote_count": 20, "confirmed_count": 12, "total_revenue": 96000.00, "avg_order_value": 8000.00 },
    { "staff_id": 5, "staff_name": "小王", "quote_count": 15, "confirmed_count": 10, "total_revenue": 85000.00, "avg_order_value": 8500.00 }
  ]
}
```

> **Admin 跨门店查询**: 平台管理员（`role=admin`）可传 `?store_id=` 查询指定门店数据。不传则汇总全平台数据。非 admin 角色传入 `store_id` 将忽略参数（始终返回当前 JWT 门店数据），或返回 400 "无权跨门店查询"。

##### CRM 客户管理（Customer）

| Method | Path | Auth | 说明 | 请求体 / 查询参数 | 响应 data | HTTP |
|--------|------|------|------|-------------------|-----------|------|
| GET | `/api/v1/admin/customers` | JWT + manager+ | 客户列表 | `?keyword=&tag=&sort=last_visit_at\|total_visits\|created_at&page=1&size=20` | `PaginatedResponse<Customer>` | 200 |
| GET | `/api/v1/admin/customers/:id` | JWT + manager+ | 客户详情 | 路径参数 `id` | `CustomerDetail` (含关联方案列表 + 报价单列表) | 200 |
| PUT | `/api/v1/admin/customers/:id` | JWT + manager+ | 编辑客户信息 | `{ name?, vehicle_info?, tags?, notes? }` (tags 全量替换) | `Customer` | 200 |
| POST | `/api/v1/admin/customers/:id/notes` | JWT + manager+ | 追加跟进备注 | `{ content: string }` | `Customer` | 200 |
| POST | `/api/v1/admin/customers/import` | JWT + manager+ | 批量导入客户 | multipart/form-data `file` (CSV) | `{ success_count, fail_count, errors: [{ row, reason }] }` | 200 |
| GET | `/api/v1/admin/customers/export` | JWT + manager+ | 导出客户 CSV | `?tag=` (可选标签过滤) | CSV 文件流 (Content-Type: text/csv) | 200 |

**GET /api/v1/admin/customers/:id 响应结构（CustomerDetail）：**

```json
{
  "id": 5,
  "store_id": 1,
  "name": "王先生",
  "phone": "138****8000",
  "vehicle_info": { "brand": "宝马", "series": "3系", "year": 2025, "color": "黑色" },
  "tags": ["VIP", "奔驰车主", "哑光偏好"],
  "notes": [
    { "content": "客户偏好哑光材质，对光泽度要求高", "staff_id": 3, "staff_name": "小李", "created_at": "2026-07-20T14:30:00Z" },
    { "content": "已发送 3 系改色方案", "staff_id": 5, "staff_name": "小王", "created_at": "2026-07-15T10:00:00Z" }
  ],
  "total_visits": 5,
  "total_orders": 2,
  "total_spent": 16000.00,
  "last_visit_at": "2026-07-22T10:30:00Z",
  "configurations": [ /* 最近 20 条改色方案, 按 created_at 倒序 */ ],
  "quotes": [ /* 最近 20 条报价单, 按 created_at 倒序 */ ],
  "created_at": "2026-06-01T08:00:00Z",
  "updated_at": "2026-07-22T10:30:00Z"
}
```

> **手机号脱敏**: 客户详情中 `phone` 字段在响应时中间 4 位替换为 `****`（NFR-110）。仅在 CSV 导出时完整输出（需记录审计日志 NFR-111）。

**POST /api/v1/admin/customers/import 请求格式：**

```
Content-Type: multipart/form-data
字段: file (CSV 文件)
CSV 列: name, phone, vehicle_info, tags
```

**POST /api/v1/admin/customers/import 响应结构：**

```json
{
  "success_count": 3,
  "fail_count": 2,
  "errors": [
    { "row": 4, "reason": "手机号 13800138000 已存在" },
    { "row": 7, "reason": "手机号格式不合法" }
  ]
}
```

#### P3.3.4 参数校验规则（Phase 3 新增）

| DTO | 字段 | 规则 |
|-----|------|------|
| `NearbyQueryDto` | `lat` | `@IsNumber() @Min(-90) @Max(90)` |
| `NearbyQueryDto` | `lng` | `@IsNumber() @Min(-180) @Max(180)` |
| `NearbyQueryDto` | `radius` | `@IsOptional() @IsNumber() @Min(100) @Max(50000)` |
| `NearbyQueryDto` | `page` | `@IsOptional() @IsInt() @Min(1)` |
| `NearbyQueryDto` | `size` | `@IsOptional() @IsInt() @Min(1) @Max(50)` |
| `UpsertStoreLocationDto` | `lat` | `@IsNumber() @Min(-90) @Max(90)` |
| `UpsertStoreLocationDto` | `lng` | `@IsNumber() @Min(-180) @Max(180)` |
| `UpsertStoreLocationDto` | `address` | `@IsString() @MinLength(1) @MaxLength(500)` |
| `UpsertStoreLocationDto` | `business_hours` | `@IsOptional() @IsString() @MaxLength(200)` |
| `UpsertStoreLocationDto` | `services` | `@IsOptional() @IsArray()` |
| `UpsertStoreLocationDto` | `images` | `@IsOptional() @IsArray() @ArrayMaxSize(6)` |
| `CreateAppointmentDto` | `store_id` | `@IsInt() @Min(1)` |
| `CreateAppointmentDto` | `customer_name` | `@IsString() @MinLength(1) @MaxLength(100)` |
| `CreateAppointmentDto` | `customer_phone` | `@Matches(/^1[3-9]\d{9}$/)` |
| `CreateAppointmentDto` | `appointment_date` | `@IsDateString()` + 自定义校验 `@MinDate('today')` |
| `CreateAppointmentDto` | `time_slot` | `@IsEnum(['MORNING','AFTERNOON','EVENING'])` |
| `CreateAppointmentDto` | `service_type` | `@IsEnum(['FULL_WRAP','PARTIAL_WRAP','PAINT_PROTECTION','OTHER'])` |
| `UpdateAppointmentStatusDto` | `status` | `@IsEnum(['confirmed','cancelled','completed','rescheduled'])` |
| `UpdateAppointmentStatusDto` | `reschedule_date` | `@ValidateIf(o => o.status === 'rescheduled') @IsDateString()` |
| `UpdateAppointmentStatusDto` | `reschedule_time_slot` | `@ValidateIf(o => o.status === 'rescheduled') @IsEnum([...])` |
| `CancelAppointmentDto` | `reason` | `@IsString() @MaxLength(500)` |
| `CreateCampaignDto` | `name` | `@IsString() @MinLength(1) @MaxLength(200)` |
| `CreateCampaignDto` | `discount_type` | `@IsEnum(['PERCENTAGE','FIXED_AMOUNT','GIFT'])` |
| `CreateCampaignDto` | `discount_value` | `@IsNumber()` + 自定义校验（见下方） |
| `CreateCampaignDto` | `gift_name` | `@ValidateIf(o => o.discount_type === 'GIFT') @IsString() @MinLength(1)` |
| `CreateCampaignDto` | `min_order_amount` | `@IsOptional() @IsNumber() @Min(0.01)` |
| `CreateCampaignDto` | `new_customer_only` | `@IsOptional() @IsBoolean()` |
| `CreateCampaignDto` | `valid_from` | `@IsDateString()` |
| `CreateCampaignDto` | `valid_to` | `@IsDateString()` + 自定义校验 `valid_to > valid_from` |
| `CreateCampaignDto` | `target_store_ids` | `@IsArray()` |
| `ApplyCampaignDto` | `campaign_id` | `@IsInt() @Min(1)` |
| `CustomerQueryDto` | `keyword` | `@IsOptional() @IsString() @MaxLength(100)` |
| `CustomerQueryDto` | `tag` | `@IsOptional() @IsString()` |
| `CustomerQueryDto` | `sort` | `@IsOptional() @IsEnum(['last_visit_at','total_visits','created_at'])` |
| `UpdateCustomerDto` | `tags` | `@IsOptional() @IsArray()` |
| `AddCustomerNoteDto` | `content` | `@IsString() @MinLength(1) @MaxLength(2000)` |
| `ImportCustomerCsvDto` | `file` | multipart file: `@IsFile()` + 文件类型校验 + 文件大小 <= 10MB |

**discount_value 自定义校验规则：**

```typescript
// src/common/validators/campaign-discount.validator.ts
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsValidDiscountValue(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidDiscountValue',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const type = obj.discount_type;
          const num = Number(value);

          if (isNaN(num)) return false;

          switch (type) {
            case 'PERCENTAGE':
              return num >= 0.01 && num <= 1.00;
            case 'FIXED_AMOUNT':
              return num > 0;
            case 'GIFT':
              return num >= 0; // 赠品价值可为 0
            default:
              return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          switch (obj.discount_type) {
            case 'PERCENTAGE': return '百分比折扣值必须在 0.01 到 1.00 之间';
            case 'FIXED_AMOUNT': return '固定金额减免必须大于 0';
            case 'GIFT': return '赠品价值必须大于等于 0';
            default: return '折扣值不合法';
          }
        },
      },
    });
  };
}
```

---

### P3.4 关键数据流设计

#### P3.4.1 附近门店搜索 — Haversine 查询流程

```
Client                              Server
  │                                   │
  │  GET /stores/nearby               │
  │  ?lat=31.230416&lng=121.473701    │
  │  &radius=5000&page=1&size=20      │
  │──────────────────────────────────>│
  │                                   │  StoreLocationService.findNearby():
  │                                   │  1. 参数校验:
  │                                   │     - lat [-90, 90], lng [-180, 180]
  │                                   │     - radius: 默认 5000, 最大 50000 (50km)
  │                                   │     - page >= 1, size: 1-50
  │                                   │
  │                                   │  2. 先用 BBOX 粗筛:
  │                                   │     计算 bounding box (经纬度范围)
  │                                   │     WHERE lat BETWEEN ? AND ?
  │                                   │       AND lng BETWEEN ? AND ?
  │                                   │     → 利用 idx_lat_lng 索引加速
  │                                   │     → 过滤掉明显超出范围的门店
  │                                   │
  │                                   │  3. 应用层 Haversine 精算:
  │                                   │     对 BBOX 结果集逐行计算实际距离
  │                                   │     WHERE 实际距离 <= radius
  │                                   │
  │                                   │  4. ORDER BY distance ASC
  │                                   │
  │                                   │  5. JOIN store 表获取门店基本信息
  │                                   │     (name, phone, logo, status=active)
  │                                   │
  │                                   │  6. LIMIT/OFFSET 分页
  │                                   │
  │  { code: 0, data: {              │
  │    list: [{                       │
  │      id: 1, name: "...",         │
  │      distance_meters: 1200,       │
  │      ...                         │
  │    }],                            │
  │    total: 3, page: 1, size: 20   │
  │  }}                               │
  │<──────────────────────────────────│
```

**Haversine 核心计算（TypeScript 实现）：**

```typescript
// src/modules/store-location/utils/haversine.ts

/**
 * 使用 Haversine 公式计算两点间的大圆距离
 * @returns 距离，单位：米
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // 地球半径 (米)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 计算给定经纬度点的 Bounding Box
 * @returns { minLat, maxLat, minLng, maxLng }
 */
export function computeBoundingBox(
  lat: number, lng: number, radiusMeters: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const R = 6371000;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const deltaLat = toDeg(radiusMeters / R);
  const deltaLng = toDeg(radiusMeters / (R * Math.cos((lat * Math.PI) / 180)));

  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLng: lng - deltaLng,
    maxLng: lng + deltaLng,
  };
}
```

**StoreLocationService.findNearby() 精简实现：**

```typescript
async findNearby(query: NearbyQueryDto): Promise<PaginatedResponse<StoreNearbyDto>> {
  const { lat, lng, radius = 5000, page = 1, size = 20 } = query;

  // 1. 计算 BBOX
  const bbox = computeBoundingBox(lat, lng, radius);

  // 2. BBOX 粗筛查询（利用 idx_lat_lng 索引快速缩小范围）
  const qb = this.storeLocationRepo
    .createQueryBuilder('sl')
    .innerJoin('store', 's', 's.id = sl.store_id AND s.status = :activeStatus', { activeStatus: 'active' })
    .where('sl.lat BETWEEN :minLat AND :maxLat', { minLat: bbox.minLat, maxLat: bbox.maxLat })
    .andWhere('sl.lng BETWEEN :minLng AND :maxLng', { minLng: bbox.minLng, maxLng: bbox.maxLng })
    .andWhere('sl.deleted_at IS NULL');

  // 3. 获取 BBOX 内的所有门店（不做 LIMIT，需先计算距离再过滤）
  const locations = await qb
    .select(['sl.store_id', 'sl.lat', 'sl.lng', 'sl.address', 'sl.business_hours', 'sl.services', 's.name', 's.phone', 's.logo'])
    .getRawMany();

  // 4. 应用层 Haversine 精算 + 距离过滤
  const withDistance = locations
    .map(row => ({
      ...row,
      distance_meters: Math.round(haversineDistance(lat, lng, Number(row.sl_lat), Number(row.sl_lng))),
    }))
    .filter(row => row.distance_meters <= radius)
    .sort((a, b) => a.distance_meters - b.distance_meters);

  // 5. 内存分页
  const total = withDistance.length;
  const list = withDistance.slice((page - 1) * size, page * size);

  return { list, total, page, size };
}
```

**Trade-off — 应用层计算 vs 数据库 Haversine vs 空间索引:**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **应用层 Haversine (当前选择)** | 实现简单、无数据库依赖、代码可测试 | BBOX 内所有记录需加载到内存 | 门店量 < 1000 时完全可接受 (BBOX 5km 范围内通常 < 50 家) |
| 数据库 Haversine SQL | 可直接在 SQL 中完成距离计算和排序 | SQL 表达式冗长、难以维护、索引无效 | — |
| MySQL SPATIAL 索引 | 原生空间查询支持、性能最优 | 需引入 `POINT` 类型 + `SPATIAL INDEX`、迁移成本 | 门店量 > 1000 或需要多层级空间查询时 |
| Elasticsearch Geo | 强大的地理搜索能力、支持复杂过滤 | 运维复杂度高、引入新组件 | 门店量 > 10000 且需要全文+空间复合搜索 |

**迁移路径**: 当门店量突破 1000 家时，可将 `store_location` 表新增 `location POINT NOT NULL SRID 4326` 列，创建 `SPATIAL INDEX idx_location (location)`，使用 `ST_Distance_Sphere()` 函数替代应用层计算。当前选择应用层方案是务实之举。

#### P3.4.2 预约创建 — 产能校验与并发控制

```
Client                              Server                          Database
  │                                   │                                │
  │  POST /appointments               │                                │
  │  { store_id: 1, date: "2026-08-01",│                               │
  │    time_slot: "MORNING", ... }    │                                │
  │──────────────────────────────────>│                                │
  │                                   │  AppointmentService.create():   │
  │                                   │  1. 校验 store_id 存在          │
  │                                   │  2. 校验 store.status='active'  │
  │                                   │     (非活跃门店不可预约)        │
  │                                   │  3. 校验 appointment_date >= TODAY │
  │                                   │  4. 读取 store_location:         │
  │                                   │     SELECT daily_slot_capacity   │
  │                                   │     FROM store_location          │
  │                                   │     WHERE store_id = 1           │
  │                                   │───────────────────────────────>│
  │                                   │  capacity = 3                   │
  │                                   │<───────────────────────────────│
  │                                   │                                │
  │                                   │  5. 产能校验 (SELECT FOR UPDATE) │
  │                                   │     BEGIN TRANSACTION            │
  │                                   │───────────────────────────────>│
  │                                   │     SELECT COUNT(*)              │
  │                                   │     FROM appointment             │
  │                                   │     WHERE store_id = 1           │
  │                                   │       AND appointment_date       │
  │                                   │         = '2026-08-01'           │
  │                                   │       AND time_slot = 'MORNING'  │
  │                                   │       AND status NOT IN          │
  │                                   │         ('cancelled')            │
  │                                   │       AND deleted_at IS NULL     │
  │                                   │     FOR UPDATE                   │
  │                                   │───────────────────────────────>│
  │                                   │  count = 2 (< capacity 3)       │
  │                                   │<───────────────────────────────│
  │                                   │                                │
  │                                   │  6. INSERT appointment           │
  │                                   │───────────────────────────────>│
  │                                   │  COMMIT                         │
  │                                   │<───────────────────────────────│
  │                                   │                                │
  │  { code: 0, data: { id: 10,      │                                │
  │    status: "pending", ... }}      │                                │
  │<──────────────────────────────────│                                │
```

**并发安全保证（NFR-120）：**

```typescript
// AppointmentService.create() 中的产能校验
async create(dto: CreateAppointmentDto): Promise<Appointment> {
  // 验证门店存在且处于活跃状态
  const store = await this.storeService.findById(dto.store_id);
  if (!store || store.status !== 'active') {
    throw new BusinessException(ErrorCode.STORE_NOT_FOUND);
  }

  const capacity = await this.getCapacity(dto.store_id); // 默认 3

  // 使用 QueryRunner 管理事务 + 行级锁
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // FOR UPDATE 行级锁 — 防止并发超卖
    const existingCount = await queryRunner.manager
      .createQueryBuilder(Appointment, 'a')
      .where('a.store_id = :storeId', { storeId: dto.store_id })
      .andWhere('a.appointment_date = :date', { date: dto.appointment_date })
      .andWhere('a.time_slot = :slot', { slot: dto.time_slot })
      .andWhere('a.status NOT IN (:...excluded)', { excluded: ['cancelled'] })
      .andWhere('a.deleted_at IS NULL')
      .setLock('pessimistic_write') // SELECT ... FOR UPDATE
      .getCount();

    if (existingCount >= capacity) {
      throw new BusinessException(ErrorCode.SLOT_FULL);
    }

    const appointment = queryRunner.manager.create(Appointment, {
      ...dto,
      status: 'pending',
    });
    await queryRunner.manager.save(appointment);
    await queryRunner.commitTransaction();
    return appointment;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

> **FOR UPDATE 锁粒度**: 由于 `appointment` 表没有精确的"槽位行"可供锁定（槽位是逻辑概念），`SELECT COUNT(...) FOR UPDATE` 会在匹配的行上设置排他锁。MySQL InnoDB 的行锁基于索引，`idx_store_date_slot` 复合索引确保只锁定同一门店+日期+时段的预约记录，不会阻塞其他门店或其他时段的预约创建。并发冲突仅发生在**同一门店的同一日期同一时段**，概率极低。

> **Reschedule 产能校验 (S2 修复)**: 改期操作 (`updateStatus` 中 `status='rescheduled'`) 在更新 `appointment_date` / `time_slot` 前，同样执行 `SELECT COUNT(...) FOR UPDATE` 对新目标时段进行产能校验。校验逻辑与新建预约一致，确保改期不会导致目标时段超卖。

#### P3.4.3 营销活动核销 — Campaign Apply 流程

```
Client                              Server                          Database
  │                                   │                                │
  │  POST /quotes/5/apply-campaign    │                                │
  │  { campaign_id: 1 }              │                                │
  │──────────────────────────────────>│                                │
  │                                   │  CampaignClaimService.apply(): │
  │                                   │  1. 查报价单:                   │
  │                                   │     quote = findById(5)         │
  │                                   │     → 验证 store_id 归属        │
  │                                   │───────────────────────────────>│
  │                                   │<───────────────────────────────│
  │                                   │                                │
  │                                   │  2. 查活动:                     │
  │                                   │     campaign = findById(1)     │
  │                                   │───────────────────────────────>│
  │                                   │<───────────────────────────────│
  │                                   │                                │
  │                                   │  3. 活动有效性校验:              │
  │                                   │   a) status === 'active'        │
  │                                   │   b) NOW() BETWEEN               │
  │                                   │      valid_from AND valid_to    │
  │                                   │   c) target_store_ids 包含       │
  │                                   │      quote.store_id             │
  │                                   │      (空数组 = 全平台)           │
  │                                   │   → 任一不满足: 400/404          │
  │                                   │                                │
  │                                   │  4. 参与条件校验:                │
  │                                   │   a) min_order_amount:          │
  │                                   │      quote.total_price >= ?     │
  │                                   │   b) new_customer_only:         │
  │                                   │      SELECT COUNT(*) FROM       │
  │                                   │      quote WHERE store_id = ?   │
  │                                   │      AND customer_phone = ?     │
  │                                   │      AND status = 'confirmed'   │
  │                                   │      → count > 0 ? 拒绝 : 通过   │
  │                                   │                                │
  │                                   │  5. 去重校验:                    │
  │                                   │     SELECT COUNT(*) FROM        │
  │                                   │     campaign_claim              │
  │                                   │     WHERE quote_id = 5          │
  │                                   │     → count > 0 ? 409 : 通过    │
  │                                   │                                │
  │                                   │  6. 计算折扣金额:                │
  │                                   │     switch (discount_type):     │
  │                                   │       PERCENTAGE:               │
  │                                   │         discount = total_price   │
  │                                   │           * (1 - discount_value)│
  │                                   │       FIXED_AMOUNT:             │
  │                                   │         discount = discount_value│
  │                                   │       GIFT:                     │
  │                                   │         discount = 0            │
  │                                   │                                │
  │                                   │  7. BEGIN TRANSACTION           │
  │                                   │───────────────────────────────>│
  │                                   │   a) UPDATE quote SET           │
  │                                   │      campaign_id = 1,           │
  │                                   │      discount_amount = ?,       │
  │                                   │      final_price = total_price  │
  │                                   │        - discount_amount        │
  │                                   │   b) INSERT campaign_claim      │
  │                                   │   c) UPDATE campaign SET        │
  │                                   │      claim_count = claim_count+1,│
  │                                   │      total_discount_amount      │
  │                                   │        = total_discount_amount  │
  │                                   │          + discount_amount      │
  │                                   │   COMMIT                        │
  │                                   │<───────────────────────────────│
  │                                   │                                │
  │  { code: 0, data: { /* Quote     │                                │
  │    with campaign info */ }}       │                                │
  │<──────────────────────────────────│                                │
```

> **注意 (S8 修复)**: `customer.total_orders` 的递增已从 Campaign Apply 流程中移除。`total_orders` 应在报价单状态转为 `confirmed` 时递增（由 QuoteModule.updateStatus() 在 confirmed 流转中触发），而非在活动核销时递增。核销仅是使用优惠，不代表订单已确认成交。

**折扣金额上限保护:**

```typescript
// CampaignClaimService 中的折扣计算
private calculateDiscount(quote: Quote, campaign: Campaign): number {
  const totalPrice = Number(quote.total_price);

  switch (campaign.discount_type) {
    case 'PERCENTAGE': {
      // 百分比折扣: discount_value = 0.8 表示 8 折, 优惠 = totalPrice * (1 - 0.8)
      const discount = Math.round(totalPrice * (1 - Number(campaign.discount_value)) * 100) / 100;
      // 保护: 折扣金额不能超过原价
      return Math.min(discount, totalPrice);
    }
    case 'FIXED_AMOUNT': {
      // 固定减免: discount_value = 500 表示立减 500
      const discount = Number(campaign.discount_value);
      // 保护: 减免金额不能超过原价 (不会出现倒贴钱)
      return Math.min(discount, totalPrice);
    }
    case 'GIFT': {
      // 赠品: 不影响价格, 优惠金额为 0
      return 0;
    }
    default:
      throw new BusinessException(ErrorCode.CAMPAIGN_INVALID_DISCOUNT);
  }
}
```

#### P3.4.4 CRM 客户自动同步 — 事件订阅者模式

```
ConfigurationModule                    EventBus                  CustomerModule
  │                                      │                          │
  │  ConfigurationService.create()       │                          │
  │  1. INSERT configuration             │                          │
  │  2. INSERT part_colors               │                          │
  │  3. COMMIT (事务成功提交后)           │                          │
  │                                      │                          │
  │  4. this.eventBus.publish(           │                          │
  │     new ConfigurationCreatedEvent(   │                          │
  │       store_id,                      │                          │
  │       customer_name,                 │                          │
  │       customer_phone,                │                          │
  │       configuration_id               │                          │
  │     )                                │                          │
  │  )                                   │                          │
  │─────────────────────────────────────>│                          │
  │                                      │                          │
  │                                      │  CustomerSyncSubscriber   │
  │                                      │  (异步, 不阻塞主流程)     │
  │                                      │─────────────────────────>│
  │                                      │                          │
  │                                      │  handleConfigurationCreated(event):
  │                                      │  1. if (!customer_phone)
  │                                      │       return; // 跳过
  │                                      │  2. 手机号格式校验:
  │                                      │     if (!/^1[3-9]\d{9}$/
  │                                      │         .test(phone))
  │                                      │       return; // 静默跳过
  │                                      │  3. INSERT ... ON DUPLICATE
  │                                      │     KEY UPDATE (原子 upsert)
  │                                      │                          │
  │                                      │  (异步失败不影响方案创建)  │
  │                                      │                          │
```

**事件定义与订阅者实现：**

```typescript
// src/modules/customer/events/configuration-created.event.ts
export class ConfigurationCreatedEvent {
  constructor(
    public readonly storeId: number,
    public readonly customerName: string | null,
    public readonly customerPhone: string | null,
    public readonly configurationId: number,
  ) {}
}

// src/modules/configuration/configuration.service.ts (修改)
async create(dto: CreateConfigurationDto): Promise<Configuration> {
  // ... 现有创建逻辑 ...

  const config = await this.configRepo.save(entity);

  // 事务成功提交后发布事件
  this.eventEmitter.emit(
    'configuration.created',
    new ConfigurationCreatedEvent(
      config.store_id,
      dto.customer_name ?? null,
      dto.customer_phone ?? null,
      config.id,
    ),
  );

  return config;
}

// src/modules/customer/subscribers/customer-sync.subscriber.ts
@Injectable()
export class CustomerSyncSubscriber {
  constructor(private readonly customerService: CustomerService) {}

  @OnEvent('configuration.created', { async: true }) // 异步执行，不阻塞主流程
  async handleConfigurationCreated(event: ConfigurationCreatedEvent): Promise<void> {
    const { storeId, customerPhone, customerName } = event;

    // 过早返回: 无手机号不同步
    if (!customerPhone) return;

    // 手机号格式校验: 不合法则静默跳过
    if (!/^1[3-9]\d{9}$/.test(customerPhone)) return;

    try {
      await this.customerService.upsertByPhone(storeId, customerPhone, {
        name: customerName || undefined,
        incrementVisits: true,
      });
    } catch (error) {
      // 客户同步失败不影响方案创建主流程
      // 仅记录日志 (使用 Logger, 非 console.log)
      this.logger.warn(
        `Customer sync failed for phone=${customerPhone} store=${storeId}: ${error.message}`,
      );
    }
  }
}
```

**CustomerService.upsertByPhone() 实现（使用 INSERT ... ON DUPLICATE KEY UPDATE 避免 SELECT-then-INSERT 竞态）：**

```typescript
// src/modules/customer/customer.service.ts
async upsertByPhone(
  storeId: number,
  phone: string,
  options: { name?: string; incrementVisits?: boolean },
): Promise<Customer> {
  // 使用 INSERT ... ON DUPLICATE KEY UPDATE 原子操作
  // 避免 SELECT-then-INSERT 的并发竞态条件
  const result = await this.customerRepo
    .createQueryBuilder()
    .insert()
    .into(Customer)
    .values({
      store_id: storeId,
      phone,
      name: options.name || null,
      total_visits: options.incrementVisits ? 1 : 0,
      last_visit_at: new Date(),
    })
    .orUpdate(
      [
        'name',
        'total_visits',
        'last_visit_at',
        'updated_at',
      ],
      ['uk_store_phone'], // 冲突键: store_id + phone 唯一索引
      {
        // 冲突时: name 仅在现有值为空时更新
        // total_visits 递增
        // last_visit_at 更新为当前时间
      },
    )
    .execute();

  // 返回更新后的 entity
  return this.customerRepo.findOne({
    where: { store_id: storeId, phone, deleted_at: IsNull() },
  });
}
```

> **并发安全说明 (S3 修复)**: 原实现使用 SELECT-then-INSERT 模式存在竞态条件（两个并发请求可能同时 SELECT 不到记录，然后都执行 INSERT，第二个会因唯一键冲突而失败）。改用 `INSERT ... ON DUPLICATE KEY UPDATE` 原子 upsert 语句，利用 `uk_store_phone` 唯一索引的数据库级冲突检测来保证数据一致性。

---

### P3.5 预约状态机（Appointment State Machine）

#### P3.5.1 状态定义

| 状态 | 含义 | 进入条件 |
|------|------|----------|
| `pending` | 待确认 — 客户已提交预约，门店尚未处理 | 初始状态 (CREATE) |
| `confirmed` | 已确认 — 门店已确认预约，等待施工 | 门店 manager 确认 |
| `rescheduled` | 已改期 — 门店或客户已变更预约日期/时段 | 门店 manager 改期操作 |
| `completed` | 已完成 — 施工已完成 | 门店 manager 标记完成 |
| `cancelled` | 已取消 — 预约已取消（门店拒绝或客户取消） | 门店 manager 取消 / 客户自助取消 |

#### P3.5.2 状态流转图

```
                    ┌──────────┐
                    │  pending │  (初始状态: 客户预约提交)
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        ┌─────────┐ ┌────────┐ ┌──────────┐
        │confirmed│ │cancelled│ │rescheduled│ ← (跳过 confirmed 直接改期? 不, 仅 confirmed 可改期)
        └────┬─────┘ └────────┘ └────┬──────┘
             │          ▲            │
             │          │            │
             │    ┌─────┴─────┐      │
             │    │ (cancelled │      │
             │    │  后不可    │      │
             │    │  再确认)   │      │
             │    └───────────┘      │
             │                      │
        ┌────┼──────────┐           │
        │    │          │           │
        ▼    ▼          ▼           │
   ┌─────────┐  ┌──────────┐       │
   │completed│  │cancelled │       │
   └─────────┘  └──────────┘       │
                                    │
   ┌────────────────────────────────┘
   │  (rescheduled 可再次确认/取消)
   │
   └──> confirmed / cancelled

状态流转规则:
  pending    → confirmed   (AC-141: 门店确认预约)
  pending    → cancelled   (AC-144 前传: 门店拒绝预约, 或客户取消)
  confirmed  → completed   (门店标记完成)
  confirmed  → cancelled   (门店取消 或 客户自助取消, AC-144)
  confirmed  → rescheduled (门店改期, AC-142)
  rescheduled → confirmed  (门店再次确认改期后的预约)
  rescheduled → cancelled  (门店或客户取消改期后的预约)

禁止流转:
  cancelled  → *           (已取消不可再确认, AC-144)
  completed  → *           (已完成终态)
  pending    → rescheduled  (未确认不可改期)
  pending    → completed    (未确认不可标记完成)
```

#### P3.5.3 状态机实现

```typescript
// src/modules/appointment/appointment-state-machine.ts

type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'rescheduled';

/**
 * 预约状态流转规则表
 * Key = 当前状态, Value = 允许转换到的目标状态集合
 */
const VALID_TRANSITIONS: Record<AppointmentStatus, ReadonlySet<AppointmentStatus>> = {
  pending:     new Set(['confirmed', 'cancelled']),
  confirmed:   new Set(['completed', 'cancelled', 'rescheduled']),
  rescheduled: new Set(['confirmed', 'cancelled']),
  completed:   new Set([]), // 终态
  cancelled:   new Set([]), // 终态
};

/**
 * 校验状态流转是否合法
 * @throws BusinessException(ErrorCode.APPOINTMENT_STATE_INVALID) 若流转非法
 */
export function validateTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus,
): void {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed.has(targetStatus)) {
    if (currentStatus === 'cancelled') {
      throw new BusinessException(ErrorCode.APPOINTMENT_CANCELLED, '已取消的预约不可再确认');
    }
    if (currentStatus === 'completed') {
      throw new BusinessException(ErrorCode.APPOINTMENT_STATE_INVALID, '已完成的预约不可修改');
    }
    throw new BusinessException(
      ErrorCode.APPOINTMENT_STATE_INVALID,
      `预约状态不可从 ${currentStatus} 转为 ${targetStatus}`,
    );
  }
}

/**
 * 获取目标状态所需的额外字段
 */
export function getRequiredFieldsForTransition(
  targetStatus: AppointmentStatus,
): string[] {
  switch (targetStatus) {
    case 'rescheduled':
      return ['reschedule_date', 'reschedule_time_slot'];
    default:
      return [];
  }
}
```

**AppointmentService 中的使用（含改期产能校验）：**

```typescript
// src/modules/appointment/appointment.service.ts
async updateStatus(
  id: number,
  storeId: number,
  dto: UpdateAppointmentStatusDto,
): Promise<Appointment> {
  const appointment = await this.findById(id, storeId);

  // 1. 校验状态流转合法性
  validateTransition(appointment.status as AppointmentStatus, dto.status);

  // 2. 检查必需字段
  const requiredFields = getRequiredFieldsForTransition(dto.status);
  for (const field of requiredFields) {
    if (!dto[field]) {
      throw new BusinessException(ErrorCode.APPOINTMENT_STATE_INVALID,
        `状态 ${dto.status} 需要提供 ${field} 字段`);
    }
  }

  // 3. 改期时重新校验目标时段产能 (S2 修复)
  if (dto.status === 'rescheduled') {
    const capacity = await this.getCapacity(storeId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existingCount = await queryRunner.manager
        .createQueryBuilder(Appointment, 'a')
        .where('a.store_id = :storeId', { storeId })
        .andWhere('a.appointment_date = :date', { date: dto.reschedule_date })
        .andWhere('a.time_slot = :slot', { slot: dto.reschedule_time_slot })
        .andWhere('a.status NOT IN (:...excluded)', { excluded: ['cancelled'] })
        .andWhere('a.deleted_at IS NULL')
        .setLock('pessimistic_write')
        .getCount();

      if (existingCount >= capacity) {
        throw new BusinessException(ErrorCode.SLOT_FULL);
      }

      appointment.appointment_date = dto.reschedule_date;
      appointment.time_slot = dto.reschedule_time_slot;
      await queryRunner.manager.save(appointment);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
    return appointment;
  }

  // 4. 执行状态变更（非 reschedule 场景）
  appointment.status = dto.status;

  if (dto.status === 'confirmed' || dto.status === 'rescheduled') {
    appointment.staff_id = StoreContext.getStaffId(); // 记录操作店员
  }

  if (dto.status === 'cancelled' && dto.note) {
    appointment.reason = dto.note;
  }

  return this.appointmentRepo.save(appointment);
}
```

---

### P3.5b 报价单状态机（Quote State Machine）— Blocker B3

#### P3.5b.1 状态定义

Quote 的 `status` 枚举（Phase 3 扩展后）包含 7 个状态：

| 状态 | 含义 | 进入条件 |
|------|------|----------|
| `pending` | 待处理 — 报价单已创建，等待门店确认 | 初始状态 (CREATE) |
| `confirmed` | 已确认 — 门店确认报价有效 | 门店确认报价 |
| `submitted` | 已提交 — 报价方案已提交给客户审阅 | 店员提交报价单给客户 |
| `followed_up` | 已跟进 — 店员已跟进客户并达成意向 | 店员记录跟进行为 |
| `closed` | 已关闭 — 成交归档 | 订单关闭 / 手动关闭 |
| `cancelled` | 已取消 — 取消 | 店员取消 / 客户放弃 |
| `expired` | 已过期 — 报价超期未成交 | 定时任务: quote 超过 N 天仍为 pending/confirmed 且无更新 |

#### P3.5b.2 状态流转图

```
                    ┌──────────┐
                    │  pending │  (初始状态: 报价单创建)
                    └────┬─────┘
           ┌─────────────┼──────────────┐
           │ confirm     │ cancel       │ expire / manual close
           ▼             ▼              ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │confirmed │  │cancelled │  │ expired  │
     └────┬─────┘  └──────────┘  └──────────┘
          │ submit    (terminal)    (terminal)
          ▼
    ┌──────────┐        ┌──────────┐
    │submitted │        │  closed  │  ← pending → closed (manual close)
    └────┬─────┘        └──────────┘
         │ follow_up    (terminal)
         ▼
   ┌────────────┐
   │followed_up │
   └─────┬──────┘
         │ close
         ▼
   ┌──────────┐
   │  closed  │ (terminal)
   └──────────┘

线性主路径:
  pending → confirmed → submitted → followed_up → closed

快捷路径:
  pending → cancelled   (取消)
  pending → expired     (超期)
  pending → closed      (手动关闭)
  confirmed → cancelled (确认后取消)
  confirmed → expired   (确认后超期)

终端状态 (不可再做任何流转):
  closed, cancelled, expired
```

#### P3.5b.3 状态机实现

```typescript
// src/modules/quote/quote-state-machine.ts

type QuoteStatus = 'pending' | 'confirmed' | 'submitted' | 'followed_up' | 'closed' | 'cancelled' | 'expired';

/**
 * 终端状态集合 — 不可做任何流转
 */
const TERMINAL_STATES: ReadonlySet<QuoteStatus> = new Set(['closed', 'cancelled', 'expired']);

/**
 * 报价单状态流转规则表
 * Key = 当前状态, Value = 允许转换到的目标状态集合
 *
 * 线性主路径: pending -> confirmed -> submitted -> followed_up -> closed
 * 快捷路径: pending -> cancelled | expired | closed
 *           confirmed -> cancelled | expired
 */
const VALID_TRANSITIONS: Record<QuoteStatus, ReadonlySet<QuoteStatus>> = {
  pending:      new Set(['confirmed', 'cancelled', 'expired', 'closed']),
  confirmed:    new Set(['submitted', 'cancelled', 'expired']),
  submitted:    new Set(['followed_up']),
  followed_up:  new Set(['closed']),
  closed:       new Set([]), // 终态
  cancelled:    new Set([]), // 终态
  expired:      new Set([]), // 终态
};

/**
 * 校验状态流转是否合法
 * @throws BusinessException(ErrorCode.QUOTE_STATE_INVALID) 若流转非法
 */
export function validateQuoteTransition(
  currentStatus: QuoteStatus,
  targetStatus: QuoteStatus,
): void {
  if (TERMINAL_STATES.has(currentStatus)) {
    throw new BusinessException(
      ErrorCode.QUOTE_STATE_INVALID,
      `报价单已处于终态 "${currentStatus}"，不可再进行状态变更`,
    );
  }

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(targetStatus)) {
    throw new BusinessException(
      ErrorCode.QUOTE_STATE_INVALID,
      `报价单状态不可从 ${currentStatus} 转为 ${targetStatus}`,
    );
  }
}

/**
 * 状态变更时的副作用处理
 */
export function getSideEffectsForTransition(
  targetStatus: QuoteStatus,
): string[] {
  switch (targetStatus) {
    case 'confirmed':
      return ['emit_quote_confirmed_event'];
    case 'closed':
      return ['increment_customer_total_orders', 'increment_customer_total_spent', 'emit_quote_closed_event'];
    case 'cancelled':
      return ['emit_quote_cancelled_event'];
    default:
      return [];
  }
}
```

**QuoteService.updateStatus() 中使用：**

```typescript
// src/modules/quote/quote.service.ts
async updateStatus(
  id: number,
  storeId: number,
  dto: UpdateQuoteStatusDto,
): Promise<Quote> {
  const quote = await this.findById(id, storeId);

  // 1. 校验状态流转合法性
  validateQuoteTransition(quote.status as QuoteStatus, dto.status);

  // 2. 执行状态变更
  quote.status = dto.status;

  // 3. 副作用处理
  const sideEffects = getSideEffectsForTransition(dto.status);

  if (sideEffects.includes('increment_customer_total_orders')) {
    // 仅在成交时递增 customer.total_orders + customer.total_spent
    await this.customerService.incrementOrders(
      storeId,
      quote.customer_phone,
      Number(quote.final_price || quote.total_price),
    );
  }

  if (sideEffects.includes('emit_quote_confirmed_event')) {
    this.eventEmitter.emit('quote.confirmed', { storeId, quoteId: id });
  }

  return this.quoteRepo.save(quote);
}
```

> **store_id 所有权验证 (S5)**: `findById(id, storeId)` 方法通过 `WHERE id = ? AND store_id = ?` 查询，确保报价单属于当前门店。TenantInterceptor 对所有 QuoteModule 查询自动附加 store_id 条件。状态变更时必须传入 storeId 参数，双重保障租户隔离。

> **Expired 状态的触发**: 不通过 API 手动设置。由定时任务 (`@Cron('0 2 * * *')` 每天凌晨 2 点) 扫描 `status IN ('pending','confirmed') AND updated_at < NOW() - INTERVAL 30 DAY` 的报价单，自动标记为 `expired`。按照状态机规则，pending 和 confirmed 状态允许过期流转。超期天数可通过环境变量 `QUOTE_EXPIRY_DAYS` 配置（默认 30 天）。

---

### P3.6 营销活动核销逻辑详解（Campaign Apply Logic）

#### P3.6.1 折扣计算公式

| 折扣类型 | 计算逻辑 | 示例 |
|----------|----------|------|
| `PERCENTAGE` | `discount = total_price * (1 - discount_value)` | 原价 10000, 8折(discount_value=0.8): 优惠=2000, 实付=8000 |
| `FIXED_AMOUNT` | `discount = discount_value` | 原价 10000, 立减500: 优惠=500, 实付=9500 |
| `GIFT` | `discount = 0` | 赠品不影响价格, 优惠=0, 仅记录赠品名称 |

**保护规则**:
- 折扣金额不得超过 `total_price`（不会出现"倒贴钱"）
- `FIXED_AMOUNT` 的折扣值必须 > 0
- `PERCENTAGE` 的折扣值必须在 [0.01, 1.00] 区间

#### P3.6.2 资格校验流程

```
applyCampaign(quoteId, campaignId):
  │
  ├─ 1. 活动存在性校验
  │     campaign = findById(campaignId)
  │     → NOT FOUND: throw CAMPAIGN_NOT_FOUND (3012)
  │
  ├─ 2. 活动状态校验
  │     campaign.status !== 'active'
  │     → throw CAMPAIGN_EXPIRED (3013)
  │
  ├─ 3. 活动有效期校验
  │     NOW() NOT BETWEEN valid_from AND valid_to
  │     → throw CAMPAIGN_EXPIRED (3013)
  │
  ├─ 4. 门店范围校验
  │     target_store_ids.length > 0
  │       AND quote.store_id NOT IN target_store_ids
  │     → throw CAMPAIGN_STORE_MISMATCH (3018)
  │
  ├─ 5. 最低订单金额校验
  │     campaign.min_order_amount != null
  │       AND quote.total_price < campaign.min_order_amount
  │     → throw CAMPAIGN_MIN_AMOUNT_NOT_MET (3015)
  │
  ├─ 6. 新客户专属校验
  │     campaign.new_customer_only === true:
  │       SELECT COUNT(*) FROM quote
  │       WHERE store_id = quote.store_id
  │         AND customer_phone = config.customer_phone
  │         AND status = 'confirmed'
  │         AND campaign_id IS NOT NULL  ← 已有核销记录
  │       → count > 0: throw CAMPAIGN_NEW_CUSTOMER_ONLY (3016)
  │
  ├─ 7. 重复核销校验
  │     SELECT COUNT(*) FROM campaign_claim
  │     WHERE quote_id = quote.id
  │     → count > 0: throw CAMPAIGN_ALREADY_CLAIMED (3014)
  │
  └─ 8. 通过 → 计算折扣 → 更新 quote + 写入 campaign_claim
```

**"新客户"判定标准**: 新客户定义为"在本门店**历史上从未有过已确认且成功应用活动**的报价单"。判定依据：
- 同门店（`quote.store_id`）
- 同手机号（通过报价单 → 方案 → `customer_phone`）
- 存在 `status='confirmed'` 且 `campaign_id IS NOT NULL` 的历史报价单

这确保同一客户不能反复以"新客户"身份参与新客专属活动。

#### P3.6.3 曝光去重策略（view_count）

```typescript
// CampaignService.recordView()
async recordView(campaignId: number, clientIp: string): Promise<void> {
  // Redis 去重 Key: campaign:view:{campaignId}:{clientIp}
  const redisKey = `campaign:view:${campaignId}:${clientIp}`;

  // 检查 5 分钟内是否已记录
  const exists = await this.redis.get(redisKey);
  if (exists) return; // 5 分钟内重复曝光，不计入

  // 设置 5 分钟过期
  await this.redis.set(redisKey, '1', 'EX', 300);

  // 原子更新数据库
  await this.campaignRepo.increment({ id: campaignId }, 'view_count', 1);
}
```

> **去重粒度**: 同一 IP 5 分钟内对同一活动仅计 1 次曝光（FR-171）。使用 Redis `SET NX EX` 实现轻量去重。`view_count` 使用 TypeORM `increment()` 方法，数据库原子操作，避免读-改-写竞态。

---

### P3.7 Dashboard 缓存策略

#### P3.7.1 缓存 Key 设计

| 接口 | 缓存 Key 模板 | TTL | 说明 |
|------|--------------|-----|------|
| `GET /dashboard/kpi` | `dashboard:kpi:{storeId}:{period}:{date}` | 300s (5min) | KPI 概览 — 核心指标，最高频访问 |
| `GET /dashboard/trends` | `dashboard:trends:{storeId}:{period}:{from}:{to}` | 300s (5min) | 趋势数据 — 日期范围确定，数据不变 |
| `GET /dashboard/top-rankings` | `dashboard:rankings:{storeId}:{type}:{period}` | 300s (5min) | 热门排行 — 月度排行变化缓慢 |
| `GET /dashboard/staff-performance` | `dashboard:staff:{storeId}:{period}:{from}:{to}` | 300s (5min) | 店员业绩 — 相对稳定 |

**Admin 全平台汇总缓存 Key**: 当 admin 不传 `store_id` 时，使用 `dashboard:*:all` 作为特殊 store_id。

#### P3.7.2 缓存读取策略（Cache-Aside）

```typescript
// DashboardService.getKpi()
async getKpi(storeId: number | 'all', query: KpiQueryDto): Promise<KpiOverview> {
  const cacheKey = `dashboard:kpi:${storeId}:${query.period}:${query.date}`;

  // 1. 尝试从 Redis 读取
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Cache miss — 查询数据库
  const kpi = await this.calculateKpiFromDB(storeId, query);

  // 3. 写入 Redis (5 min TTL)
  await this.redis.set(cacheKey, JSON.stringify(kpi), 'EX', 300);

  return kpi;
}
```

#### P3.7.3 缓存失效策略

Dashboard 缓存在以下场景主动失效：

| 触发场景 | 失效操作 | 实现位置 |
|----------|----------|----------|
| 新报价单创建 | 删除本门店所有 `dashboard:*:{storeId}:*` | QuoteModule 的 `QuoteService.create()` 中通过 EventBus 触发 |
| 报价单状态变更（confirmed/cancelled） | 同上 | QuoteModule 的 `QuoteService.updateStatus()` 中 |
| 新预约创建 | 同上（预约日历相关缓存） | AppointmentModule 的 `AppointmentService.create()` 中 |
| 预约状态变更 | 同上 | AppointmentModule 中 |

**渐进式失效实现：**

```typescript
// src/modules/dashboard/dashboard-cache.service.ts
@Injectable()
export class DashboardCacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * 失效指定门店的所有 Dashboard 缓存
   * 使用 SCAN 渐进式扫描，避免 KEYS 阻塞 Redis
   */
  async invalidateStoreCache(storeId: number): Promise<void> {
    const pattern = `dashboard:*:${storeId}:*`;
    let cursor = '0';
    const keys: string[] = [];

    // SCAN 分批获取匹配的 Key
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    // 批量异步删除 (UNLINK 非阻塞)
    if (keys.length > 0) {
      await this.redis.unlink(...keys);
    }
  }
}
```

**DashboardCacheService 被事件订阅者调用：**

```typescript
// src/modules/dashboard/subscribers/dashboard-cache.subscriber.ts
@Injectable()
export class DashboardCacheSubscriber {
  constructor(private readonly cacheService: DashboardCacheService) {}

  @OnEvent('quote.created')
  async onQuoteCreated(payload: { storeId: number }) {
    await this.cacheService.invalidateStoreCache(payload.storeId);
  }

  @OnEvent('quote.status_changed')
  async onQuoteStatusChanged(payload: { storeId: number }) {
    await this.cacheService.invalidateStoreCache(payload.storeId);
  }
}
```

#### P3.7.4 缓存预热（可选 P1）

```typescript
// DashboardService.warmupCache()
@Cron('*/4 * * * *') // 每 4 分钟自动刷新热门门店的 KPI 缓存
async warmupCache(): Promise<void> {
  const activeStoreIds = await this.getActiveStoreIds(); // 最近 1 小时有报价的门店

  for (const storeId of activeStoreIds) {
    const today = new Date().toISOString().slice(0, 10);
    await this.getKpi(storeId, { period: 'daily', date: today });
  }
}
```

**Trade-off — 缓存策略:**

| 决策项 | 选择 | 备选 | 分析 |
|--------|------|------|------|
| TTL | 5 分钟固定 TTL | 主动失效 + 短 TTL | Dashboard 数据对实时性要求不高（5 分钟延迟可接受）；固定 TTL 简单可靠，无需依赖事件总线的可靠性 |
| 失效方式 | SCAN + UNLINK 批量删除 | KEYS pattern 删除 | SCAN 非阻塞，适合生产环境；UNLINK 异步删除不阻塞 Redis 主线程 |
| 缓存 Key 粒度 | 按 `storeId:period:date` 组合 | 仅按 storeId | 不同查询参数的组合 Key 避免缓存互相覆盖 |
| admin 全平台缓存 | 独立 Key (`dashboard:*:all:`) | 不缓存全平台数据 | 全平台聚合计算量大，缓存收益更高 |

---

### P3.8 Haversine 附近门店查询详解

#### P3.8.1 算法选择

Haversine 公式：

```
a = sin²(Δlat/2) + cos(lat1) · cos(lat2) · sin²(Δlng/2)
c = 2 · atan2(√a, √(1-a))
d = R · c

其中 R = 6371000 (地球平均半径, 米)
```

#### P3.8.2 查询流程（两步策略）

**第一步 — BBOX 粗筛 (数据库层)**:
利用 `idx_lat_lng` 复合索引加速 BBOX 经纬度范围查询，快速排除明显超出搜索半径的门店。

```sql
-- BBOX 粗筛 SQL (利用 idx_lat_lng 索引)
SELECT sl.*, s.name, s.phone, s.logo
FROM store_location sl
INNER JOIN store s ON s.id = sl.store_id
  AND s.status = 'active'
  AND s.deleted_at IS NULL
WHERE sl.lat BETWEEN :minLat AND :maxLat
  AND sl.lng BETWEEN :minLng AND :maxLng
  AND sl.deleted_at IS NULL;
```

**第二步 — 应用层精算**:
对 BBOX 结果集逐行计算 Haversine 距离，过滤 `distance <= radius`，排序后分页。

#### P3.8.3 BBOX 精度分析

BBOX 是正方形近似而非圆形，返回的结果集会**略大于**实际圆形范围。极端情况下（高纬度地区），边界距离误差约 0.5%。传入 `radius=5000` 的实际搜索结果半径约为 4975-5025 米，可接受。

对于中国大陆区域（纬度 18-54），BBOX 近似精度在 1% 以内，完全满足业务需求。

#### P3.8.4 性能评估

| 门店数量 | BBOX 结果数（5km半径） | 应用层计算耗时 | 总响应时间 |
|----------|----------------------|---------------|-----------|
| 50 | ~3-5 | < 1ms | < 50ms |
| 200 | ~10-15 | < 2ms | < 100ms |
| 500 | ~20-40 | < 5ms | < 200ms |
| 1000 | ~40-80 | < 10ms | < 300ms |
| 5000+ | 需空间索引 | — | 建议迁移到 SPATIAL INDEX |

**结论**: Phase 3 门店量预计 < 500 家，应用层 Haversine + BBOX 方案完全满足 NFR-90（< 500ms 响应时间）。`idx_lat_lng` 复合索引确保 BBOX 查询走索引而非全表扫描。

#### P3.8.5 未来迁移到 MySQL SPATIAL INDEX 的路径

```sql
-- Step 1: 新增 POINT 列
ALTER TABLE store_location
  ADD COLUMN `coordinate` POINT NOT NULL SRID 4326 AFTER `lng`;

-- Step 2: 回填数据
UPDATE store_location
SET coordinate = ST_SRID(POINT(lng, lat), 4326);

-- Step 3: 创建空间索引
ALTER TABLE store_location
  ADD SPATIAL INDEX `idx_coordinate` (`coordinate`);

-- Step 4: 新查询方式（替代应用层 Haversine）
SELECT
  s.name, s.phone, s.logo,
  sl.*,
  ST_Distance_Sphere(sl.coordinate, ST_SRID(POINT(:lng, :lat), 4326)) AS distance_meters
FROM store_location sl
INNER JOIN store s ON s.id = sl.store_id
WHERE ST_Distance_Sphere(sl.coordinate, ST_SRID(POINT(:lng, :lat), 4326)) <= :radius
ORDER BY distance_meters ASC;
```

> **触发器维护**: 可在 `store_location` 表上创建 `BEFORE INSERT` / `BEFORE UPDATE` 触发器自动从 `lat`/`lng` 更新 `coordinate` 列，或在 TypeORM Entity 中使用 `@BeforeInsert()` / `@BeforeUpdate()` 钩子同步。

---

### P3.9 CRM 自动同步详解

#### P3.9.1 触发场景

客户数据在以下场景自动同步：

| 触发场景 | 事件 | 行为 |
|----------|------|------|
| 创建改色方案 | `ConfigurationCreatedEvent` | 查询 `customer_phone` → 不存在则创建客户，存在则更新 `last_visit_at` + `total_visits += 1` |
| 创建报价单 | `QuoteCreatedEvent` (P1 扩展) | 同上逻辑（通过报价单 → 方案 → customer_phone） |
| 报价单确认 | `QuoteConfirmedEvent` (P1 扩展) | 更新 `total_orders += 1` + `total_spent += final_price` |

#### P3.9.2 架构设计：异步事件订阅者

```
┌─────────────────────┐
│ ConfigurationModule │
│  create()           │
│    │                │
│    │ (事务提交后)    │
│    ▼                │
│  EventBus.publish(  │
│    Configuration    │
│    CreatedEvent)    │
└────────┬────────────┘
         │
         │  @nestjs/event-emitter
         │
         ▼
┌─────────────────────┐
│ CustomerModule      │
│                     │
│ CustomerSync        │
│ Subscriber          │
│                     │
│ @OnEvent('config    │
│  uration.created')  │
│ { async: true }     │  ← 异步执行，不阻塞主流程
│                     │
│ handle() {          │
│   1. 校验手机号     │
│   2. upsertByPhone  │
│   3. 异常 → warn    │
│ }                   │
└─────────────────────┘
```

#### P3.9.3 安全与容错

| 措施 | 实现 |
|------|------|
| **异步非阻塞** | `@OnEvent('configuration.created', { async: true })` — 客户同步在独立微任务中执行，不影响方案创建的响应时间 |
| **手机号校验** | 非空 + 正则 `/^1[3-9]\d{9}$/` 校验，格式不合法则静默跳过（AC-172） |
| **异常隔离** | try-catch 包裹同步逻辑，异常仅记录 warn 日志，不向上传播 |
| **幂等性** | `upsertByPhone()` 使用 `INSERT ... ON DUPLICATE KEY UPDATE` 原子操作，store_id + phone 唯一键保证重复事件不产生重复记录 |
| **重试** | 事件订阅失败不自动重试（降低复杂度）。客户数据"最终一致"，下次创建方案时自动补全 |

---

### P3.10 安全设计

#### P3.10.1 限流策略

| 接口 | 限流策略 | 限流 Key | 说明 |
|------|----------|----------|------|
| `POST /api/v1/appointments` | 3 次 / 60 秒 | 客户端 IP | 防止恶意刷预约 |
| `GET /api/v1/campaigns/available` | 30 次 / 60 秒 | 客户端 IP | 防止恶意爬取活动信息 |
| `GET /api/v1/admin/dashboard/*` | 30 次 / 10 秒 | `store_id` (从 JWT 提取) | 防止高频刷新看板冲击数据库（NFR-102） |
| `POST /api/v1/admin/customers/import` | 1 次 / 60 秒 | `store_id` + `staff_id` | 防止并发导入冲突 |

**Appointment 限流 Guard 实现：**

```typescript
// 装饰器方式
@Public()
@Throttle({ default: { limit: 3, ttl: 60000 } })
@Post('appointments')
async create(@Body() dto: CreateAppointmentDto) { ... }
```

**Campaign 限流 Guard 实现：**

```typescript
// 装饰器方式
@Public()
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Get('campaigns/available')
async getAvailable(@Query() query: CampaignAvailableQueryDto) { ... }
```

**Dashboard 限流 Guard：**

```typescript
// src/modules/dashboard/guards/dashboard-throttle.guard.ts
@Injectable()
export class DashboardThrottleGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    // 使用 store_id 作为限流 key（而非 IP）
    // 防止同一门店的多个店员共享 IP 时限流误伤
    return `dashboard:${req.user.storeId}`;
  }
}
```

#### P3.10.2 Store ID 隔离

所有 Phase 3 模块遵循 Phase 1 建立的租户隔离机制：

| 模块 | 隔离方式 | 具体实现 |
|------|----------|----------|
| **StoreLocationModule** | 一对一归属 | `store_location.store_id` UNIQUE，写入时从 JWT 提取 store_id，读取时按 store_id 查询 |
| **AppointmentModule** | store_id 多租户 | 创建时强制 `store_id` 从请求体/参数/JWT 提取；列表查询自动注入 `WHERE store_id = ?`；公开接口的 `store_id` 从请求参数显式传入 |
| **CampaignModule** | 通过 target_store_ids 控制 | `GET /campaigns/available` 按传入的 store_id 过滤；核销时校验 `quote.store_id IN target_store_ids` |
| **DashboardModule** | store_id 查询隔离 | Controller 层从 JWT 提取 store_id，admin 可通过 `?store_id=` 跨门店查询 |
| **CustomerModule** | store_id 多租户 | 所有 CRUD 自动注入 `WHERE store_id = ?`；导入时 store_id 从 JWT 提取 |
| **QuoteModule (修改)** | store_id 多租户 | `updateStatus()` 强制传入 storeId 参数，`findById(id, storeId)` 双重校验；TenantInterceptor 自动附加 store_id 条件（S5 确认） |

**Admin 跨门店查询控制：**

```typescript
// DashboardController.getKpi()
@Get('dashboard/kpi')
@Roles('manager', 'admin')
async getKpi(@CurrentUser() user: JwtPayload, @Query() query: KpiQueryDto) {
  let storeId: number | 'all' = user.store_id;

  // Admin 专属: 可通过 ?store_id= 查询指定门店
  if (user.role === 'admin' && query.store_id) {
    storeId = query.store_id;
  } else if (user.role === 'admin' && !query.store_id) {
    storeId = 'all'; // 全平台汇总
  }

  return this.dashboardService.getKpi(storeId, query);
}
```

#### P3.10.3 手机号脱敏

```typescript
// src/common/utils/mask-phone.ts
/**
 * 手机号脱敏: 13800138000 → 138****8000
 * 用于: 客户列表响应、日志输出
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '<null>';
  if (phone.length !== 11) return phone.slice(0, 3) + '****';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
```

**应用位置：**
- `CustomerController` 的列表/详情响应中自动脱敏（通过 Response Interceptor 或 Entity `toJSON()` 钩子）
- 日志中：`this.logger.log(`Customer phone: ${maskPhone(phone)}`)`
- **CSV 导出除外**: 导出文件包含完整手机号，但需记录审计日志（NFR-111）

#### P3.10.4 审计日志（NFR-111）

```typescript
// src/common/interceptors/audit-log.interceptor.ts
// 对客户导出操作记录审计日志
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // 仅对导出接口记录
    if (request.path === '/api/v1/admin/customers/export') {
      const auditEntry = {
        action: 'CUSTOMER_EXPORT',
        store_id: request.user.storeId,
        staff_id: request.user.sub,
        staff_name: request.user.name,
        filter_tag: request.query.tag || null,
        ip: request.ip,
        created_at: new Date(),
      };
      // 异步写入 audit_log 表（不阻塞响应）
      this.eventEmitter.emit('audit.log', auditEntry);
    }

    return next.handle();
  }
}
```

**audit_log 表（Phase 3 新增，最小化设计）：**

```sql
CREATE TABLE `audit_log` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`      BIGINT UNSIGNED NOT NULL,
  `staff_id`      BIGINT UNSIGNED NOT NULL,
  `staff_name`    VARCHAR(100)    NOT NULL,
  `action`        VARCHAR(100)    NOT NULL                  COMMENT '操作类型',
  `detail`        JSON            NULL                      COMMENT '操作详情',
  `ip`            VARCHAR(45)     NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_action` (`store_id`, `action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作审计日志';
```

---

### P3.11 错误码体系（Phase 3 新增）

在现有错误码枚举（Phase 1 和 Phase 2 的 1000-5004）中追加：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| 3019 | STORE_NOT_FOUND | 404 | 门店不存在 | 预约时传入的 store_id 不存在或门店已停用（注意: 3006 已被 P2 GENERATION_NOT_FOUND 占用） |
| 3007 | STORE_LOCATION_NOT_FOUND | 404 | 门店地理位置信息不存在，请先完善门店信息 | 门店未设置地理位置 |
| 3008 | APPOINTMENT_NOT_FOUND | 404 | 预约不存在 | 预约 ID 不存在或已删除 / 不属于本门店 |
| 3009 | SLOT_FULL | 409 | 该时段预约已满，请选择其他时间段 | 预约产能已满 |
| 3010 | APPOINTMENT_DATE_INVALID | 400 | 预约日期不能早于今天 | 预约日期不合法（过去的日期） |
| 3011 | APPOINTMENT_CANCELLED | 400 | 已取消的预约不可再确认 | 状态流转校验 — cancelled 为终态 |
| 3012 | CAMPAIGN_NOT_FOUND | 404 | 活动不存在 | 活动 ID 不存在或已删除 |
| 3013 | CAMPAIGN_EXPIRED | 400 | 活动已过期，不可应用 | 活动有效期已过或 status 不为 active |
| 3014 | CAMPAIGN_ALREADY_CLAIMED | 409 | 该报价单已参与活动，不可重复参加 | 重复核销校验 (uk_quote_campaign) |
| 3015 | CAMPAIGN_MIN_AMOUNT_NOT_MET | 400 | 订单金额未达到活动最低消费门槛 | 最低订单金额不满足 |
| 3016 | CAMPAIGN_NEW_CUSTOMER_ONLY | 400 | 该活动仅限新客户参与 | 客户在本门店已有消费记录 |
| 3017 | CUSTOMER_NOT_FOUND | 404 | 客户不存在 | 客户 ID 不存在或不属于本门店 |
| 3018 | CAMPAIGN_STORE_MISMATCH | 400 | 该活动不适用于本门店 | 门店不在活动的 target_store_ids 范围内 |
| 4007 | IMPORT_FILE_TOO_LARGE | 400 | 文件大小不能超过 10MB | CSV 导入文件超标 |
| 4008 | IMPORT_ROW_LIMIT_EXCEEDED | 400 | 单次导入不能超过 5000 行 | CSV 行数超标 |
| 4009 | CAMPAIGN_INVALID_DISCOUNT | 400 | 折扣值不合法 | discount_value 超出允许范围 |
| 4010 | APPOINTMENT_STATE_INVALID | 400 | 预约状态流转不合法 | 状态机校验失败 |
| 4011 | DASHBOARD_DATE_RANGE_TOO_LARGE | 400 | 查询时间范围不能超过 3 个月 | NFR-101 — trends 查询范围限制 |
| 4012 | QUOTE_STATE_INVALID | 400 | 报价单状态流转不合法 | 报价单状态机校验失败 |
| 5005 | APPOINTMENT_CAPACITY_ERROR | 500 | 产能校验异常，请重试 | 数据库/事务异常导致产能校验失败 |

**错误码体系文件扩展：**

```typescript
// src/common/exceptions/error-codes.ts (追加)
export enum ErrorCode {
  // ... Phase 1/2 codes ...

  // START Phase 3 — Store Location & Appointment
  STORE_NOT_FOUND = 3019,
  STORE_LOCATION_NOT_FOUND = 3007,
  APPOINTMENT_NOT_FOUND = 3008,
  SLOT_FULL = 3009,
  APPOINTMENT_DATE_INVALID = 3010,
  APPOINTMENT_CANCELLED = 3011,
  // END Phase 3 — Store Location & Appointment

  // START Phase 3 — Campaign
  CAMPAIGN_NOT_FOUND = 3012,
  CAMPAIGN_EXPIRED = 3013,
  CAMPAIGN_ALREADY_CLAIMED = 3014,
  CAMPAIGN_MIN_AMOUNT_NOT_MET = 3015,
  CAMPAIGN_NEW_CUSTOMER_ONLY = 3016,
  CAMPAIGN_STORE_MISMATCH = 3018,
  // END Phase 3 — Campaign

  // START Phase 3 — Customer
  CUSTOMER_NOT_FOUND = 3017,
  // END Phase 3 — Customer

  // START Phase 3 — Import/Export
  IMPORT_FILE_TOO_LARGE = 4007,
  IMPORT_ROW_LIMIT_EXCEEDED = 4008,
  CAMPAIGN_INVALID_DISCOUNT = 4009,
  APPOINTMENT_STATE_INVALID = 4010,
  DASHBOARD_DATE_RANGE_TOO_LARGE = 4011,
  QUOTE_STATE_INVALID = 4012,
  // END Phase 3 — Import/Export

  // START Phase 3 — Server Error
  APPOINTMENT_CAPACITY_ERROR = 5005,
  // END Phase 3 — Server Error
}
```

---

### P3.12 配置管理（Phase 3 新增环境变量）

```bash
# ==================== Phase 3 新增 — 预约 ====================
APPOINTMENT_DEFAULT_SLOT_CAPACITY=3             # 每时段默认预约容量 (store_location 未配置时的回退值)
APPOINTMENT_MAX_SEARCH_RADIUS=50000             # 附近门店搜索最大半径 (米, 默认 50km)

# ==================== Phase 3 新增 — 营销活动 ====================
CAMPAIGN_VIEW_DEDUP_TTL=300                     # 活动曝光 IP 去重窗口 (秒, 默认 300 = 5 分钟)

# ==================== Phase 3 新增 — Dashboard ====================
DASHBOARD_CACHE_TTL=300                         # Dashboard 缓存 TTL (秒, 默认 300 = 5 分钟)
DASHBOARD_TREND_MAX_MONTHS=3                    # 趋势查询最大时间跨度 (月, 默认 3)
DASHBOARD_THROTTLE_LIMIT=30                     # Dashboard 限流: 每窗口请求数
DASHBOARD_THROTTLE_TTL=10                       # Dashboard 限流: 滑动窗口大小 (秒)

# ==================== Phase 3 新增 — CRM ====================
CUSTOMER_IMPORT_MAX_FILE_SIZE=10485760          # 客户导入最大文件大小 (字节, 默认 10MB)
CUSTOMER_IMPORT_MAX_ROWS=5000                   # 客户导入最大行数

# ==================== Phase 3 新增 — Quote ====================
QUOTE_EXPIRY_DAYS=30                            # 报价单超期天数 (默认 30 天)
```

**环境变量校验（Phase 3 扩展）：**

```typescript
// env.validation.ts (追加)
APPOINTMENT_DEFAULT_SLOT_CAPACITY: Joi.number().integer().min(1).max(20).default(3),
APPOINTMENT_MAX_SEARCH_RADIUS: Joi.number().integer().min(1000).max(100000).default(50000),
CAMPAIGN_VIEW_DEDUP_TTL: Joi.number().integer().min(60).max(3600).default(300),
DASHBOARD_CACHE_TTL: Joi.number().integer().min(60).max(3600).default(300),
DASHBOARD_TREND_MAX_MONTHS: Joi.number().integer().min(1).max(12).default(3),
DASHBOARD_THROTTLE_LIMIT: Joi.number().integer().min(1).default(30),
DASHBOARD_THROTTLE_TTL: Joi.number().integer().min(1).default(10),
CUSTOMER_IMPORT_MAX_FILE_SIZE: Joi.number().integer().min(1048576).default(10485760),
CUSTOMER_IMPORT_MAX_ROWS: Joi.number().integer().min(100).max(50000).default(5000),
QUOTE_EXPIRY_DAYS: Joi.number().integer().min(7).max(365).default(30),
```

---

### P3.13 技术决策与 Trade-off 汇总（Phase 3）

| 决策项 | 选择 | 备选方案 | Trade-off 分析 |
|--------|------|----------|---------------|
| 附近门店搜索 | 应用层 Haversine + BBOX 粗筛 | MySQL SPATIAL INDEX | Phase 3 门店量 < 500，应用层计算简单可控且性能满足需求；迁移到空间索引的路径已预留 |
| 预约产能并发控制 | `SELECT FOR UPDATE` 行级锁 | Redis 分布式锁 / 乐观锁 | 同一门店同日同时段的并发冲突概率极低，行级锁简单有效；Redis 锁引入额外组件依赖 |
| 活动数据隔离 | `campaign` 表无 store_id + JSON `target_store_ids` | 多对多中间表 `campaign_stores` | JSON 字段简单直接，门店量 < 1000 时查询性能可接受；中间表方案在门店量增长后可迁移 |
| 活动核销 | 在报价单中冗余 campaign_id + discount_amount | 仅通过 campaign_claim 关联 | 冗余字段简化报价单详情查询（无需 JOIN campaign_claim），与 Phase 2 的 like_count 冗余思路一致 |
| Dashboard 数据聚合 | 直接 SQL GROUP BY 聚合 | 预计算 + 物化视图 / 定时 ETL | Phase 3 数据量小，直接聚合实时性好；数据量大后可引入定时预计算任务 |
| Dashboard 缓存 | Redis Cache-Aside + 5min TTL | 不做缓存 | 5 分钟延迟对运营看板可接受；缓存命中的热数据响应 < 100ms |
| 缓存失效 | SCAN + UNLINK 批量 pattern 删除 | KEYS pattern | SCAN 非阻塞，UNLINK 异步删除，生产环境安全 |
| 客户同步 | 异步事件订阅者 (EventBus) | 同步调用 / 数据库触发器 | 异步不阻塞方案创建主流程；失败不影响核心业务（最终一致性） |
| 客户唯一标识 | store_id + phone 门店内唯一 | 全平台 phone 唯一 | 不同门店的同一手机号视为不同客户，符合多租户隔离模型 |
| 手机号脱敏 | 响应时中间 4 位替换为 `****` | 使用加密存储 | 脱敏即可满足日志和列表展示需求；CSV 导出时完整输出（需审计日志） |
| 活动曝光去重 | Redis SET NX + 5min TTL | 数据库记录每次曝光 | Redis 轻量去重，无需写入数据库（view_count 仅需最终计数） |
| 状态机 | 应用层状态流转表 + 显式校验 | 数据库 ENUM + CHECK 约束 | 应用层校验灵活，可返回业务友好错误信息；ENUM 仅约束值范围，不约束流转规则 |
| campaign.view_count 更新 | `increment()` 原子操作 | 读-改-写 | 原子操作避免并发竞态，与 Phase 2 的 case.view_count 一致 |
| 客户导入 | 同步逐行处理 + 事务逐行提交 | 异步队列批量处理 | 单次最多 5000 行，同步处理 < 5s；超过此规模才需队列 |
| 循环依赖解决 | CampaignModule 处理 apply-campaign 端点 | QuoteModule 调用 CampaignClaimService | CampaignModule 依赖 QuoteModule（单向），消除循环依赖 |
| customer.total_orders | Quote status 转 confirmed 时递增 | Campaign apply 时递增 | 核销仅是使用优惠，不代表确认成交；在 confirmed 状态递增语义正确 |
| 客户 upsert | INSERT ... ON DUPLICATE KEY UPDATE | SELECT-then-INSERT | 原子操作消除并发竞态条件 |

---

### P3.14 不做的事（Phase 3 排除项）

以下为 Phase 3 明确不做、推迟到 Phase 4 的功能：

| 事项 | 原因 |
|------|------|
| 微信支付 / 在线支付预约定金 | 线下交易模式，暂不引入线上支付 |
| 营销活动自动定时发布/下架 | Phase 3 手动管理活动状态，定时调度放 Phase 4 |
| 营销活动审批流程（总部审批） | Phase 3 门店 manager 直接创建生效 |
| 营销活动预算与费用监控 | 仅做统计分析，不拦截超额 |
| 数据看板导出 PDF/Excel | Phase 4 功能，Phase 3 仅提供 JSON API |
| Dashboard 数据接入 BI 工具（如 Metabase） | 暂不对接，JSON API 自足 |
| 客户合并/去重（同一手机号跨门店合并） | Phase 3 客户数据按门店隔离 |
| 客户生日/纪念日提醒 | Phase 4 CRM 增强功能 |
| 店员与客户绑定（专属销售） | Phase 4 CRM 增强功能 |
| CRM 对接企业微信/钉钉 | 暂不打通外部通讯工具 |
| 客户数据跨门店迁移（门店合并/拆分） | 运营策略待定，暂不实现 |
| 门店地图导航跳转（调用高德/腾讯地图 App） | 客户端功能，后端提供经纬度即可 |
| 短信验证码登录（替代密码登录） | Phase 3 仅提供验证码用于预约校验（P1），完整验证码登录放 Phase 4 |
| AI 生图队列管理与优先级调度 | 仍为即时调用模式 |
| 部件面积按实际车型精确测量 | 仍使用默认值 |
| 案例评论/排行榜/分享 | Phase 4 社区功能 |
| 短信验证码校验用于预约（NFR-121, P1） | 预约模块预留了 SmsModule 依赖接口和 `sms_code` 表，但 Phase 3 预约接口中不强制要求短信验证码输入。`CreateAppointmentDto` 中未包含 `sms_code` 字段，客户可直接提交预约。短信验证码校验属 P1 优先级，推迟到 Phase 4 与完整的验证码体系一起实现。届时在 `CreateAppointmentDto` 中新增可选的 `sms_code` 字段，并在 `AppointmentService.create()` 中先验证短信验证码再创建预约。 |

---

*架构版本：v3.0 (Phase 3 新增)*
*编写角色：🏛️ Software Architect*
*更新日期：2026-07-22*

---

## Phase 4 Architecture -- 社区化 + 智能化 + 精细化运营

> Phase 4 在 Phase 3 基础上，新增案例社区（评论/排行/分享）、营销自动化（定时发布/审批）、CRM 增强（合并/关怀/绑定/Webhook）、AI 队列、精确面积、短信验证码登录/预约校验、Dashboard 导出、客户迁移、AR 预览共 **16 个模块**。新增 **9 张业务表**（case_comment, case_stats_daily, scheduler_log, webhook_config, webhook_log, export_task, notification_log, customer_snapshot, car_part），扩展 **6 张现有表**（campaign, customer, case, car_model, ai_generation, sms_code），错误码扩展至 **1012-1015（Auth/SMS）、3020-3021（Resource）、4020-4029（Business）、5007（Server）**。引入 Bull 队列（Redis-backed）和 Cron 定时任务体系。

### P4.1 Module Architecture (Phase 4 全景)

#### P4.1.1 新增模块

```
AppModule (Phase 4)
│
│  === Phase 1/2/3 模块（不变/扩展）===
├── ConfigModule (global)
├── DatabaseModule (global)
├── CommonModule (global)
├── AuthModule ─────────────── 扩展: POST /auth/sms-login, /auth/send-sms-code 新增 type='login'
│   │                                        type='appointment'
│   └── SmsLoginService                     (验证码登录 + 自动注册逻辑)
├── VehicleModule ──────────── 扩展: GET /vehicles/models/:id/ar-config
│   │                                        PUT /admin/vehicles/models/:id/parts/batch (批更新面积)
│   │                                        GET /admin/vehicles/models/:id/parts/area
│   └── PartAreaService                     (部件面积 CRUD + 查询)
├── ColorModule (不变)
├── ConfigurationModule ────── 修改: GET /configurations/:id/ar-texture
│   │                              └── 发布 CustomerStaffBinding 事件 (自动绑定专属销售)
│   └── QuoteModule ──────────── 修改: PartAreaCalculator 集成精确面积计算
├── StoreModule (不变)
├── FileModule (不变)
├── PartModule (不变)
├── CaseModule ──────────────── 扩展: 新增 CaseCommentService, CaseShareService, CaseRankingService
│   │                                        POST   /cases/:id/comments
│   │                                        GET    /cases/:id/comments
│   │                                        DELETE /cases/:id/comments/:commentId
│   │                                        GET    /cases/ranking
│   │                                        GET    /cases/:id/share-card
│   │                                        POST   /cases/:id/share
│   └── CaseAdminController                 GET    /admin/comments/pending
│                                            PUT    /admin/comments/:id/approve
├── FavoriteModule (不变)
├── AiModule ───────────────── 重构: Bull 队列替代 fire-and-forget
│   │                                        POST   /configurations/:id/generate-image (返回 queue_position)
│   │                                        GET    /generations/:id/queue-status
│   ├── AiQueueService                      (Bull producer: add job to queue)
│   ├── AiGenerationProcessor               (Bull consumer: process AI generation jobs)
│   └── AiQueueAdminController             GET    /admin/ai-queue/stats
├── SmsModule ──────────────── 扩展: type 枚举新增 'login' + 'appointment'
├── WsModule (不变)
├── CampaignModule ─────────── 扩展: 新增 CampaignSchedulerService, CampaignApprovalService
│   │                                        GET    /admin/campaigns/approvals
│   │                                        PUT    /admin/campaigns/:id/approve
│   │                                        GET    /admin/campaigns/my
│   └── CampaignScheduler                   @Cron EVERY_MINUTE 定时上下架
├── DashboardModule ────────── 扩展: 新增 DashboardExportService
│   │                                        POST   /admin/dashboard/export/pdf
│   │                                        POST   /admin/dashboard/export/excel
│   │                                        GET    /admin/dashboard/exports/:id
│   │                                        GET    /admin/dashboard/customer-care
│   └── ExportProcessor                      (Bull consumer: 异步生成 PDF/Excel)
├── CustomerModule ─────────── 扩展: 新增 CustomerMergeService, CustomerMigrationService
│   │                                        CustomerCareService (生日/纪念日提醒)
│   │                                        StaffBindingService (专属销售)
│   │                                        POST   /admin/customers/merge
│   │                                        GET    /admin/customers/duplicates
│   │                                        POST   /admin/customers/migrate
│   │                                        POST   /admin/customers/migrate/confirm
│   │                                        GET    /admin/customers/migration-history
│   │                                        PUT    /admin/customers/:id/assign
│   │                                        PUT    /admin/customers/:id/unassign
│   └── CustomerReminderScheduler            @Cron EVERY_DAY_AT_8AM 生日/纪念日提醒
│
├── WebhookModule ──────────── 【P4 新增】CRM 对接企业微信/钉钉
│   ├── WebhookController                   PUT    /admin/webhook/config
│   │                                        GET    /admin/webhook/config
│   │                                        GET    /admin/webhook/logs
│   ├── WebhookService                      (配置 CRUD + HMAC 签名 + 重试逻辑)
│   ├── WebhookDispatcher                   (事件订阅者: 监听业务事件推送 Webhook)
│   └── entities/
│       ├── webhook-config.entity.ts
│       └── webhook-log.entity.ts
│
├── SchedulerModule ────────── 【P4 新增】定时任务管理
│   ├── CampaignScheduler                   @Cron('*/1 * * * *') 活动定时上下架
│   ├── CaseStatsScheduler                  @Cron('0 1 * * *')   每日案例统计快照
│   ├── RankingCacheScheduler              @Cron('0 * * * *')   每小时更新排行榜缓存
│   ├── SmsCleanupScheduler                 @Cron('0 3 * * *')   清理过期验证码 (Phase 2 已有, 移至此处统一管理)
│   ├── CustomerReminderScheduler           @Cron('0 8 * * *')   客户生日/纪念日提醒
│   ├── ExportCleanupScheduler              @Cron('0 4 * * *')   清理过期导出文件 (>7天)
│   ├── DistributedLockService              (Redis SETNX 分布式锁, 防多实例重复执行)
│   └── entities/
│       ├── scheduler-log.entity.ts
│       └── notification-log.entity.ts
│
└── AuditModule ────────────── 【P4 新增】审计日志 (从 Phase 3 的 audit_log 表扩展)
    ├── AuditService                         (统一审计日志写入)
    └── entities/
        └── audit-log.entity.ts              (Phase 3 已有, P4 扩展: 审批/合并/迁移 审计记录)
```

#### P4.1.2 Phase 4 模块依赖关系图

```
                                    ┌──────────────────┐
                                    │   CommonModule    │  (global)
                                    └────────┬─────────┘
                                             │
     ┌───────────────────────────────────────┼───────────────────────────────────────┐
     │                                       │                                       │
     ▼                                       ▼                                       ▼
┌─────────┐                          ┌─────────────┐                          ┌──────────┐
│ AuthModule│                          │  CaseModule  │                          │ Campaign │
│ (扩展)   │                          │  (扩展)      │                          │  Module  │
│          │                          │              │                          │ (扩展)   │
│ + sms-   │                          │ + Comment    │                          │          │
│   login  │                          │ + Ranking    │◄──── Cache Hit ──────────│ + Approval│
│          │                          │ + Share      │                          │ + Sched. │
└────┬─────┘                          └──────┬───────┘                          └────┬─────┘
     │                                       │                                       │
     │ 依赖 SmsModule                        │ 依赖 Redis (ranking cache)           │ 依赖
     │                                       │                                       │ SchedulerModule
     ▼                                       │                                       │ (定时任务)
┌──────────┐                                 │                                       │
│ SmsModule │                                │                                       │
│ (扩展)    │                                │                                       │
│           │                                │                                       │
│ type 新增:│                                │                                       ▼
│ login     │                                │                              ┌────────────────┐
│ appointment│                               │                              │SchedulerModule │
└────┬──────┘                                │                              │                │
     │                                       │                              │ distributedLock│
     │ 被 Auth + Appointment                 │                              │ @Cron jobs:    │
     │ 引用                                  │                              │ campaign/      │
     ▼                                       │                              │ caseStats/     │
┌────────────────┐                           │                              │ ranking/       │
│AppointmentModule│                          │                              │ smsCleanup/    │
│ (修改)          │                          │                              │ reminder/      │
│                 │                          │                              │ exportCleanup  │
│ CreateApptDto   │                          │                              └───────┬────────┘
│ + sms_code      │                          │                                      │
└─────────────────┘                          │                                      │ 依赖 Redis
                                             │                                      │ + SchedulerLog
                                             ▼                                      │
                                    ┌────────────────┐                              │
                                    │  CustomerModule │◄───────────────────────────┘
                                    │  (扩展)         │
                                    │                 │
                                    │ + Merge         │──── 依赖 QuoteModule
                                    │ + Migration     │──── 依赖 ConfigurationModule
                                    │ + Care (remind) │──── 依赖 SchedulerModule
                                    │ + StaffBinding  │──── 依赖 StoreModule
                                    └───────┬─────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          │                 │                 │
                          ▼                 ▼                 ▼
                   ┌────────────┐   ┌──────────────┐   ┌──────────┐
                   │WebhookModule│   │DashboardModule│   │ AiModule │
                   │【P4 新增】   │   │  (扩展)       │   │(重构)    │
                   │            │   │              │   │          │
                   │ 事件订阅者  │   │ + Export     │   │ + Bull   │
                   │ (EventBus) │   │ + CustCare   │   │   Queue  │
                   │            │   │              │   │          │
                   │ 客户事件    │   │ 依赖 Bull    │   │ 依赖     │
                   │ 预约事件    │   │ + PDF生成    │   │ Redis    │
                   │ 报价事件    │   │ + Excel生成  │   └──────────┘
                   │ 活动事件    │   └──────────────┘
                   └────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ VehicleModule │
                   │  (扩展)       │
                   │              │
                   │ + CarPart    │──── 依赖 car_part 表
                   │ + AR Config │──── 依赖 car_model AR 字段
                   └──────────────┘
```

**依赖说明（Phase 4 新增/变更）：**
- **CaseModule（扩展）** 新增 CaseCommentService（依赖敏感词过滤服务）、CaseRankingService（依赖 Redis Sorted Set + case_stats_daily 表）、CaseShareService（依赖微信小程序码 API + OSS）
- **CampaignModule（扩展）** 新增 CampaignApprovalService（依赖 AuditModule 记录审批日志）、CampaignScheduler（依赖 SchedulerModule 定时触发 + DistributedLockService）
- **AiModule（重构）** 新增 AiQueueService（Bull producer）+ AiGenerationProcessor（Bull consumer），依赖 Redis。废弃原 fire-and-forget 模式，保留 Webhook 回调作为备用通道
- **CustomerModule（扩展）** 新增 CustomerMergeService（事务跨表合并）、CustomerMigrationService（批量事务迁移 + 快照）、CustomerCareService（定时扫描生日/纪念日）、StaffBindingService（事件订阅自动绑定）
- **WebhookModule（新增）** 通过 NestJS EventBus 订阅客户/预约/报价/活动事件，根据门店 Webhook 配置推送到企业微信/钉钉
- **SchedulerModule（新增）** 统一管理所有 @Cron 定时任务，通过 DistributedLockService（Redis SETNX）确保多实例互斥
- **DashboardModule（扩展）** 新增 DashboardExportService（异步 Bull 队列生成 PDF/Excel）+ CustomerCare 查询接口
- **QuoteModule（修改）** QuoteService 集成 PartAreaCalculator：优先从 car_part 表获取部件面积，无精确面积时回退全局默认值
- **ConfigurationModule（修改）** 在创建方案时发布 CustomerCreatedEvent + StaffBindingEvent（自动绑定专属销售）
- **VehicleModule（扩展）** 新增 CarPart 实体管理（批更新面积、从模板复制）、AR 配置查询

#### P4.1.3 Phase 4 各模块 Controller + Service + Entity 对应关系

| 模块 | Controllers | Services | Entities (新增) | 数据隔离 |
|------|------------|----------|-----------------|----------|
| **CaseModule** (扩展) | `CaseController` (新增评论/分享端点), `CaseAdminController` (审核端点) | `CaseCommentService`, `CaseShareService`, `CaseRankingService` | `CaseComment`, `CaseStatsDaily` | store_id 多租户 |
| **CampaignModule** (扩展) | `CampaignApprovalController` | `CampaignApprovalService`, `CampaignSchedulerService` | 无新实体 (扩展 campaign 字段) | campaign 跨门店 JSON 字段 |
| **AiModule** (重构) | `AiController` (修改), `AiQueueAdminController` | `AiQueueService`, `AiGenerationProcessor` | 无新实体 (扩展 ai_generation 字段) | store_id 多租户 |
| **CustomerModule** (扩展) | `CustomerController` (新增合并/迁移/分配端点) | `CustomerMergeService`, `CustomerMigrationService`, `CustomerCareService`, `StaffBindingService` | `CustomerSnapshot` | store_id 多租户 |
| **WebhookModule** (新增) | `WebhookController` | `WebhookService`, `WebhookDispatcher` | `WebhookConfig`, `WebhookLog` | store_id 多租户 |
| **SchedulerModule** (新增) | 无 (内部定时任务) | `CampaignScheduler`, `CaseStatsScheduler`, `RankingCacheScheduler`, `CustomerReminderScheduler`, `ExportCleanupScheduler`, `DistributedLockService` | `SchedulerLog`, `NotificationLog` | 全局 + store_id |
| **DashboardModule** (扩展) | `DashboardController` (新增导出端点和 customer-care) | `DashboardExportService`, `ExportProcessor` | `ExportTask` | store_id 多租户 |
| **VehicleModule** (扩展) | `VehicleAdminController` (新增面积管理端点) | `PartAreaService` | `CarPart` | 全局数据 |
| **AuthModule** (扩展) | `AuthController` (新增 sms-login) | `SmsLoginService` | 无新实体 | 无租户 |
| **ConfigurationModule** (修改) | 无新端点 | 事件发布扩展 | 无新实体 | store_id 多租户 |
| **QuoteModule** (修改) | 无新端点 | `QuoteService` 集成 `PartAreaCalculator` | 无新实体 | store_id 多租户 |

---

### P4.2 数据库设计（Phase 4 新增）

#### P4.2.1 实体分类（Phase 4 更新）

| 类别 | 表名 | store_id | 说明 |
|------|------|----------|------|
| **全局数据** | `car_part` | 无 | Phase 4 新增 — 车型部件精确面积 |
| **租户数据** | `case_comment` | 有 | Phase 4 新增 — 案例评论 |
| **租户数据** | `case_stats_daily` | 无 (通过 case_id 间接关联) | Phase 4 新增 — 案例每日互动快照 |
| **审计数据** | `scheduler_log` | 无 | Phase 4 新增 — 定时任务执行日志 |
| **通知数据** | `notification_log` | 有 | Phase 4 新增 — 提醒推送日志 |
| **配置数据** | `webhook_config` | 有 | Phase 4 新增 — 门店 Webhook 配置 |
| **审计数据** | `webhook_log` | 有 | Phase 4 新增 — Webhook 推送日志 |
| **租户数据** | `export_task` | 有 | Phase 4 新增 — 数据导出任务 |
| **备份数据** | `customer_snapshot` | 有 | Phase 4 新增 — 客户迁移快照 |

#### P4.2.2 完整 DDL（Phase 4 新增表）

##### P4.2.2.1 car_part（车型部件精确面积 — 全局数据）

```sql
-- ============================================================
-- car_part: 车型部件面积数据（全局共享，无 store_id）
-- ============================================================
CREATE TABLE `car_part` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model_id`              BIGINT UNSIGNED NOT NULL              COMMENT '关联 car_model.id',
  `part_code`             VARCHAR(20)     NOT NULL              COMMENT '部件编码 (HOOD/ROOF/TRUNK/FL_DOOR/...)',
  `area_m2`               DECIMAL(6,4)    NOT NULL DEFAULT 0    COMMENT '精确面积 (㎡), 0=未录入回退默认值',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_part` (`model_id`, `part_code`),
  INDEX `idx_model_id` (`model_id`),
  INDEX `idx_part_code` (`part_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='车型部件精确面积表';
```

**设计说明**: `area_m2 = 0` 表示该部件未录入精确面积，报价计算时回退到全局默认值。UNIQUE(model_id, part_code) 确保每个车型的每个部件仅有一条面积记录。种子数据覆盖主流车型的 13 种部件面积。

##### P4.2.2.2 case_comment（案例评论 — 多租户）

```sql
-- ============================================================
-- case_comment: 案例评论/回复（支持二级嵌套）
-- ============================================================
CREATE TABLE `case_comment` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id`               BIGINT UNSIGNED NOT NULL              COMMENT '关联 case.id',
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '评论人所属门店',
  `staff_id`              BIGINT UNSIGNED NOT NULL              COMMENT '评论店员 ID',
  `parent_id`             BIGINT UNSIGNED NULL                  COMMENT '父评论 ID (NULL=顶级评论, 非NULL=回复)',
  `content`               VARCHAR(500)     NOT NULL             COMMENT '评论内容 (1-500字)',
  `status`                ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' COMMENT '审核状态',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME        NULL                  COMMENT '软删除',
  PRIMARY KEY (`id`),
  INDEX `idx_case_id` (`case_id`),
  INDEX `idx_parent_id` (`parent_id`),
  INDEX `idx_case_status` (`case_id`, `status`),
  INDEX `idx_store_id` (`store_id`),
  INDEX `idx_staff_id` (`staff_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例评论表';
```

**设计说明**: `parent_id` 自引用实现回复嵌套，应用层限制最多 2 层（顶级评论 + 一级回复）。`status` 默认为 `approved`（无需审核），当系统配置 `comment_require_review=true` 或命中敏感词时设为 `pending`。

##### P4.2.2.3 case_stats_daily（案例每日互动快照）

```sql
-- ============================================================
-- case_stats_daily: 案例每日互动数据快照（排行榜源数据）
-- ============================================================
CREATE TABLE `case_stats_daily` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id`               BIGINT UNSIGNED NOT NULL              COMMENT '关联 case.id',
  `stat_date`             DATE            NOT NULL              COMMENT '统计日期',
  `daily_likes`           INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '当日新增点赞数',
  `daily_views`           INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '当日新增浏览数',
  `daily_comments`        INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '当日新增评论数',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_date` (`case_id`, `stat_date`),
  INDEX `idx_stat_date` (`stat_date`),
  INDEX `idx_case_date_desc` (`case_id`, `stat_date` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例每日互动快照表';
```

**设计说明**: 每日凌晨 1:00 Cron 任务从前一日增量计算并写入。UNIQUE(case_id, stat_date) 确保每天每个案例仅一条记录。排行榜查询通过聚合 `stat_date` 范围内的 daily_* 字段实现。

##### P4.2.2.4 scheduler_log（定时任务执行日志）

```sql
-- ============================================================
-- scheduler_log: 定时任务执行日志（全局运维审计）
-- ============================================================
CREATE TABLE `scheduler_log` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_name`             VARCHAR(100)    NOT NULL              COMMENT '任务名称 (campaign_scheduler/case_stats_scheduler/...)',
  `executed_at`           DATETIME        NOT NULL              COMMENT '执行时间',
  `result`                ENUM('success','partial','failed') NOT NULL COMMENT '执行结果',
  `detail`                TEXT            NULL                  COMMENT '执行详情 (处理记录数, 异常信息)',
  `duration_ms`           INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '执行耗时(毫秒)',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_task_name_time` (`task_name`, `executed_at` DESC),
  INDEX `idx_result` (`result`),
  INDEX `idx_executed_at` (`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务执行日志表';
```

##### P4.2.2.5 notification_log（通知推送日志）

> **架构扩展说明**: 此表不直接对应 Phase 4 需求文档中的具体需求条目，但作为客户关怀推送的审计/追溯基础设施，属于架构层面的合理补充。记录所有定时任务触发的提醒推送（生日、纪念日），便于排查推送遗漏和运营分析。

```sql
-- ============================================================
-- notification_log: 客户关怀提醒推送日志（多租户）
-- ============================================================
CREATE TABLE `notification_log` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `staff_id`              BIGINT UNSIGNED NULL                  COMMENT '接收店员 ID (NULL=门店级别通知)',
  `customer_id`           BIGINT UNSIGNED NOT NULL              COMMENT '关联 customer.id',
  `type`                  ENUM('birthday','anniversary') NOT NULL COMMENT '提醒类型',
  `content`               TEXT            NOT NULL              COMMENT '通知内容',
  `sent_at`               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_store_id` (`store_id`),
  INDEX `idx_customer_id` (`customer_id`),
  INDEX `idx_sent_at` (`sent_at`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户关怀提醒日志表';
```

##### P4.2.2.6 webhook_config（门店 Webhook 配置 — 多租户）

```sql
-- ============================================================
-- webhook_config: 门店 Webhook 配置（每门店每种平台一条记录）
-- ============================================================
CREATE TABLE `webhook_config` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `type`                  ENUM('wecom','dingtalk') NOT NULL COMMENT '平台类型',
  `url`                   VARCHAR(500)    NOT NULL              COMMENT 'Webhook URL (必须HTTPS)',
  `events`                JSON            NOT NULL              COMMENT '订阅事件类型 JSON 数组',
  `status`                TINYINT(1)      NOT NULL DEFAULT 1    COMMENT '1=启用 0=停用',
  `secret`                VARCHAR(128)    NULL                  COMMENT 'HMAC 签名密钥',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME        NULL                  COMMENT '软删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_type` (`store_id`, `type`),
  INDEX `idx_store_id` (`store_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店 Webhook 配置表';
```

**设计说明**: UNIQUE(store_id, type) 确保每个门店每种平台仅一条配置。`events` JSON 字段存储如 `["customer.created","appointment.created","quote.confirmed"]`。`url` 校验必须为 HTTPS 协议，防止 SSRF 攻击。

##### P4.2.2.7 webhook_log（Webhook 推送日志 — 多租户）

```sql
-- ============================================================
-- webhook_log: Webhook 推送日志（审计+重试）
-- ============================================================
CREATE TABLE `webhook_log` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_id`             BIGINT UNSIGNED NOT NULL              COMMENT '关联 webhook_config.id',
  `event`                 VARCHAR(100)    NOT NULL              COMMENT '事件类型 (customer.created/...)',
  `payload`               JSON            NULL                  COMMENT '推送 payload',
  `response_code`         SMALLINT UNSIGNED NULL                COMMENT 'HTTP 响应码',
  `response_body`         TEXT            NULL                  COMMENT 'HTTP 响应体',
  `retry_count`           TINYINT UNSIGNED NOT NULL DEFAULT 0   COMMENT '已重试次数',
  `status`                ENUM('success','failed','retrying') NOT NULL COMMENT '推送状态',
  `error_message`         TEXT            NULL                  COMMENT '异常信息',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_config_id` (`config_id`),
  INDEX `idx_event` (`event`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Webhook 推送日志表';
```

##### P4.2.2.8 export_task（数据导出任务 — 多租户）

```sql
-- ============================================================
-- export_task: 数据看板导出任务（异步 Bull 队列）
-- ============================================================
CREATE TABLE `export_task` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `staff_id`              BIGINT UNSIGNED NOT NULL              COMMENT '导出操作店员 ID',
  `type`                  ENUM('pdf','excel') NOT NULL          COMMENT '导出类型',
  `sections`              JSON            NOT NULL              COMMENT '导出模块列表 JSON ["kpi","trends"]',
  `period`                VARCHAR(20)     NOT NULL              COMMENT '数据周期: daily/weekly/monthly',
  `status`                ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `file_url`              VARCHAR(500)    NULL                  COMMENT '导出文件 OSS URL',
  `error_message`         TEXT            NULL                  COMMENT '失败原因',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at`          DATETIME        NULL                  COMMENT '完成时间',
  `deleted_at`            DATETIME        NULL                  COMMENT '软删除',
  PRIMARY KEY (`id`),
  INDEX `idx_store_id` (`store_id`),
  INDEX `idx_staff_id` (`staff_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据导出任务表';
```

> **状态对齐说明**: `pending` 为导出任务提交后的初始状态（进入 Bull 队列前），`processing` 为 Worker 拾取后的状态，`completed`/`failed` 为终态。此四态设计与异步任务队列标准模式一致。

##### P4.2.2.9 customer_snapshot（客户迁移快照 — 备份数据）

```sql
-- ============================================================
-- customer_snapshot: 客户迁移前完整数据快照（迁移回滚用）
-- ============================================================
CREATE TABLE `customer_snapshot` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id`           BIGINT UNSIGNED NOT NULL              COMMENT '客户 ID',
  `store_id`              BIGINT UNSIGNED NOT NULL              COMMENT '迁移前门店 ID',
  `snapshot_data`         JSON            NOT NULL              COMMENT '完整客户数据 JSON 快照',
  `migration_batch_id`    VARCHAR(36)     NOT NULL              COMMENT '迁移批次 UUID',
  `operator_id`           BIGINT UNSIGNED NOT NULL              COMMENT '操作人 ID',
  `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_customer_id` (`customer_id`),
  INDEX `idx_migration_batch` (`migration_batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户迁移快照表 (备份+审计)';
```

#### P4.2.3 Phase 4 对现有表的 DDL 修改

```sql
-- ============================================================
-- campaign: 新增自动定时 + 审批字段
-- ============================================================
ALTER TABLE `campaign`
  ADD COLUMN `auto_publish`     TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '到达 valid_from 时自动发布' AFTER `updated_at`,
  ADD COLUMN `auto_expire`      TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '到达 valid_to 时自动下架' AFTER `auto_publish`,
  ADD COLUMN `approval_status`  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' COMMENT '审批状态' AFTER `auto_expire`,
  ADD COLUMN `approved_by`      BIGINT UNSIGNED NULL              COMMENT '审批人 staff_id' AFTER `approval_status`,
  ADD COLUMN `approved_at`      DATETIME     NULL                 COMMENT '审批时间' AFTER `approved_by`,
  ADD COLUMN `reject_reason`    VARCHAR(500) NULL                 COMMENT '拒绝原因' AFTER `approved_at`;

-- campaign status 枚举扩展: 新增 'approved' 状态
-- 状态机: draft → pending_approval → approved → active → expired
ALTER TABLE `campaign`
  MODIFY COLUMN `status` ENUM('draft','active','expired','inactive','pending_approval','approved') NOT NULL DEFAULT 'draft';

-- ============================================================
-- customer: 新增生日/纪念日 + 专属销售字段
-- ============================================================
ALTER TABLE `customer`
  ADD COLUMN `birthday`           DATE          NULL              COMMENT '客户生日' AFTER `vehicle_info`,
  ADD COLUMN `anniversary_date`   DATE          NULL              COMMENT '纪念日日期' AFTER `birthday`,
  ADD COLUMN `anniversary_label`  VARCHAR(50)   NULL              COMMENT '纪念日标签(如"首次到店")' AFTER `anniversary_date`,
  ADD COLUMN `wechat_openid`      VARCHAR(100)  NULL              COMMENT '客户微信 openid' AFTER `anniversary_label`,
  ADD COLUMN `assigned_staff_id`  BIGINT UNSIGNED NULL            COMMENT '专属销售店员 ID' AFTER `wechat_openid`;

ALTER TABLE `customer`
  ADD INDEX `idx_assigned_staff` (`assigned_staff_id`),
  ADD INDEX `idx_birthday` (`birthday`),
  ADD INDEX `idx_anniversary` (`anniversary_date`);

-- ============================================================
-- case: 新增分享计数 + 评论计数字段
-- ============================================================
ALTER TABLE `case`
  ADD COLUMN `share_count`    INT UNSIGNED NOT NULL DEFAULT 0    COMMENT '分享次数' AFTER `like_count`,
  ADD COLUMN `comment_count`  INT UNSIGNED NOT NULL DEFAULT 0    COMMENT '已审核评论数' AFTER `share_count`;

-- ============================================================
-- car_model: 新增 AR 预览字段
-- ============================================================
ALTER TABLE `car_model`
  ADD COLUMN `ar_model_url`     VARCHAR(500) NULL              COMMENT 'AR 专用模型 URL (USDZ/glTF)' AFTER `thumbnail_url`,
  ADD COLUMN `vehicle_length`   DECIMAL(5,2) NULL              COMMENT '车长 (米)' AFTER `ar_model_url`,
  ADD COLUMN `vehicle_width`    DECIMAL(5,2) NULL              COMMENT '车宽 (米)' AFTER `vehicle_length`,
  ADD COLUMN `vehicle_height`   DECIMAL(5,2) NULL              COMMENT '车高 (米)' AFTER `vehicle_width`;

-- ============================================================
-- ai_generation: 新增队列追踪字段
-- ============================================================
ALTER TABLE `ai_generation`
  ADD COLUMN `job_id`         VARCHAR(36)   NULL              COMMENT 'Bull 队列 job ID' AFTER `status`,
  ADD COLUMN `queue_position` INT UNSIGNED  NULL              COMMENT '提交时的队列位置' AFTER `job_id`,
  ADD COLUMN `retry_count`    TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '重试次数' AFTER `queue_position`;

-- ai_generation status 枚举扩展: 新增 'queued' 状态
ALTER TABLE `ai_generation`
  MODIFY COLUMN `status` ENUM('pending','queued','processing','completed','failed') NOT NULL DEFAULT 'pending';

-- ============================================================
-- sms_code: type 枚举扩展
-- ============================================================
ALTER TABLE `sms_code`
  MODIFY COLUMN `type` ENUM('login','verify','appointment') NOT NULL;
```

#### P4.2.4 Phase 4 索引设计说明

| 表 | 索引 | 类型 | 查询场景 |
|-----|------|------|----------|
| `case_comment` | `idx_case_status (case_id, status)` | 联合索引 | 查询某案例的已审核评论列表 (WHERE case_id=? AND status='approved' AND deleted_at IS NULL) |
| `case_comment` | `idx_parent_id` | 单列索引 | 查询某评论的所有回复 (WHERE parent_id=?) |
| `case_comment` | `idx_store_id` | 单列索引 | 门店级评论管理 (WHERE store_id=?) |
| `case_stats_daily` | `uk_case_date (case_id, stat_date) UNIQUE` | 唯一索引 | 防止同一天同一案例重复统计 |
| `case_stats_daily` | `idx_stat_date` | 单列索引 | 排行榜周期查询 (WHERE stat_date BETWEEN ? AND ?) |
| `scheduler_log` | `idx_task_name_time (task_name, executed_at DESC)` | 联合索引 | 按任务名查询执行历史 |
| `webhook_config` | `uk_store_type (store_id, type) UNIQUE` | 唯一索引 | 每门店每种平台仅一条配置 |
| `webhook_log` | `idx_config_id` | 单列索引 | 按配置查询推送历史 |
| `export_task` | `idx_store_id` + `idx_status` | 单列索引 | 门店导出任务查询 + 清除已完成任务 |
| `customer` | `idx_assigned_staff` | 单列索引 | 店员查询自己的客户列表 (WHERE assigned_staff_id=?) |
| `customer` | `idx_birthday` + `idx_anniversary` | 单列索引 | 生日/纪念日定时扫描 |
| `car_part` | `uk_model_part (model_id, part_code) UNIQUE` | 唯一索引 | 车型+部件面积唯一，防止重复录入 |
| `campaign` | 新增 `idx_approval_status` | 单列索引 | 待审批活动查询 |

---

### P4.3 API 设计（Phase 4 新增/变更）

#### P4.3.1 案例评论

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/cases/:id/comments` | Public | 案例评论列表 (分页, ?page=1&size=20, 仅返回 approved) |
| POST | `/api/v1/cases/:id/comments` | JWT | 发表评论 (content 1-500字, parent_id 可选, 30秒频控) |
| DELETE | `/api/v1/cases/:id/comments/:commentId` | JWT | 删除评论 (作者本人或 manager+, 软删除) |
| GET | `/api/v1/admin/comments/pending` | JWT (admin) | 待审核评论列表 (分页) |
| PUT | `/api/v1/admin/comments/:id/approve` | JWT (admin) | 审核评论 (action: approve/reject) |

**CreateCommentDto**:

```typescript
class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(500)
  content: string;

  @IsOptional() @IsInt() @Min(1)
  parent_id?: number;  // 回复某条评论, 最多2层嵌套
}
```

**评论列表响应格式**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "content": "这个哑光黑效果太赞了！",
        "staff_name": "张三",
        "staff_avatar": "https://oss.wraplab.com/avatars/1.jpg",
        "is_author": true,
        "created_at": "2026-07-22T10:30:00Z",
        "replies": [
          {
            "id": 2,
            "content": "同意！我也很喜欢",
            "staff_name": "李四",
            "staff_avatar": null,
            "is_author": false,
            "created_at": "2026-07-22T10:35:00Z"
          }
        ]
      }
    ],
    "total": 15,
    "page": 1,
    "size": 20
  }
}
```

**评论频控**: Redis key `comment_rate:{staff_id}:{case_id}`，TTL=30s，SETNX 实现。

#### P4.3.2 案例排行榜

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/cases/ranking` | Public | 热门排行榜 (?type=like_count\|view_count\|comment_count&period=daily\|weekly\|monthly&limit=20) |

**QueryCaseRankingDto**:

```typescript
class QueryCaseRankingDto {
  @IsEnum(['like_count', 'view_count', 'comment_count'])
  type: 'like_count' | 'view_count' | 'comment_count';

  @IsEnum(['daily', 'weekly', 'monthly'])
  period: 'daily' | 'weekly' | 'monthly';

  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}
```

**周期定义**:
- daily: 昨日 00:00:00 ~ 昨日 23:59:59
- weekly: 本周一 00:00:00 ~ 当前时间
- monthly: 本月 1 日 00:00:00 ~ 当前时间

**缓存策略**: Redis Sorted Set，key 格式 `case_ranking:{type}:{period}`，TTL=10min。Cron 每小时重建。

#### P4.3.3 案例分享

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/cases/:id/share-card` | JWT | 生成分享卡片数据 (封面图 + 小程序码) |
| POST | `/api/v1/cases/:id/share` | JWT | 记录分享行为 (platform: wechat_friend\|wechat_moment, 原子自增 share_count) |

**ShareCard 响应**:
```json
{
  "case_id": 1,
  "title": "宝马 3系 / AX 哑光灰",
  "cover_image_url": "https://oss.wraplab.com/cases/1/cover.jpg",
  "summary": "宝马 3系 | AX 哑光灰 | 全车 8件",
  "wxa_code_url": "https://oss.wraplab.com/wxacode/case_1_sid_10.png",
  "store_name": "驰享车衣·朝阳店"
}
```

**小程序码生成**: 调用微信 `wxacode.getUnlimited`，参数 `scene=case_{id}_sid_{staff_id}`，缓存 30 天 (Redis key `wxacode:case:{id}:{staff_id:?}`)

#### P4.3.4 活动审批 + 定时发布

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/campaigns/approvals` | JWT (admin) | 待审批活动列表 (?creator_store_id=&status=pending&page=&size=) |
| PUT | `/api/v1/admin/campaigns/:id/approve` | JWT (admin) | 审批活动 (action: approve/reject, reject_reason?) |
| GET | `/api/v1/admin/campaigns/my` | JWT (manager+) | 我创建的活动列表 (?approval_status=pending\|approved\|rejected) |

**审批 DTO**:
```typescript
class ApproveCampaignDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional() @IsString() @MaxLength(500)
  reject_reason?: string;
}
```

**活动状态机**:
```
draft → pending_approval (manager 提交)
pending_approval → approved (admin approve, valid_from > NOW)
pending_approval → active (admin approve, valid_from <= NOW)
pending_approval → (rejected) (admin reject, 状态保持)
approved → active (定时任务: NOW >= valid_from && auto_publish=true)
active → expired (定时任务: NOW > valid_to && auto_expire=true)
```

**定时任务配置** (`CampaignScheduler`):
- Cron 表达式: `*/1 * * * *` (每分钟)
- 分布式锁: Redis SETNX `lock:campaign_scheduler`, TTL=120s
- 环境变量控制: `ENABLE_CAMPAIGN_SCHEDULER=true`

#### P4.3.5 CRM 增强 — 客户合并/迁移/分配/关怀

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/admin/customers/merge` | JWT (admin) | 客户合并 (primary_id, secondary_ids[]) |
| GET | `/api/v1/admin/customers/duplicates` | JWT (admin) | 检测跨门店重复客户 (?limit=50) |
| POST | `/api/v1/admin/customers/migrate/confirm` | JWT (admin) | 迁移预确认 (返回 confirm_token, 含 from_store_id/to_store_id/customer_ids 摘要) |
| POST | `/api/v1/admin/customers/migrate` | JWT (admin) | 批量客户迁移 (需携带 confirm_token, NFR-170 P0 二次确认) |
| GET | `/api/v1/admin/customers/migration-history` | JWT (admin) | 迁移历史记录 (?page=&size=) |
| PUT | `/api/v1/admin/customers/:id/assign` | JWT (manager+) | 分配专属销售 (Body: { staff_id }) |
| PUT | `/api/v1/admin/customers/:id/unassign` | JWT (manager+) | 取消专属销售 |
| GET | `/api/v1/admin/dashboard/customer-care` | JWT (manager+) | 客户关怀提醒 (?days=3) |

**合并请求 DTO**:
```typescript
class MergeCustomerDto {
  @IsInt() @Min(1)
  primary_id: number;

  @IsArray() @ArrayMinSize(1)
  @IsInt({ each: true }) @Min(1, { each: true })
  secondary_ids: number[];
}
```

**迁移请求 DTO**:
```typescript
class MigrateCustomerDto {
  @IsInt() @Min(1)
  from_store_id: number;

  @IsInt() @Min(1)
  to_store_id: number;

  @IsOptional() @IsArray()
  @IsInt({ each: true }) @Min(1, { each: true })
  customer_ids?: number[];  // 不传则迁移全部

  @IsString() @IsJWT()
  confirm_token: string;    // NFR-170 P0: 迁移预确认 token, 由 POST /migrate/confirm 签发
}
```

#### P4.3.6 CRM Webhook

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/v1/admin/webhook/config` | JWT (manager+) | 配置门店 Webhook (@Throttle(5, 60) 防滥用) |
| GET | `/api/v1/admin/webhook/config` | JWT (manager+) | 查询 Webhook 配置 |
| GET | `/api/v1/admin/webhook/logs` | JWT (manager+) | Webhook 推送日志 (?status=success\|failed&page=&size=) |

**Webhook 配置 DTO**:
```typescript
class UpdateWebhookConfigDto {
  @IsEnum(['wecom', 'dingtalk'])
  type: 'wecom' | 'dingtalk';

  @IsString() @IsUrl({ protocols: ['https'] }) @MaxLength(500)
  url: string;

  @IsBoolean()
  status: boolean;

  @IsArray()
  @IsEnum(['customer.created','customer.birthday','customer.anniversary','appointment.created','appointment.confirmed','quote.confirmed','campaign.claimed'], { each: true })
  events: string[];

  @IsOptional() @IsString() @MaxLength(128)
  secret?: string;
}
```

**Webhook 推送格式（企业微信 Markdown）**:
```markdown
## 客户动态提醒
> 客户：王先生 (138****8000)
> 事件：新客户到店
> 专属销售：小李
> 时间：2026-07-22 14:30
```

#### P4.3.7 AI 队列

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/configurations/:id/generate-image` | JWT | 提交生图任务 (返回 queue_position) |
| GET | `/api/v1/generations/:id/queue-status` | JWT | 查询队列任务状态 |
| GET | `/api/v1/admin/ai-queue/stats` | JWT (admin) | AI 队列统计 |

**POST generate-image 响应（Phase 4 修改）**:
```json
{
  "generation_id": 42,
  "status": "queued",
  "queue_position": 3,
  "estimated_seconds": 90
}
```

**队列配置**:
```typescript
// Bull Queue 配置
const AI_QUEUE_OPTIONS = {
  redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
  defaultJobOptions: {
    attempts: 3,            // 最多重试 3 次
    backoff: { type: 'fixed', delay: 10000 }, // 重试间隔 10s
    timeout: 120000,        // 单任务超时 120s
    removeOnComplete: 100,  // 保留最近 100 个完成记录
    removeOnFail: 200,      // 保留最近 200 个失败记录
  },
  limiter: {
    max: 500,               // 最大等待任务数 (NFR-141)
    duration: 3600000,      // 1 小时内
  },
};
const AI_QUEUE_CONCURRENCY = parseInt(process.env.AI_QUEUE_CONCURRENCY || '3');
```

#### P4.3.8 短信验证码登录

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/send-sms-code` | Public | 发送验证码 (type 扩展: login/appointment) |
| POST | `/api/v1/auth/sms-login` | Public | 验证码登录 (phone + sms_code → JWT) |

**SmsLoginDto**:
```typescript
class SmsLoginDto {
  @IsString() @Matches(/^1[3-9]\d{9}$/)
  phone: string;

  @IsString() @Length(6, 6)
  sms_code: string;
}
```

**登录流程**:
1. 校验 sms_code 有效性 (type='login', 未过期, 未使用, 匹配 phone)
2. 查找 phone 对应店员 → 找到: 签发 JWT (含 store_id/staff_id/role)
3. → 未找到: 返回 `PHONE_NOT_REGISTERED_LOGIN` (4021)
4. 验证码标记 used=true (防重放)
5. 首次登录用户 (无密码): 可选生成随机密码并短信通知 (P1)

#### P4.3.9 预约验证码校验

`CreateAppointmentDto` 新增可选字段:
```typescript
class CreateAppointmentDto {
  // ... 现有字段

  @IsOptional() @IsString() @Length(6, 6)
  sms_code?: string;  // 预约验证码 (type='appointment')
}
```

校验流程: 若传入 sms_code，在创建预约前先校验 (phone + code + type='appointment')，失败返回对应错误码。

#### P4.3.10 部件面积管理

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/v1/admin/vehicles/models/:id/parts/batch` | JWT (admin) | 批更新部件面积 |
| GET | `/api/v1/admin/vehicles/models/:id/parts/area` | JWT (manager+) | 获取面积汇总 |
| POST | `/api/v1/admin/vehicles/models/:id/parts/copy-from/:templateModelId` | JWT (admin) | 从模板车型复制面积 |

**批更新 DTO**:
```typescript
class BatchUpdatePartAreaDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  parts: PartAreaItem[];
}

class PartAreaItem {
  @IsString() @MaxLength(20)
  part_code: string;

  @IsNumber() @Min(0) @Max(99.99)
  area_m2: number;
}
```

#### P4.3.11 Dashboard 导出

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/admin/dashboard/export/pdf` | JWT (manager+) | 导出 PDF (异步) |
| POST | `/api/v1/admin/dashboard/export/excel` | JWT (manager+) | 导出 Excel (异步) |
| GET | `/api/v1/admin/dashboard/exports/:id` | JWT (manager+) | 查询导出状态 + 下载 URL |

**Export DTO**:
```typescript
class DashboardExportDto {
  @IsArray()
  @IsEnum(['kpi','trends','top_rankings','staff_performance'], { each: true })
  sections: string[];

  @IsEnum(['daily','weekly','monthly'])
  period: string;

  @IsOptional() @IsDateString()
  date?: string;
}
```

**导出频率限制**: 同一门店 5 分钟内最多 1 次 (Redis key `export_rate:{store_id}`, TTL=300s)

#### P4.3.12 AR 预览

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/vehicles/models/:id/ar-config` | JWT | 车型 AR 配置 (ar_model_url, dimensions) |
| GET | `/api/v1/configurations/:id/ar-texture` | JWT | 方案 AR 贴图数据 (颜色 hex + 材质参数) |

**AR Config 响应**:
```json
{
  "model_id": 10,
  "ar_model_url": "https://oss.wraplab.com/ar/models/bmw_3series.usdz",
  "dimensions": {
    "length_m": 4.72,
    "width_m": 1.83,
    "height_m": 1.44
  },
  "tracking_type": "plane_detection"
}
```

---

### P4.4 关键数据流设计

#### P4.4.1 案例评论审核流

```
Client (店员)              CaseController       CaseCommentService     SensitiveWordFilter     DB
     │                          │                      │                      │                 │
     │ POST /cases/:id/comments │                      │                      │                 │
     │ { content, parent_id? }  │                      │                      │                 │
     │─────────────────────────►│                      │                      │                 │
     │                          │ create(dto, staff)   │                      │                 │
     │                          │─────────────────────►│                      │                 │
     │                          │                      │                      │                 │
     │                          │                      │ 1. 频控检查:           │                 │
     │                          │                      │    Redis SETNX         │                 │
     │                          │                      │    key=rate:{sid}:{cid}│                 │
     │                          │                      │──────────────────────►│                 │
     │                          │                      │◄──── OK/REJECTED ─────│                 │
     │                          │                      │ (超频 → 429 4028)     │                 │
     │                          │                      │                      │                 │
     │                          │                      │ 2. 敏感词过滤:         │                 │
     │                          │                      │    check(content)      │                 │
     │                          │                      │──────────────────────►│                 │
     │                          │                      │◄── { has_sensitive } ─│                 │
     │                          │                      │                      │                 │
     │                          │                      │ 3. 确定 status:       │                 │
     │                          │                      │    命中敏感词 → pending│                 │
     │                          │                      │    require_review →   │                 │
     │                          │                      │      pending          │                 │
     │                          │                      │    否则 → approved    │                 │
     │                          │                      │                      │                 │
     │                          │                      │ INSERT case_comment   │                 │
     │                          │                      │ (content, status,     │                 │
     │                          │                      │  store_id, staff_id,   │                 │
     │                          │                      │  parent_id)            │                 │
     │                          │                      │──────────────────────────────────────────►│
     │                          │                      │                      │                 │
     │                          │                      │ 4. 更新 case 评论计数  │                 │
     │                          │                      │ (若 approved)          │                 │
     │                          │                      │ UPDATE case SET        │                 │
     │                          │                      │   comment_count+1      │                 │
     │                          │                      │──────────────────────────────────────────►│
     │                          │                      │                      │                 │
     │ { id, status, ... }      │                      │                      │                 │
     │◄─────────────────────────│                      │                      │                 │
```

#### P4.4.2 排行榜数据流 (Cron + Redis Cache)

```
每日凌晨 01:00
     │
     ▼
CaseStatsScheduler @Cron('0 1 * * *')
     │
     │ 1. Redis SETNX lock:case_stats_scheduler (TTL=300s) — 分布式锁
     │
     ▼
     │ 2. 聚合前一日数据:
     │    INSERT INTO case_stats_daily (case_id, stat_date, daily_likes, daily_views, daily_comments)
     │    SELECT case_id, CURDATE()-1,
     │           COUNT(DISTINCT like_id WHERE created_at BETWEEN yesterday_start AND yesterday_end),
     │           SUM(view_delta),
     │           COUNT(DISTINCT comment_id WHERE created_at BETWEEN yesterday_start AND yesterday_end)
     │    FROM ...
     │
     ▼
RankingCacheScheduler @Cron('0 * * * *')  — 每小时
     │
     │ 3. 重建 Redis Sorted Set:
     │    For period in [daily, weekly, monthly]:
     │      ZADD case_ranking:like_count:daily  <score> <case_id>
     │      ZADD case_ranking:view_count:daily  <score> <case_id>
     │      ...
     │    EXPIRE each key 3600 (1h TTL, 下次 Cron 重建)
     │
     ▼
Client GET /cases/ranking?type=like_count&period=daily&limit=20
     │
     │ 4. 读缓存优先:
     │    ZREVRANGE case_ranking:like_count:daily 0 19 WITHSCORES
     │    (cache miss → 实时聚合 case_stats_daily → 写入缓存)
     │
     ▼
     │ 5. 通过 case_id 批量查询 case 基本信息
     │    (title, cover_image_url, like_count, view_count)
     │
     ▼
     [{ rank:1, case_id, title, cover_image_url, like_count, ... }, ...]
```

#### P4.4.3 客户合并事务流

```
AdminController          CustomerMergeService              DB
     │                          │                           │
     │ POST /admin/customers/  │                           │
     │   merge                  │                           │
     │ { primary_id,            │                           │
     │   secondary_ids }        │                           │
     │─────────────────────────►│                           │
     │                          │                           │
     │                          │ START TRANSACTION         │
     │                          │──────────────────────────►│
     │                          │                           │
     │                          │ 1. Validate:              │
     │                          │    - primary 存在未删除   │
     │                          │    - secondary 存在未删除 │
     │                          │    - phone 冲突检测        │
     │                          │                           │
     │                          │ 2. Merge fields:          │
     │                          │    UPDATE customer SET    │
     │                          │      name = COALESCE(     │
     │                          │        p.name, s.name),   │
     │                          │      tags = UNION(p.tags, │
     │                          │        s.tags),           │
     │                          │      total_visits =       │
     │                          │        p.total_visits +   │
     │                          │        s.total_visits,    │
     │                          │      total_orders = ...   │
     │                          │    WHERE id = primary_id  │
     │                          │──────────────────────────►│
     │                          │                           │
     │                          │ 3. Transfer relations:    │
     │                          │    UPDATE configuration   │
     │                          │    SET store_id = p.store │
     │                          │    WHERE store_id = s.id  │
     │                          │──────────────────────────►│
     │                          │                           │
     │                          │    UPDATE quote           │
     │                          │    SET store_id = p.store │
     │                          │    WHERE store_id = s.id  │
     │                          │──────────────────────────►│
     │                          │                           │
     │                          │ 4. Soft-delete secondary: │
     │                          │    UPDATE customer SET    │
     │                          │    deleted_at = NOW()     │
     │                          │    WHERE id IN (s_ids)    │
     │                          │──────────────────────────►│
     │                          │                           │
     │                          │ 5. Audit log              │
     │                          │    INSERT audit_log       │
     │                          │──────────────────────────►│
     │                          │                           │
     │                          │ COMMIT                    │
     │                          │──────────────────────────►│
     │                          │                           │
     │ { merged: true,           │                           │
     │   primary_id: 1 }        │                           │
     │◄─────────────────────────│                           │
```

#### P4.4.4 AI 队列任务流转 (Bull Queue)

```
Client               AiController      AiQueueService   Redis(Bull)   AiGenerationProcessor   AiProvider    DB
  │                       │                  │               │                │                │            │
  │ POST generate-image   │                  │               │                │                │            │
  │──────────────────────►│                  │               │                │                │            │
  │                       │ addJob(dto)      │               │                │                │            │
  │                       │─────────────────►│               │                │                │            │
  │                       │                  │               │                │                │            │
  │                       │                  │ 1. 日限额检查  │                │                │            │
  │                       │                  │ COUNT ai_gen  │                │                │            │
  │                       │                  │──────────────────────────────────────────────────────────►│
  │                       │                  │◄─ count ─────────────────────────────────────────────────│
  │                       │                  │ (超限 → 4020) │                │                │            │
  │                       │                  │               │                │                │            │
  │                       │                  │ 2. 队列容量检查│                │                │            │
  │                       │                  │   LLEN queue  │                │                │            │
  │                       │                  │──────────────►│                │                │            │
  │                       │                  │◄─ waiting ───│                │                │            │
  │                       │                  │ (>=500 → 4027)│                │                │            │
  │                       │                  │               │                │                │            │
  │                       │                  │ 3. INSERT ai_gen (status=queued)                       │            │
  │                       │                  │──────────────────────────────────────────────────────────►│
  │                       │                  │               │                │                │            │
  │                       │                  │ 4. Bull.add() │                │                │            │
  │                       │                  │──────────────►│                │                │            │
  │                       │                  │◄─ jobId ─────│                │                │            │
  │                       │                  │               │                │                │            │
  │ { id, queued, pos }  │                  │               │                │                │            │
  │◄──────────────────────│                  │               │                │                │            │
  │                       │                  │               │                │                │            │
  │                       │                  │               │ ── dequeue ──►│                │            │
  │                       │                  │               │               │                │            │
  │                       │                  │               │               │ 1. UPDATE       │            │
  │                       │                  │               │               │    status=      │            │
  │                       │                  │               │               │    processing   │───────────►│
  │                       │                  │               │               │                │            │
  │                       │                  │               │               │ 2. generateImage│            │
  │                       │                  │               │               │────────────────►│            │
  │                       │                  │               │               │◄─ result ──────│            │
  │                       │                  │               │               │                │            │
  │                       │                  │               │               │ 3. UPDATE       │            │
  │                       │                  │               │               │    status=      │            │
  │                       │                  │               │               │    completed,   │───────────►│
  │                       │                  │               │               │    result_url   │            │
  │                       │                  │               │               │                │            │
  │                       │                  │               │               │ [失败: retry x3]│            │
  │                       │                  │               │               │ [耗尽: status=  │            │
  │                       │                  │               │               │  failed,        │            │
  │                       │                  │               │               │  error_msg]     │            │
```

#### P4.4.5 Webhook 事件分发流

```
Business Event (EventBus)
  customer.created
  appointment.created
  quote.confirmed
  campaign.claimed
     │
     ▼
WebhookDispatcher (EventSubscriber)
     │
     │ 1. 查询 webhook_config:
     │    WHERE store_id = event.store_id
     │      AND status = 1
     │      AND JSON_CONTAINS(events, '"customer.created"')
     │
     ▼
     │ 2. 遍历匹配的 config:
     │    for config in matchedConfigs:
     │
     │      3. 构建消息 payload (根据 platform):
     │         wecom:    { msgtype: 'markdown', markdown: { content: '...' } }
     │         dingtalk:   { msgtype: 'markdown', markdown: { title: '...', text: '...' } }
     │
     │      4. 生成 HMAC 签名 (若配置了 secret):
     │         timestamp = NOW()
     │         sign = HMAC-SHA256(secret, timestamp + '\n' + JSON.stringify(payload))
     │
     │      5. HTTP POST webhook_url
     │         Headers: X-WrapLab-Signature, X-WrapLab-Timestamp
     │
     ├── success (2xx):
     │      INSERT webhook_log (status='success')
     │
     └── failure (非2xx/超时):
            INSERT webhook_log (status='failed')
            retryQueue.add({ config_id, event, payload }, { 
              attempts: 3, 
              backoff: { type: 'exponential', delay: 5000 }
            })
```

#### P4.4.6 精确面积报价计算流

```
QuoteService.calculatePrice(configurationId)
     │
     │ 1. 加载方案的所有 part_color 记录
     │    SELECT pc.part_code, pc.color_swatch_id, pc.material_id
     │    FROM part_color pc
     │    WHERE pc.configuration_id = ?
     │      AND pc.deleted_at IS NULL
     │
     ▼
     │ 2. 对每个 part_code 获取面积:
     │    FOR EACH part_color:
     │
     │      area = PartAreaCalculator.getArea(model_id, part_code)
     │              │
     │              ├── SELECT area_m2 FROM car_part
     │              │   WHERE model_id = ? AND part_code = ?
     │              │
     │              ├── area_m2 > 0 → 使用精确面积 ✅
     │              │
     │              └── area_m2 = 0 (或记录不存在) → 回退全局默认值:
     │                  FULL → 15.0 m²
     │                  HOOD → 1.5 m²
     │                  ROOF → 2.0 m²
     │                  DOOR → 1.2 m² × 4 (总计 4.8)
     │                  FENDER → 0.8 m² × 2 (总计 1.6)
     │                  TRUNK → 1.5 m²
     │                  BUMPER_F → 1.5 m²
     │                  BUMPER_R → 1.5 m²
     │                  MIRROR → 0.1 m² × 2 (总计 0.2)
     │
     ▼
     │ 3. 计算单价:
     │    price_per_m2 = color_swatch.price_per_m2
     │    multiplier = material.price_multiplier
     │
     │ 4. 部件价格 = area × price_per_m2 × multiplier
     │    所有价格使用 decimal(10,2) 精度
     │
     ▼
     │ 5. 总价 = Σ(所有部件价格)
     │    精确到小数点后 2 位 (ROUND_HALF_UP)
     │
     ▼
     返回 { total_price, part_details: [...] }
```

---

### P4.5 消息队列体系 (Bull + Redis)

#### P4.5.1 队列定义

| 队列名称 | 用途 | 并发数 | 超时 | 最大等待 | 重试 |
|----------|------|--------|------|----------|------|
| `ai-generation` | AI 生图任务 (默认优先级) | 3 | 120s | 500 | 3次/间隔10s |
| `ai-generation-priority` | AI 生图任务 (VIP 高优先级) | 1 | 120s | 100 | 3次/间隔10s |
| `dashboard-export` | Dashboard PDF/Excel 导出 | 2 | 300s | 50 | 2次/间隔30s |
| `webhook-retry` | Webhook 推送失败重试 | 5 | 30s | 200 | 3次/指数退避5s |

#### P4.5.2 Bull 配置

```typescript
// bull.config.ts
import Bull from 'bull';

export const AI_GENERATION_QUEUE = 'ai-generation';
export const AI_GENERATION_PRIORITY_QUEUE = 'ai-generation-priority';
export const DASHBOARD_EXPORT_QUEUE = 'dashboard-export';
export const WEBHOOK_RETRY_QUEUE = 'webhook-retry';

export const QueueConfig: Record<string, Bull.QueueOptions> = {
  [AI_GENERATION_QUEUE]: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 10000 },
      timeout: 120000,
      removeOnComplete: 100,
      removeOnFail: 200,
    },
    limiter: {
      max: 500,
      duration: 3600000,
    },
  },
  [DASHBOARD_EXPORT_QUEUE]: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 30000 },
      timeout: 300000,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  },
  [WEBHOOK_RETRY_QUEUE]: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      timeout: 30000,
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  },
  [AI_GENERATION_PRIORITY_QUEUE]: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 10000 },
      timeout: 120000,
      removeOnComplete: 100,
      removeOnFail: 200,
      priority: 1,  // 高优先级, Bull 优先调度
    },
    limiter: {
      max: 100,
      duration: 3600000,
    },
  },
};
```

---

### P4.6 定时任务体系 (Cron + Distributed Lock)

#### P4.6.1 任务清单

| 任务名称 | Cron 表达式 | 分布式锁 | 描述 |
|----------|------------|----------|------|
| `campaign_scheduler` | `*/1 * * * *` | `lock:campaign_scheduler` (TTL=120s) | 活动定时上下架 (auto_publish/auto_expire) |
| `case_stats_daily` | `0 1 * * *` | `lock:case_stats_daily` (TTL=600s) | 每日案例统计快照写入 case_stats_daily |
| `ranking_cache_rebuild` | `0 * * * *` | `lock:ranking_cache` (TTL=300s) | 每小时重建排行榜 Redis 缓存 |
| `customer_reminder` | `0 8 * * *` | `lock:customer_reminder` (TTL=600s) | 每日 8:00 扫描生日/纪念日提醒 |
| `sms_cleanup` | `0 3 * * *` | `lock:sms_cleanup` (TTL=300s) | 凌晨 3:00 清理过期验证码 |
| `export_cleanup` | `0 4 * * *` | `lock:export_cleanup` (TTL=300s) | 凌晨 4:00 清理 7 天前的导出文件 |

#### P4.6.2 分布式锁实现

```typescript
// distributed-lock.service.ts
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class DistributedLockService {
  constructor(private readonly redis: Redis) {}

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(
      key,
      process.env.HOSTNAME || 'unknown',
      'EX', ttlSeconds,
      'NX'
    );
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    // Lua 脚本: 仅当锁属于当前实例时才释放, 防止误删其他实例的锁
    const instanceId = process.env.HOSTNAME || 'unknown';
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end`;
    await this.redis.eval(script, 1, key, instanceId);
  }

  async withLock<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const acquired = await this.acquireLock(key, ttlSeconds);
    if (!acquired) {
      return null; // 其他实例正在执行
    }
    try {
      return await fn();
    } finally {
      await this.releaseLock(key);
    }
  }
}
```

**Scheduler 使用模式**:
```typescript
@Cron('*/1 * * * *')
async handleCampaignSchedule() {
  const result = await this.lockService.withLock(
    'lock:campaign_scheduler',
    120,
    () => this.campaignSchedulerService.process(),
  );
  if (result === null) {
    this.logger.debug('Campaign scheduler skipped (another instance is running)');
  }
}
```

---

### P4.7 敏感词过滤服务

```typescript
// interfaces/sensitive-word-filter.interface.ts
export interface ISensitiveWordFilter {
  /**
   * 检测文本是否包含敏感词
   * @returns { hasSensitive: boolean, matchedWords: string[] }
   */
  check(text: string): Promise<{ hasSensitive: boolean; matchedWords: string[] }>;
}

// adapters/local-sensitive-word.filter.ts
@Injectable()
export class LocalSensitiveWordFilter implements ISensitiveWordFilter {
  private trie: Map<string, any> = new Map();

  async onModuleInit() {
    // 从 OSS 加载敏感词库 (支持热更新)
    await this.loadDictionary();
  }

  async check(text: string): Promise<{ hasSensitive: boolean; matchedWords: string[] }> {
    const matched: string[] = [];
    // DFA (Deterministic Finite Automaton) 算法匹配
    // 检测延迟 < 10ms (本地词库)
    return { hasSensitive: matched.length > 0, matchedWords: matched };
  }

  private async loadDictionary(): Promise<void> {
    // 默认从 OSS 加载: https://oss.wraplab.com/config/sensitive-words.json
    // 每 30 分钟定时刷新 (通过 SchedulerModule)
  }
}
```

**配置切换**: 通过环境变量 `SENSITIVE_WORD_PROVIDER=local|aliyun` 控制使用本地词库还是阿里云内容安全 API。

---

### P4.8 事件订阅体系（Phase 4 新增/扩展）

| 事件 | 发布方 | 订阅方 | Phase 4 行为 |
|------|--------|--------|-------------|
| `ConfigurationCreatedEvent` | ConfigurationModule | CustomerSyncSubscriber | Phase 3 已有 — 自动创建客户 |
| `ConfigurationCreatedEvent` | ConfigurationModule | StaffBindingSubscriber | 【P4 新增】自动绑定专属销售 |
| `CustomerCreatedEvent` | CustomerModule | WebhookDispatcher | 【P4 新增】推送 Webhook |
| `AppointmentCreatedEvent` | AppointmentModule | WebhookDispatcher | 【P4 新增】推送 Webhook |
| `AppointmentConfirmedEvent` | AppointmentModule | WebhookDispatcher | 【P4 新增】推送 Webhook |
| `QuoteConfirmedEvent` | QuoteModule | WebhookDispatcher | 【P4 新增】推送 Webhook |
| `CampaignClaimedEvent` | CampaignModule | WebhookDispatcher | 【P4 新增】推送 Webhook |
| `CustomerBirthdayEvent` | CustomerReminderScheduler | WebhookDispatcher | 【P4 新增】生日提醒 → Webhook |
| `CustomerAnniversaryEvent` | CustomerReminderScheduler | WebhookDispatcher | 【P4 新增】纪念日提醒 → Webhook |

**StaffBindingSubscriber 实现**:
```typescript
@Injectable()
export class StaffBindingSubscriber {
  constructor(private readonly staffBindingService: StaffBindingService) {}

  @OnEvent('configuration.created')
  async handleConfigurationCreated(event: ConfigurationCreatedEvent) {
    if (!event.customerPhone) return;

    await this.staffBindingService.autoBindIfNeeded(
      event.storeId,
      event.customerPhone,
      event.staffId
    );
  }
}
```

---

### P4.9 自适应退变策略

| 场景 | 降级策略 | 监控指标 |
|------|----------|----------|
| Redis 不可用 (Bull 队列) | AI 生图回退到同步调用 (Phase 2 模式); 排行榜回退到直接查 case_stats_daily | Redis 连接状态 |
| Redis 不可用 (分布式锁) | @Cron 任务跳过锁检查直接执行 (记录 WARN 日志) | Redis 连接状态 |
| 敏感词过滤服务异常 | 评论自动设为 `pending` 状态 (保守策略，不放过) | 过滤服务调用耗时/失败率 |
| 微信小程序码 API 不可用 | share-card 返回无小程序码 (记录 ERROR 日志) | 微信 API 调用失败率 |
| AI 队列满载 (waiting>=500) | 返回 429 AI_QUEUE_FULL，客户端提示稍后重试 | 队列深度 (waiting/active) |
| Webhook URL 连续失败 | 连续失败 3 次后自动禁用该配置 (send notification to manager) | Webhook 失败率 |
| PDF 生成超时 | 导出任务标记 failed，记录 error_message | 导出任务耗时/失败率 |
| 评论频控 Redis 不可用 | 临时放行 (记录 WARN, 但需监控防止刷评论) | Redis 连接状态 |

---

### P4.10 错误码体系（Phase 4 新增）

在现有错误码枚举中新增以下错误码：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| **认证/短信 (10xx)** | | | | |
| 1012 | `SMS_CODE_WRONG` | 400 | 验证码错误，请重新输入 | 验证码不匹配 |
| 1013 | `PHONE_NOT_REGISTERED` | 400 | 该手机号未注册，请联系店长创建账号 | 发送验证码时手机号未注册为店员 |
| 1014 | `SMS_CODE_EXPIRED` | 400 | 验证码已过期，请重新获取 | 验证码超 5 分钟 |
| 1015 | `SMS_CODE_USED` | 400 | 验证码已使用 | 验证码已消费 |
| **资源 (30xx)** | | | | |
| 3020 | `COMMENT_NOT_FOUND` | 404 | 评论不存在 | 评论 ID 不存在或已删除 |
| 3021 | `COMMENT_PERMISSION_DENIED` | 403 | 无权删除此评论 | 非作者且非 manager |
| **业务 (40xx)** | | | | |
| 4020 | `AI_GENERATION_LIMIT_EXCEEDED` | 429 | 本日 AI 生图次数已用完，请明日再试 | 每日限额 |
| 4021 | `PHONE_NOT_REGISTERED_LOGIN` | 400 | 该手机号未注册 | 短信登录时手机号未注册 |
| 4022 | `COMMENT_CONTENT_TOO_LONG` | 400 | 评论内容不能超过 500 字 | 字数超限 |
| 4023 | `MERGE_INVALID_PRIMARY` | 400 | 主客户 ID 不存在或已删除 | 合并 primary 无效 |
| 4024 | `STAFF_NOT_IN_STORE` | 400 | 店员不属于本门店 | 分配专属销售校验 |
| 4025 | `EXPORT_RATE_LIMITED` | 429 | 导出请求过于频繁，请 5 分钟后再试 | 导出频率限制 |
| 4026 | `CAMPAIGN_APPROVAL_REQUIRED` | 400 | 活动需审批通过后方可生效 | 未审批活动操作 |
| 4027 | `AI_QUEUE_FULL` | 429 | AI 生图队列已满，请稍后再试 | 队列等待 >= 500 |
| 4028 | `COMMENT_RATE_LIMITED` | 429 | 评论过于频繁，请 30 秒后再试 | 评论频控 |
| 4029 | `WEBHOOK_URL_INVALID` | 400 | Webhook URL 必须使用 HTTPS 协议 | URL 格式校验 |
| **服务端 (50xx)** | | | | |
| 5007 | `PDF_GENERATION_FAILED` | 500 | PDF 生成失败，请重试 | PDF 导出异常 |

**TypeScript 枚举定义**:
```typescript
// error-codes.enum.ts (Phase 4 追加部分)
export enum ErrorCode {
  // ... Phase 1/2/3 codes ...

  // ============ Phase 4 — SMS (1012-1015) ============
  SMS_CODE_WRONG           = 1012,
  PHONE_NOT_REGISTERED     = 1013,
  SMS_CODE_EXPIRED         = 1014,
  SMS_CODE_USED            = 1015,

  // ============ Phase 4 — Resource (3020-3021) ============
  COMMENT_NOT_FOUND        = 3020,
  COMMENT_PERMISSION_DENIED = 3021,

  // ============ Phase 4 — Business (4020-4029) ============
  AI_GENERATION_LIMIT_EXCEEDED = 4020,
  PHONE_NOT_REGISTERED_LOGIN   = 4021,
  COMMENT_CONTENT_TOO_LONG     = 4022,
  MERGE_INVALID_PRIMARY        = 4023,
  STAFF_NOT_IN_STORE           = 4024,
  EXPORT_RATE_LIMITED          = 4025,
  CAMPAIGN_APPROVAL_REQUIRED   = 4026,
  AI_QUEUE_FULL                = 4027,
  COMMENT_RATE_LIMITED         = 4028,
  WEBHOOK_URL_INVALID          = 4029,

  // ============ Phase 4 — Server (5007) ============
  PDF_GENERATION_FAILED  = 5007,
}
```

---

### P4.11 配置管理（Phase 4 新增环境变量）

```bash
# ==================== Phase 4 新增 — AI 队列 ====================
AI_QUEUE_CONCURRENCY=3                    # AI 生图并发数
AI_QUEUE_MAX_WAITING=500                  # 最大等待任务数
AI_QUEUE_WORKER_COUNT=1                   # Worker 进程数
AI_GENERATION_TIMEOUT_MS=120000           # 单任务超时 (ms)
AI_DAILY_GENERATION_LIMIT=20              # 每门店每日生图次数上限

# ==================== Phase 4 新增 — 定时任务 ====================
ENABLE_CAMPAIGN_SCHEDULER=true            # 活动定时任务开关 (多实例仅一个开)
ENABLE_CASE_STATS_SCHEDULER=true          # 案例统计定时任务开关
ENABLE_RANKING_CACHE_SCHEDULER=true       # 排行榜缓存定时任务开关
ENABLE_CUSTOMER_REMINDER=true             # 客户关怀提醒开关
ENABLE_EXPORT_CLEANUP=true                # 导出文件清理开关

# ==================== Phase 4 新增 — 评论 ====================
COMMENT_MAX_LENGTH=500                    # 评论最大字数
COMMENT_RATE_LIMIT_SECONDS=30             # 评论频控间隔 (秒)
COMMENT_REQUIRE_REVIEW=false              # 评论是否需要审核 (默认 false)
SENSITIVE_WORD_PROVIDER=local             # 敏感词服务: local | aliyun
SENSITIVE_WORD_DICT_URL=https://oss.wraplab.com/config/sensitive-words.json

# ==================== Phase 4 新增 — Webhook ====================
WEBHOOK_RETRY_MAX=3                       # Webhook 最大重试次数
WEBHOOK_TIMEOUT_MS=10000                  # Webhook 请求超时 (ms)
WEBHOOK_MAX_FAILURES_BEFORE_DISABLE=3     # 连续失败 N 次后自动禁用

# ==================== Phase 4 新增 — 导出 ====================
EXPORT_RATE_LIMIT_SECONDS=300             # 同门店导出间隔 (秒)
EXPORT_FILE_RETENTION_DAYS=7              # 导出文件 OSS 保留天数

# ==================== Phase 4 新增 — 分享 ====================
WECHAT_APP_ID=                            # 微信 AppID (小程序码生成)
WECHAT_APP_SECRET=                        # 微信 AppSecret
WXACODE_CACHE_TTL=2592000                 # 小程序码缓存 30 天 (秒)

# ==================== Phase 4 新增 — AR 预览 ====================
AR_MODEL_OSS_PATH=ar/models/              # AR 模型 OSS 目录
```

---

### P4.12 技术决策与 Trade-off 汇总（Phase 4）

| 决策 | 选择 | 备选方案 | 理由 |
|------|------|----------|------|
| AI 队列 | Bull (Redis-backed) | RabbitMQ / Kafka | 与现有 Redis 基础设施一致，零额外组件运维；Bull 成熟稳定，适合中等吞吐量 |
| 分布式锁 | Redis SETNX + TTL | Redlock / ZooKeeper | 简单可靠，Phase 4 规模 (3-5 实例) 下 SETNX 足够；实例崩溃时 TTL 自动释放 |
| 排行榜缓存 | Redis Sorted Set | 实时 SQL 聚合 / Elasticsearch | ZSET 天然适合排行场景；10min TTL + 每小时重建保证数据新鲜度 |
| 敏感词过滤 | DFA 本地词库 (可切换云端) | 纯云端 API | 初期成本低、延迟 <10ms；预留 `SENSITIVE_WORD_PROVIDER` 切换开关 |
| PDF 导出 | Puppeteer (HTML→PDF) | pdfkit | HTML 模板渲染灵活，与前端 Dashboard 样式一致；资源消耗可接受 (异步队列) |
| 小程序码生成 | 服务端调用 + OSS 缓存 | 前端 Canvas 画布 | 服务端统一管理 access_token (Redis 缓存 TTL 7200s)；30 天 OSS 缓存避免重复调用 |
| Webhook 签名 | HMAC-SHA256 | OAuth 2.0 Client Credentials | 简单高效，符合企业微信/钉钉 Webhook 主流签名方式 |
| 二级评论 | parent_id 自引用 (应用层限制) | Closure Table | 轻量且满足 2 层限制需求；无需额外表，查询简单 |
| 部件面积 | 车型独立存储 (car_part) | 全局模板 + 系数 | 满足精确计算需求；area_m2=0 兜底回退默认值 |
| campaign 审批 | approval_status 列扩展 | 独立审批工作流表 | 活动审批场景简单 (approve/reject)，无需复杂工作流引擎 |

---

### P4.13 不做的事（Phase 4 排除项）

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
| AI 生图多服务商支持（同时接入 DALL-E + SD + Midjourney） | 仍维持单一服务商 (通过适配器预留扩展) |
| AI 生图效果图智能排序/评分 | AI 生图质量评估需额外引入评价模型 |
| Dashboard 数据对比 (同比/环比) | 复杂报表放后续 BI 工具对接 |
| 短信验证码的国际手机号支持 | 当前仅支持中国大陆 +86 手机号 |
| AR 的 WebXR 深度集成 (手势识别、空间锚点) | AR 仅做基础的车身叠加预览 |
| AR 的 iOS ARKit Quick Look 集成 | 优先 WebView 通用方案 |
| Webhook 消息模板自定义 | 当前使用固定模板，后续支持变量替换 |

---

*架构版本：v4.0 (Phase 4 新增)*
*编写角色：🏛️ Software Architect*
*更新日期：2026-07-22*

---
## --- Phase 5 架构设计：多门店与数据智能 ---

**状态**：Draft  
**日期**：2026-07-22 | **角色**：🏛️ Software Architect  

---

### P5.0 Phase 5 错误码体系

在现有错误码枚举中新增以下错误码：

| 错误码 | 枚举名 | HTTP | message | 说明 |
|--------|--------|------|---------|------|
| 3030 | STORE_NOT_EXISTS | 404 | 门店不存在 | 门店 ID 无效或已删除。注：此码用于 admin 端门店 CRUD 场景，区别于 Phase 3 的 3019 STORE_NOT_FOUND（客户端门店查询）。两码分离以区分 admin 操作（需返回不同错误详情）与客户端查询 |
| 3031 | STAFF_STORE_MISMATCH | 403 | 店员与门店不匹配 | 店员所属门店与请求中的门店不一致 |
| 3032 | WAITLIST_FULL | 400 | 该时段候补队列已满（上限 20 人），请选择其他时段 | 候补队列容量上限 |
| 3033 | WAITLIST_ALREADY_JOINED | 400 | 您已在该时段候补队列中，请勿重复提交 | 同一手机号同一时段重复候补 |
| 3034 | MODEL_NOT_CONFIGURED | 400 | 该车型未配置 3D 模型，无法生成 USDZ | 车型无 glTF/GLB 模型文件 |
| 3035 | TAG_NOT_FOUND | 404 | 标签不存在 | 操作的标签 ID 无效或已删除 |
| 4030 | STORE_SWITCH_FORBIDDEN | 403 | 您不属于该门店，无法切换 | 店员尝试切换到未关联的门店 |
| 4031 | STAFF_NOT_IN_CURRENT_STORE | 403 | 店员不属于当前活跃门店 | 多门店场景下权限校验失败 |
| 4032 | STORE_HAS_ACTIVE_APPOINTMENTS | 400 | 门店存在未完成的预约，无法停用 | 停用/删除门店的前置校验 |
| 4033 | DUPLICATE_STORE_NAME | 409 | 门店名称已存在 | 门店名称全局唯一冲突 |
| 4034 | VOTE_ALREADY_CAST | 409 | 您已对该评论点赞 | 并发冲突时的防御性返回 |
| 4035 | RECOMMENDATION_ENGINE_ERROR | 500 | 推荐引擎暂时不可用，请稍后再试 | 推荐计算异常 |
| 4036 | EXPORT_IN_PROGRESS | 429 | 已有导出任务进行中，请等待完成后再试 | 同一门店重复导出请求 |
| 4037 | TAG_ALREADY_EXISTS | 409 | 标签名称已存在 | 同门店下标签名称唯一冲突 |
| 4038 | USDZ_CONVERSION_FAILED | 500 | USDZ 模型转换失败 | 转换工具异常或模型损坏 |
| 4039 | OFFLINE_CACHE_STALE | 400 | 离线缓存数据已过期，请重新同步 | Manifest 版本校验失败 |
| 4040 | HEATMAP_DATE_RANGE_TOO_LARGE | 400 | 热力图日期范围过大（最多 365 天），请缩小范围 | 热力图查询日期超限 |
| 4041 | STORE_HAS_ACTIVE_STAFF | 400 | 门店仍有活跃店员 | 删除门店时仍有店员关联 |
| 4042 | EXPORT_ROW_LIMIT_EXCEEDED | 400 | 导出数据超过上限 | 预估导出行数超过 10,000 行上限 |
| 4043 | USDZ_ALREADY_EXISTS | 409 | 该车型已有USDZ文件 | 车型已有 USDZ 文件，不允许重复生成 |
| 5010 | USDZ_CONVERSION_TIMEOUT | 504 | USDZ 模型转换超时，请稍后再试 | 转换耗时超过上限 |
| 5011 | RECOMMENDATION_SERVICE_UNAVAILABLE | 503 | 推荐服务不可用 | 推荐引擎外部依赖异常 |
| 5012 | EXPORT_GENERATION_FAILED | 500 | 报表导出生成失败，请联系管理员 | 导出任务执行异常 |
| 5013 | STORE_SWITCH_FAILED | 500 | 门店切换失败（服务暂不可用） | Redis 不可用导致 JWT 黑名单写入失败 |

**TypeScript 枚举定义**:
```typescript
// error-codes.enum.ts (Phase 5 追加部分)
export enum ErrorCode {
  // ... Phase 1/2/3/4 codes ...

  // ============ Phase 5 — Resource (3030-3035) ============
  STORE_NOT_EXISTS          = 3030,
  STAFF_STORE_MISMATCH      = 3031,
  WAITLIST_FULL             = 3032,
  WAITLIST_ALREADY_JOINED   = 3033,
  MODEL_NOT_CONFIGURED      = 3034,
  TAG_NOT_FOUND             = 3035,

  // ============ Phase 5 — Business (4030-4043) ============
  STORE_SWITCH_FORBIDDEN          = 4030,
  STAFF_NOT_IN_CURRENT_STORE      = 4031,
  STORE_HAS_ACTIVE_APPOINTMENTS   = 4032,
  DUPLICATE_STORE_NAME            = 4033,
  VOTE_ALREADY_CAST              = 4034,
  RECOMMENDATION_ENGINE_ERROR     = 4035,
  EXPORT_IN_PROGRESS              = 4036,
  TAG_ALREADY_EXISTS             = 4037,
  USDZ_CONVERSION_FAILED          = 4038,
  OFFLINE_CACHE_STALE            = 4039,
  HEATMAP_DATE_RANGE_TOO_LARGE   = 4040,
  STORE_HAS_ACTIVE_STAFF          = 4041,
  EXPORT_ROW_LIMIT_EXCEEDED       = 4042,
  USDZ_ALREADY_EXISTS             = 4043,

  // ============ Phase 5 — Server (5010-5013) ============
  USDZ_CONVERSION_TIMEOUT            = 5010,
  RECOMMENDATION_SERVICE_UNAVAILABLE = 5011,
  EXPORT_GENERATION_FAILED           = 5012,
  STORE_SWITCH_FAILED                = 5013,
}
```

---

### P5.1 店员多门店分配 (Staff Multi-Store)

> **需求映射**: FR-280 ~ FR-284 (模块 36), NFR-173 ~ NFR-174  
> **用户故事**: US-230, US-233, US-234  

#### P5.1.1 Entity / DB Schema

**staff_store（店员-门店关联中间表）**:

```sql
-- ============================================================
-- staff_store: 店员与门店多对多关系
-- ============================================================
CREATE TABLE `staff_store` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `staff_id`        BIGINT UNSIGNED NOT NULL              COMMENT '店员 ID',
  `store_id`        BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `role_in_store`   ENUM('staff','manager') NOT NULL DEFAULT 'staff' COMMENT '在该门店的角色',
  `assigned_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`      DATETIME        NULL                 COMMENT '软删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_staff_store` (`staff_id`, `store_id`),
  INDEX `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='店员-门店关联表 (多对多)';
```

**staff 表新增字段**:

```sql
-- ============================================================
-- staff: 新增 current_store_id 字段（三步迁移避免 NOT NULL 导致已有行失败）
-- ============================================================
-- Step 1: 以 NULLABLE 添加列
ALTER TABLE `staff`
  ADD COLUMN `current_store_id` BIGINT UNSIGNED NULL COMMENT '当前活跃门店 ID'
  AFTER `store_id`;

-- Step 2: 为已有数据回填 current_store_id
UPDATE `staff` SET `current_store_id` = `store_id` WHERE `current_store_id` IS NULL;

-- Step 3: 设为 NOT NULL
ALTER TABLE `staff`
  MODIFY `current_store_id` BIGINT UNSIGNED NOT NULL;
```

> **字段关系说明**: (a) `staff.store_id` 作为"归属门店"参考（向后兼容，保留）；(b) 所有业务查询以 `staff.current_store_id` 做门店隔离；(c) 单门店店员 `current_store_id` = `store_id`；(d) 数据迁移时默认取 `store_id` 值。
>
> **迁移计划**: Phase 6 计划废弃 `staff.store_id`，统一使用 `staff.current_store_id`。Phase 5 阶段保留 `store_id` 仅供向后兼容，所有新代码引用 `current_store_id`。

#### P5.1.2 DTO

```typescript
// src/modules/staff/dto/update-staff-stores.dto.ts
export class UpdateStaffStoresDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  store_ids: number[];

  @IsOptional()
  @IsObject()
  roles?: Record<number, 'staff' | 'manager'>; // key=store_id, value=role
}

// src/modules/staff/dto/staff-store-info.dto.ts
export class StaffStoreInfoDto {
  store_id: number;
  store_name: string;
  role: 'staff' | 'manager';
  is_current: boolean;
  assigned_at: string;
}
```

#### P5.1.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/admin/staff/:id/stores` | JWT (admin 或 manager) | 30/min | 查询店员关联的所有门店 (FR-282) |
| PUT | `/api/v1/admin/staff/:id/stores` | JWT (admin) | 10/min | 更新店员多门店分配，全量替换模式 (FR-283) |
| GET | `/api/v1/admin/stores/:id/staff` | JWT (manager+, 限本门店) | 30/min | 查询门店所有店员列表 (FR-284) |

#### P5.1.4 Service Logic

**StaffMultiStoreService.assignStores() 核心算法**:

```
assignStores(staffId, storeIds, roles?):
  │
  ├─ 1. 校验 staff 存在
  │     staff = findById(staffId)
  │     → NOT FOUND: throw NOT_FOUND
  │
  ├─ 2. 校验所有 store_id 存在
  │     validStores = storeRepo.findByIds(storeIds, { select: ['id'] })
  │     if validStores.length !== storeIds.length:
  │       → throw STORE_NOT_EXISTS (3030)
  │
  ├─ 3. 事务内操作:
  │     BEGIN TRANSACTION
  │
  │     a. 软删除旧关联:
  │        UPDATE staff_store SET deleted_at = NOW()
  │        WHERE staff_id = ? AND deleted_at IS NULL
  │
  │     b. 批量插入新关联:
  │        FOR EACH store_id:
  │          INSERT INTO staff_store (staff_id, store_id, role_in_store)
  │          VALUES (?, ?, COALESCE(roles[store_id], 'staff'))
  │
  │     c. 若当前 current_store_id 不在新 store_ids 中:
  │        切换 current_store_id 为 store_ids[0]
  │        UPDATE staff SET current_store_id = store_ids[0]
  │        WHERE id = ? AND current_store_id NOT IN (store_ids)
  │
  │     COMMIT
  │
  └─ 4. 审计日志:
       INSERT INTO audit_log (action='staff.stores.update', staff_id, detail)
```

**冗余校验**: 全量替换时若 `store_ids` 为空数组抛出 `@ArrayMinSize(1)` 校验错误。每位店员至少必须关联一个门店。

#### P5.1.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3030 | 传入的 store_ids 中存在不存在的门店 ID |
| 3031 | manager 尝试查询非本门店的店员关联（权限校验） |

#### P5.1.6 Redis / Cache Strategy

- **店员门店列表缓存**: Redis key `staff_stores:{staffId}`，存储序列化的门店列表。TTL=300s (5min)。在分配更新时主动 DELETE 该 key (Cache-Aside 模式)。

#### P5.1.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **并发更新**: 两个 admin 同时对同一店员更新 stores | 乐观锁: `staff_store` 使用 `updated_at` 版本号或分布式锁 `lock:staff_stores:{staffId}` (TTL=5s) |
| **移除所有门店**: store_ids 为空数组 | DTO 层 `@ArrayMinSize(1)` 拦截，不允许店员无任何门店归属 |
| **current_store_id 被移除**: 店员当前活跃门店被管理员移除时 | 自动切换为剩余门店中的第一个；并发推送 WebSocket 通知前端刷新 |
| **管理员为自己移除当前门店**: 操作人将自己从门店中移除 | 允许操作，但 `current_store_id` 自动切换；若操作人无其他门店则标记为待分配状态 |
| **同一店员同一门店重复分配**: 全量替换模式下不存在此问题 | 旧关联软删除后再插入新记录 |

---

### P5.2 门店切换与会话管理 (Store Switching & Session)

> **需求映射**: FR-285 ~ FR-287 (模块 37), NFR-173 ~ NFR-174  
> **用户故事**: US-230, US-233  

#### P5.2.1 Entity / DB Schema

无需新建表。复用 `staff` 表的 `current_store_id` 字段和 `staff_store` 中间表。

#### P5.2.2 DTO

```typescript
// src/modules/store/dto/switch-store.dto.ts
export class SwitchStoreDto {
  @IsInt()
  @Min(1)
  store_id: number;
}

// src/modules/store/dto/current-store-info.dto.ts
export class CurrentStoreInfoDto {
  id: number;
  name: string;
  address: string;
  business_hours: object; // { open, close, off_days[] }
  phone: string;
  is_current: boolean;
}
```

#### P5.2.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/stores/switch` | JWT | 10/min | 切换当前活跃门店 (FR-285) |
| GET | `/api/v1/stores/current` | JWT | 60/min | 获取当前活跃门店信息 (FR-286) |
| GET | `/api/v1/staff/me/stores` | JWT | 60/min | 获取我的可切换门店列表 (FR-287) |

#### P5.2.4 Service Logic

**StoreSwitchService.switch() 核心流程**:

```
switch(staffId, targetStoreId):
  │
  ├─ 1. 校验店员属于目标门店:
  │     relation = staffStoreRepo.findOne({
  │       staff_id: staffId,
  │       store_id: targetStoreId,
  │       deleted_at: IS NULL
  │     })
  │     → NOT FOUND: throw STORE_SWITCH_FORBIDDEN (4030)
  │
  ├─ 2. 获取当前 JWT 信息:
  │     currentJti = jwtPayload.jti
  │     currentExp = jwtPayload.exp
  │
  ├─ 3. 旧 JWT 加入黑名单:
  │     ttlSeconds = currentExp - Math.floor(Date.now() / 1000)
  │     if ttlSeconds > 0:
  │       Redis: SETEX jwt_blacklist:{jti} ttlSeconds "1"
  │
  ├─ 4. 更新 current_store_id:
  │     UPDATE staff SET current_store_id = targetStoreId
  │     WHERE id = staffId
  │
  ├─ 5. 签发新 JWT:
  │     newPayload = { sub: staffId, store_id: targetStoreId,
  │                    role: staff.role, jti: newJti }
  │     newJwt = jwtService.sign(newPayload)
  │
  ├─ 6. 审计日志:
  │     INSERT INTO audit_log (action='store.switch',
  │       operator_id=staffId, source_store_id, target_store_id, ip, time)
  │
  └─ 返回: { access_token: newJwt, store: { id, name } }
```

**JWT 黑名单验证 (Guard 层)**:

```typescript
// jwt-blacklist.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const token = extractJwt(request);
  const payload = this.jwtService.decode(token) as JwtPayload;

  // 检查黑名单
  const blacklisted = await this.redis.get(`jwt_blacklist:${payload.jti}`);
  if (blacklisted) {
    throw new UnauthorizedException('Token 已失效，请重新登录');
  }
  return true;
}
```

> **黑名单内存管理**: 使用 Redis `SETEX` 自动过期，过期时间=JWT 剩余有效期。无需手动清理，零内存泄漏风险。

#### P5.2.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4030 | 店员尝试切换到未关联的门店 |
| 3030 | 目标门店不存在或已删除 |

#### P5.2.6 Redis / Cache Strategy

- **JWT 黑名单**: Key `jwt_blacklist:{jti}`, TTL=JWT 剩余有效期, SETEX 原子操作
- **店员门店列表**: Key `staff_stores:{staffId}`, TTL=300s, 切换后主动刷新
- **当前门店信息**: Key `current_store:{staffId}`, TTL=300s, 切换后 DELETE + 惰性加载

#### P5.2.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **并发切换**: 店员在多个设备同时切换门店 | 后一次切换会使前一次签发的 JWT 进入黑名单，无数据不一致风险。`current_store_id` 以最后一次 UPDATE 为准 |
| **JWT 黑名单 Key 冲突**: 极低概率的 jti 碰撞 | 使用 UUID v4 作为 jti，碰撞概率可忽略 |
| **切换到自己已激活的门店**: 幂等处理 | 仍然签发新 JWT（新 jti），旧 JWT 进黑名单。前端可做快速路径优化（跳过不必要的请求） |
| **Redis 不可用时切换**: JWT 黑名单写入失败 | 返回 500 `STORE_SWITCH_FAILED` (5013, 实际应降级为允许切换但记录 WARN 日志)。保守策略：切换失败，要求重试 |
| **切换后旧 Token 的并发请求**: 旧 JWT 请求与新 JWT 请求并发到达 | Guard 首选检查黑名单，但存在 Redis 写入延迟窗口（<10ms）。此窗口内旧 Token 仍有效，属可接受的短暂过渡期 |

---

### P5.3 门店管理后台 CRUD (Store Management Admin)

> **需求映射**: FR-288 ~ FR-292 (模块 38)  
> **用户故事**: US-231  

#### P5.3.1 Entity / DB Schema

**store 表扩展字段**:

```sql
-- ============================================================
-- store: 扩展门店管理字段 (若 Phase 1/3 的 store 表不包含以下字段)
-- ============================================================
ALTER TABLE `store`
  ADD COLUMN `location`         JSON          NULL COMMENT '门店地理坐标 { lat, lng }' AFTER `address`,
  ADD COLUMN `business_hours`   JSON          NULL COMMENT '营业时间 { open: "09:00", close: "18:00", off_days: ["Sunday"] }' AFTER `location`,
  ADD COLUMN `services_offered` JSON          NULL COMMENT '服务项目 ["full_wrap","partial_wrap","detail_treatment"]' AFTER `business_hours`,
  ADD COLUMN `capacity_config`  JSON          NULL COMMENT '产能配置 { max_daily_appointments: 10, slot_duration_minutes: 60 }' AFTER `services_offered`,
  ADD COLUMN `region`           VARCHAR(100)  NULL COMMENT '所属区域 (如: 华东区)' AFTER `capacity_config`,
  ADD COLUMN `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT '门店状态' AFTER `region`;
```

> 注：若 `store` 表在 Phase 1/3 中已有这些字段，则无需重复 ALTER。此处定义作为 Phase 5 的门店管理完整 Schema 参考。

#### P5.3.2 DTO

```typescript
// src/modules/admin/dto/create-store.dto.ts
export class CreateStoreDto {
  @IsString() @MaxLength(100)
  name: string;

  @IsString() @MaxLength(500)
  address: string;

  @IsOptional()
  @ValidateNested()
  location?: { lat: number; lng: number };

  @IsOptional()
  @ValidateNested()
  business_hours?: { open: string; close: string; off_days: string[] };

  @IsString() @Matches(/^1[3-9]\d{9}$/)
  phone: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services_offered?: string[];

  @IsOptional()
  @ValidateNested()
  capacity_config?: {
    max_daily_appointments: number;
    slot_duration_minutes: number;
  };

  @IsOptional() @IsString()
  region?: string;
}

// src/modules/admin/dto/update-store.dto.ts
// 同 CreateStoreDto，所有字段 @IsOptional()
// 额外支持:
export class UpdateStoreDto extends PartialType(CreateStoreDto) {
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}

// src/modules/admin/dto/query-store.dto.ts
export class QueryStoreDto {
  @IsOptional() @IsEnum(['active', 'inactive'])
  status?: string;

  @IsOptional() @IsString()
  region?: string;

  @IsOptional() @IsString() @MaxLength(100)
  keyword?: string;

  @IsOptional() @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  size?: number = 20;
}
```

#### P5.3.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/admin/stores` | JWT (admin) | 10/min | 创建门店 (FR-288) |
| GET | `/api/v1/admin/stores` | JWT (admin) | 30/min | 门店列表，支持筛选+分页 (FR-290) |
| GET | `/api/v1/admin/stores/:id` | JWT (manager+, 限本门店) | 60/min | 门店详情 (FR-289) |
| PUT | `/api/v1/admin/stores/:id` | JWT (admin) | 10/min | 更新门店信息 (FR-291) |
| DELETE | `/api/v1/admin/stores/:id` | JWT (admin) | 5/min | 软删除门店 (FR-292) |

#### P5.3.4 Service Logic

**StoreAdminService.delete() 软删除校验链**:

```
deleteStore(storeId):
  │
  ├─ 1. 门店存在性校验:
  │     store = findById(storeId)
  │     → NOT FOUND: throw STORE_NOT_EXISTS (3030)
  │
  ├─ 2. 活跃店员校验 (FR-292):
  │     activeStaff = staffStoreRepo.count({
  │       store_id: storeId, deleted_at: IS NULL
  │     })
  │     if activeStaff > 0:
  │       → throw STORE_HAS_ACTIVE_STAFF (4041)
  │
  ├─ 3. 未完成预约校验 (FR-291, FR-292):
  │     activeAppts = appointmentRepo.count({
  │       store_id: storeId,
  │       status IN ('pending', 'confirmed'),
  │       deleted_at: IS NULL
  │     })
  │     if activeAppts > 0:
  │       → throw STORE_HAS_ACTIVE_APPOINTMENTS (4032)
  │
  ├─ 4. 事务内软删除:
  │     BEGIN TRANSACTION
  │     a. 软删除门店:
  │        UPDATE store SET deleted_at = NOW(), status = 'inactive'
  │        WHERE id = storeId
  │     b. 软删除关联:
  │        UPDATE staff_store SET deleted_at = NOW()
  │        WHERE store_id = storeId AND deleted_at IS NULL
  │     c. 切换受影响店员:
  │        FOR EACH affected_staff:
  │          remaining = findFirstRemainingStore(staff.id)
  │          if remaining:
  │            UPDATE staff SET current_store_id = remaining.store_id
  │          else:
  │            // 标记账号待分配 (可选扩展)
  │     COMMIT
  │
  └─ 5. 审计日志:
       INSERT INTO audit_log (action='store.delete', store_id, operator_id)
```

**停用校验 (PUT status=inactive)**：

```
deactivateStore(storeId):
  │
  ├─ 校验未完成预约 (同删除校验步骤 3)
  │
  ├─ 不校验店员（停用不同于删除，允许保留店员关联）
  │
  └─ UPDATE store SET status = 'inactive' WHERE id = storeId
```

#### P5.3.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3030 | 操作的门店不存在 |
| 4032 | 停用/删除时门店存在未完成的预约 |
| 4033 | 创建门店时名称与已有门店重复 |
| 4041 | 删除时门店仍有活跃店员关联 |

#### P5.3.6 Redis / Cache Strategy

- **门店列表缓存**: Key `admin:stores:list:{hash(status,region,keyword,page,size)}`，TTL=60s。CRUD 操作时清除所有 `admin:stores:list:*` 前缀 Key (使用 SCAN + DEL)
- **门店详情缓存**: Key `store:detail:{storeId}`，TTL=300s。UPDATE/DELETE 时主动清除

#### P5.3.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **名称重复**: 两个 admin 同时创建同名门店 | 数据库 `UNIQUE KEY uk_name (name)` 约束兜底，第二个请求返回 4033 |
| **门店软删除后的恢复**: Phase 5 不提供恢复功能 | 若需恢复，需手动介入数据库。后续版本可考虑回收站机制 |
| **连锁门店集团化管理**: 多个门店归属同一集团 | 预留 `region` 字段做区域分组；`capacity_config` JSON 支持扩展 `parent_store_id` |

---

### P5.4 门店绩效看板 (Store Performance Dashboard)

> **需求映射**: FR-293 ~ FR-295 (模块 39)  
> **用户故事**: US-232  

#### P5.4.1 Entity / DB Schema

无新建表。复用现有 `quote`、`appointment`、`customer`、`configuration` 表进行聚合查询。

#### P5.4.2 DTO

```typescript
// src/modules/admin/dto/store-dashboard.dto.ts
export class StoreDashboardQueryDto {
  @IsEnum(['daily', 'weekly', 'monthly'])
  period: string;

  @IsOptional() @IsDateString()
  date?: string; // 默认当天
}

export class StoreComparisonQueryDto {
  @IsString() @Matches(/^\d+(,\d+)*$/)
  store_ids: string; // "1,2,3"

  @IsEnum(['daily', 'weekly', 'monthly'])
  period: string;

  @IsOptional() @IsDateString()
  date?: string;
}

// 响应体
export class StoreDashboardDto {
  total_revenue: number;
  quote_count: number;
  conversion_rate: number;       // 报价→成交
  appointment_count: number;
  arrival_rate: number;          // 预约→到店
  new_customer_count: number;
  average_order_value: number;   // 客单价
  top_staff: { staff_id: number; name: string; revenue: number }[];
}

export class StoreComparisonDto {
  items: StoreDashboardDto[];
  platform_average: {
    revenue_avg: number;
    conversion_rate_avg: number;
    arrival_rate_avg: number;
  };
}
```

#### P5.4.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/admin/stores/:id/dashboard` | JWT (manager+) | 20/min | 单门店绩效看板 (FR-293) |
| GET | `/api/v1/admin/stores/comparison` | JWT (admin) | 10/min | 多门店绩效对比 (FR-294) |

#### P5.4.4 Service Logic

**StoreDashboardService.getSingleStore() 聚合查询**:

```sql
-- 单门店绩效看板核心 SQL（示例：月度）
-- 使用独立子查询避免 quote/appointment/customer 之间的笛卡尔积导致 SUM(final_price) 膨胀
SELECT
  s.id AS store_id, s.name,
  COALESCE(q_stats.total_revenue, 0) AS total_revenue,
  COALESCE(q_stats.quote_count, 0) AS quote_count,
  COALESCE(q_stats.conversion_rate, 0) AS conversion_rate,
  COALESCE(a_stats.appointment_count, 0) AS appointment_count,
  COALESCE(a_stats.arrival_rate, 0) AS arrival_rate,
  COALESCE(c_stats.new_customer_count, 0) AS new_customer_count,
  COALESCE(q_stats.average_order_value, 0) AS average_order_value
FROM store s
LEFT JOIN (
  SELECT store_id,
    COALESCE(SUM(CASE WHEN status = 'closed' THEN final_price ELSE 0 END), 0) AS total_revenue,
    COUNT(*) AS quote_count,
    ROUND(
      COUNT(DISTINCT CASE WHEN status = 'closed' THEN id END) * 100.0 /
      NULLIF(COUNT(*), 0), 1
    ) AS conversion_rate,
    ROUND(
      COALESCE(SUM(CASE WHEN status = 'closed' THEN final_price ELSE 0 END), 0) /
      NULLIF(COUNT(DISTINCT CASE WHEN status = 'closed' THEN id END), 0), 2
    ) AS average_order_value
  FROM quote
  WHERE created_at BETWEEN :periodStart AND :periodEnd AND deleted_at IS NULL
  GROUP BY store_id
) q_stats ON s.id = q_stats.store_id
LEFT JOIN (
  SELECT store_id,
    COUNT(*) AS appointment_count,
    ROUND(
      COUNT(DISTINCT CASE WHEN status = 'arrived' THEN id END) * 100.0 /
      NULLIF(COUNT(*), 0), 1
    ) AS arrival_rate
  FROM appointment
  WHERE appointment_date BETWEEN :periodStart AND :periodEnd AND deleted_at IS NULL
  GROUP BY store_id
) a_stats ON s.id = a_stats.store_id
LEFT JOIN (
  SELECT store_id, COUNT(*) AS new_customer_count
  FROM customer
  WHERE created_at BETWEEN :periodStart AND :periodEnd AND deleted_at IS NULL
  GROUP BY store_id
) c_stats ON s.id = c_stats.store_id
WHERE s.id = :storeId;
```

**StoreComparisonService.compare() 对比算法**:

```
compareStores(storeIds, period):
  │
  ├─ 1. 对各门店并行执行 getSingleStore() 查询
  │
  ├─ 2. 计算平台均值:
  │     avg_revenue = sum(all_revenues) / count(storeIds)
  │     avg_conversion = sum(all_conversions) / count(storeIds)
  │     ...
  │
  ├─ 3. 计算各门店偏差百分比:
  │     deviation_pct = (store_value - avg) / avg * 100
  │
  └─ 4. 按营收降序排列，返回
```

**Top N 销售员 (子查询)**:
```sql
SELECT q.staff_id, st.name, SUM(q.final_price) AS revenue
FROM quote q
JOIN staff st ON st.id = q.staff_id
WHERE q.store_id = :storeId
  AND q.status = 'closed'
  AND q.created_at BETWEEN :periodStart AND :periodEnd
  AND q.deleted_at IS NULL
GROUP BY q.staff_id, st.name
ORDER BY revenue DESC
LIMIT 5;
```

#### P5.4.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3030 | 查询的门店不存在 |
| 3031 | manager 跨门店查询（仅限本门店） |

#### P5.4.6 Redis / Cache Strategy

- **单门店看板**: Key `store_dashboard:{storeId}:{period}:{dateHash}`，TTL=300s (5min)
- **多门店对比**: Key `store_comparison:{hash(storeIds,period,date)}`，TTL=600s (10min)。因计算代价较高，缓存时间更长
- **缓存失效**: 当 quote/appointment/customer 在该门店有新写入时，通过 EventBus 事件异步清除相关缓存

#### P5.4.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **无数据门店**: 新门店无任何历史数据 | 返回全零指标（不要 NULL），conversion_rate 等除法结果返回 0 而非 null |
| **超大 store_ids 列表**: 一次对比 50+ 门店 | 限制 store_ids 最多 20 个（DTO 层 @ArrayMaxSize(20)），超出建议分批查询 |
| **跨时区日期计算**: 门店在不同时区 | 统一使用服务器时区 (Asia/Shanghai)，period 参数按服务器时间计算边界 |

---

### P5.5 预约候补队列 (Appointment Waitlist)

> **需求映射**: FR-296 ~ FR-303 (模块 40), NFR-180 ~ NFR-181  
> **用户故事**: US-240, US-241  

#### P5.5.1 Entity / DB Schema

```sql
-- ============================================================
-- appointment_waitlist: 预约候补队列
-- ============================================================
CREATE TABLE `appointment_waitlist` (
  `id`                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`                  BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `appointment_date`          DATE            NOT NULL              COMMENT '预约日期',
  `time_slot_id`              BIGINT UNSIGNED NOT NULL              COMMENT '时段 ID',
  `customer_name`             VARCHAR(50)     NOT NULL              COMMENT '客户姓名',
  `customer_phone`            VARCHAR(20)     NOT NULL              COMMENT '客户手机号',
  `vehicle_info`              VARCHAR(200)    NULL                 COMMENT '车辆信息描述',
  `service_type`              ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') NOT NULL COMMENT '服务类型',
  `position`                  INT UNSIGNED    NOT NULL              COMMENT '排队位置 (1 为最前)',
  `status`                    ENUM('waiting','promoted','cancelled','expired') NOT NULL DEFAULT 'waiting' COMMENT '候补状态',
  `promoted_appointment_id`   BIGINT UNSIGNED NULL                 COMMENT '提升后关联的预约 ID',
  `created_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  `deleted_at`                DATETIME        NULL                 COMMENT '软删除标记',
  PRIMARY KEY (`id`),
  INDEX `idx_slot_status` (`time_slot_id`, `appointment_date`, `status`),
  INDEX `idx_phone_date` (`customer_phone`, `appointment_date`),
  INDEX `idx_store_date` (`store_id`, `appointment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预约候补队列表';
```

#### P5.5.2 DTO

```typescript
// src/modules/appointment/dto/join-waitlist.dto.ts
export class JoinWaitlistDto {
  @IsInt() @Min(1)
  store_id: number;

  @IsDateString()
  appointment_date: string;

  @IsInt() @Min(1)
  time_slot_id: number;

  @IsString() @MaxLength(50)
  customer_name: string;

  @IsString() @Matches(/^1[3-9]\d{9}$/)
  customer_phone: string;

  @IsOptional() @IsString() @MaxLength(200)
  vehicle_info?: string;

  @IsEnum(['full_wrap','partial_wrap','detail_treatment','color_change','other'])
  service_type: string;

  @IsOptional() @IsString() @Length(6, 6)
  sms_code?: string; // 短信验证码校验 (复用 Phase 4 机制)
}

// src/modules/appointment/dto/waitlist-status.dto.ts
export class WaitlistStatusDto {
  waitlist_id: number;
  appointment_date: string;
  time_slot: string;
  position: number;
  status: string;
  estimated_description: string; // "前方还有 3 人，预计 1-2 天内可排到"
}

// src/modules/admin/dto/query-waitlist.dto.ts
export class QueryWaitlistDto {
  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsInt()
  time_slot_id?: number;

  @IsOptional() @IsInt()
  store_id?: number;

  @IsOptional() @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  size?: number = 20;
}
```

#### P5.5.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/appointments/waitlist` | Public (短信验证) | 5/min per phone | 加入候补 (FR-297) |
| GET | `/api/v1/appointments/waitlist/status` | Public (phone匹配) | 30/min | 查询候补状态 (FR-300) |
| DELETE | `/api/v1/appointments/waitlist/:id` | JWT (phone校验) | 10/min | 取消候补 (FR-301) |
| GET | `/api/v1/admin/appointments/waitlist` | JWT (manager+) | 30/min | 管理候补队列 (FR-302) |

#### P5.5.4 Service Logic

**WaitlistService.join() 加入候补**:

```
join(dto):
  │
  ├─ 1. 短信验证码校验（若传入 sms_code）:
  │     verifySmsCode(dto.customer_phone, dto.sms_code, 'appointment')
  │     → 失败: throw SMS_CODE_WRONG (1012)
  │
  ├─ 2. 时段满员确认:
  │     currentCount = appointmentRepo.count({
  │       time_slot_id: dto.time_slot_id,
  │       appointment_date: dto.appointment_date,
  │       status IN ('pending', 'confirmed'),
  │       deleted_at: IS NULL
  │     })
  │     capacity = getTimeSlotCapacity(dto.time_slot_id)
  │     if currentCount < capacity:
  │       → return { action: 'direct_book', message: '该时段已有空位，建议直接预约' }
  │
  ├─ 3. 重复候补校验:
  │     existing = waitlistRepo.findOne({
  │       customer_phone: dto.customer_phone,
  │       appointment_date: dto.appointment_date,
  │       time_slot_id: dto.time_slot_id,
  │       status: 'waiting',
  │       deleted_at: IS NULL
  │     })
  │     if existing:
  │       → throw WAITLIST_ALREADY_JOINED (3033)
  │
  ├─ 4. 队列容量校验:
  │     waitCount = waitlistRepo.count({
  │       time_slot_id: dto.time_slot_id,
  │       appointment_date: dto.appointment_date,
  │       status: 'waiting',
  │       deleted_at: IS NULL
  │     })
  │     if waitCount >= 20:
  │       → throw WAITLIST_FULL (3032)
  │
  ├─ 5. 计算 position:
  │     position = waitCount + 1
  │
  ├─ 6. 插入候补记录:
  │     INSERT INTO appointment_waitlist (... position, status='waiting')
  │
  └─ 返回: { waitlist_id, position, status: 'waiting' }
```

**WaitlistService.promote() 自动提升 (事件驱动 — 预约取消时触发)**:

```
promoteOnCancellation(appointmentId):
  │
  ├─ 1. 查询被取消的预约信息:
  │     appt = findById(appointmentId)
  │
  ├─ 2. 分布式锁: lock:waitlist_promotion:{time_slot_id}:{date}
  │     → 未获取: 返回 (另一进程正在处理)
  │
  ├─ 3. 事务内操作:
  │     BEGIN TRANSACTION
  │
  │     a. 查询首位候补 (FOR UPDATE 行锁):
  │        SELECT * FROM appointment_waitlist w
  │        WHERE w.store_id = ? AND w.time_slot_id = ?
  │          AND w.appointment_date = ?
  │          AND status = 'waiting' AND deleted_at IS NULL
  │        ORDER BY w.position ASC
  │        LIMIT 1
  │        FOR UPDATE
  │
  │     b. 若无候补: 释放锁, 返回
  │
  │     c. 创建正式预约 (复用 Phase 3 预约创建流程):
  │        newAppt = appointmentService.create({
  │          store_id: waitlist.store_id,
  │          appointment_date: waitlist.appointment_date,
  │          time_slot_id: waitlist.time_slot_id,
  │          customer_name: waitlist.customer_name,
  │          customer_phone: waitlist.customer_phone,
  │          vehicle_info: waitlist.vehicle_info,
  │          service_type: waitlist.service_type
  │        })
  │
  │     d. 更新候补状态:
  │        UPDATE appointment_waitlist
  │        SET status = 'promoted', promoted_appointment_id = newAppt.id
  │        WHERE id = promoted.id
  │
  │     e. 其余候补 position 前移:
  │        UPDATE appointment_waitlist
  │        SET position = position - 1
  │        WHERE w.store_id = ? AND w.time_slot_id = ?
  │          AND w.appointment_date = ?
  │          AND status = 'waiting' AND position > promoted.position
  │          AND deleted_at IS NULL
  │
  │     COMMIT
  │
  ├─ 4. 发送通知 (事务外, 失败不影响提升):
  │     smsService.send(promoted.customer_phone, TEMPLATE_WAITLIST_PROMOTED)
  │     mpService.sendTemplateMessage(promoted.customer_openid, ...)
  │     (若两者均失败: webhookService.notifyManager(store_id, '候补通知失败'))
  │
  └─ 5. 释放分布式锁
```

#### P5.5.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3032 | 候补队列已满 (>=20人) |
| 3033 | 同一手机号已在同时段候补 |
| 1012 | 短信验证码错误 (若传入) |

#### P5.5.6 Redis / Cache Strategy

- **候补队列位置缓存**: Key `waitlist_count:{time_slot_id}:{date}`，记录当前 waiting 数量，TTL=600s。join/promote/cancel 时增减
- **分布式锁**: Key `lock:waitlist_promotion:{time_slot_id}:{date}`，TTL=30s，确保自动提升操作的原子性

#### P5.5.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **并发取消 + 提升**: 同一时段多个预约同时取消 | 分布式锁串行化提升操作。`FOR UPDATE` 行锁确保仅一个候补被提升。锁 TTL=30s 防止死锁 |
| **提升时创建预约失败**: 预约表约束冲突 (如超过时段容量) | 事务回滚，候补保持 waiting 状态。记录 ERROR 日志 + 告警。此情况理论上不应发生（刚取消一个预约，容量空出 1 个） |
| **候补已过期但未清理**: 创建超过 7 天仍 waiting | 定时任务 `@Cron('0 3 * * *')` 每天凌晨 3 点标记 expired。过期后不会再被提升。提升扫描使用 `WHERE status='waiting'` 子句，天然排除 expired 行，不会产生 position 空洞影响提升顺序 |
| **短信通知失败**: 提升成功但短信未送达 | 不影响提升操作完成。记录 `notification_log`，通知门店经理关注 |
| **侯补取消操作**: 客户取消自己的候补 | 软删除 + 后续 position 前移。已提升 (promoted) 或已取消的候补不可再次取消 |

---

### P5.6 服务时段容量粒度 (Time-Slot Capacity Granularity)

> **需求映射**: FR-304 ~ FR-308 (模块 41)  
> **用户故事**: US-242  

#### P5.6.1 Entity / DB Schema

```sql
-- ============================================================
-- service_type_config: 服务类型全局时长配置
-- ============================================================
CREATE TABLE `service_type_config` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_type`      ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') NOT NULL,
  `duration_minutes`  INT UNSIGNED    NOT NULL              COMMENT '默认时长（分钟）',
  `label`             VARCHAR(50)     NOT NULL              COMMENT '显示标签',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_type` (`service_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务类型全局时长配置表';

-- 种子数据
INSERT INTO `service_type_config` (`service_type`, `duration_minutes`, `label`) VALUES
  ('full_wrap',        480, '全车改色'),
  ('partial_wrap',     240, '局部改色'),
  ('detail_treatment', 120, '细节处理'),
  ('color_change',     480, '改色方案'),
  ('other',            120, '其他服务');

-- ============================================================
-- store_service_config: 门店级服务时长覆盖
-- ============================================================
CREATE TABLE `store_service_config` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `service_type`      ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') NOT NULL,
  `duration_minutes`  INT UNSIGNED    NOT NULL              COMMENT '门店自定义时长（分钟）',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_service` (`store_id`, `service_type`),
  INDEX `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店级服务时长配置表';
```

#### P5.6.2 DTO

```typescript
// src/modules/store/dto/store-service-config.dto.ts
export class StoreServiceConfigItemDto {
  @IsEnum(['full_wrap','partial_wrap','detail_treatment','color_change','other'])
  service_type: string;

  @IsInt() @Min(10) @Max(1440)
  duration_minutes: number; // 最短10分钟，最长24小时
}

export class UpdateStoreServiceConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  services: StoreServiceConfigItemDto[];
}

export class StoreServiceConfigResponseDto {
  service_type: string;
  duration_minutes: number;
  label: string;
  source: 'global' | 'custom'; // 数据来源：全局默认 or 门店自定义
}
```

#### P5.6.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/stores/:id/service-config` | Public | 60/min | 获取门店服务时长配置 (FR-307) |
| PUT | `/api/v1/admin/stores/:id/service-config` | JWT (manager+) | 10/min | 更新门店服务时长配置 (FR-308) |

#### P5.6.4 Service Logic

**TimeSlotCapacityService.getCapacity() 容量计算**:

```
getCapacity(timeSlotId, serviceType, storeId):
  │
  ├─ 1. 获取时段的时间范围:
  │     slot = findTimeSlotById(timeSlotId)
  │     slotDurationMinutes = (slot.end_time - slot.start_time).totalMinutes
  │     // 如: 09:00-12:00 = 180min, 14:00-18:00 = 240min
  │
  ├─ 2. 获取服务时长:
  │     // 优先门店自定义，回退全局默认
  │     storeConfig = storeServiceConfigRepo.findOne({
  │       store_id: storeId, service_type: serviceType
  │     })
  │     if storeConfig:
  │       serviceDuration = storeConfig.duration_minutes
  │     else:
  │       globalConfig = serviceTypeConfigRepo.findOne({
  │         service_type: serviceType
  │       })
  │       serviceDuration = globalConfig.duration_minutes
  │
  ├─ 3. 计算容量:
  │     capacity = floor(slotDurationMinutes / serviceDuration)
  │
  ├─ 4. 查询已预约数:
  │     booked = appointmentRepo.count({
  │       time_slot_id: timeSlotId,
  │       appointment_date: date,
  │       status IN ('pending', 'confirmed'),
  │       deleted_at: IS NULL
  │     })
  │
  └─ 返回: { capacity, booked, available: max(0, capacity - booked) }
```

**简化处理说明 (FR-306)**:
- 时段容量 = `floor(时段总分钟数 / 该服务类型的 duration_minutes)`
- 同一时段混合不同类型预约时，按各自服务时长分别计算并累计。简化实现：以最细粒度 (最短服务时长) 作为"槽位单位"，每种服务类型占据不同数量的槽位
- **最细粒度槽位单位 = 30 分钟**。full_wrap = 16 槽位（480/30），partial_wrap = 8 槽位（240/30），detail_treatment = 4 槽位（120/30）。每时间段总槽位数 = floor(540/30) = 18 槽位
- 示例：时段 09:00-18:00 (540min, 18槽), full_wrap=480min 占 16 槽位（1 个预约占用 16/18）, partial_wrap=240min 占 8 槽位（1 个预约占用 8/18）。预约校验时累计各服务类型占用的槽位数，不超过总槽位数 18

#### P5.6.5 Error Codes

无新增专属错误码。门店不存在使用 3030。

#### P5.6.6 Redis / Cache Strategy

- **服务时长配置缓存**: Key `service_duration:{storeId}:{serviceType}`，TTL=3600s (1h)。PUT 更新时主动清除。Cache miss 时回退查全局配置
- **时段容量缓存**: Key `slot_capacity:{timeSlotId}:{date}`，TTL=600s。仅在预约创建/取消时失效

#### P5.6.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **门店未自定义时长**: 某些 service_type 门店未配置 | 静默回退到 `service_type_config` 全局默认值 |
| **跨天时段**: 时段跨越 00:00（如夜班） | 计算 duration 时正确处理日期边界 |
| **服务时长超过时段长度**: full_wrap=480min 但时段仅 240min | 容量=0，该服务类型在此时段不可用。前端应隐藏该选项 |
| **种子数据初始化和后续新增服务类型**: 新 service_type 需同步在 `service_type_config` 中添加默认时长 | 通过迁移脚本管理 |

---

### P5.7 看板同比环比 (Dashboard YoY/MoM Comparison)

> **需求映射**: FR-309 ~ FR-312 (模块 42)  
> **用户故事**: US-250  

#### P5.7.1 Entity / DB Schema

无新建表。复用现有聚合查询。

#### P5.7.2 DTO

```typescript
// src/modules/admin/dto/dashboard-comparison.dto.ts
export class DashboardComparisonQueryDto {
  @IsEnum(['yoy', 'mom'])
  compare_type: 'yoy' | 'mom';

  @IsEnum(['monthly', 'quarterly'])
  period: string;

  @IsOptional() @IsDateString()
  date?: string; // 默认上月/上季最后一天
}

export class MetricComparisonDto {
  current: number;
  previous: number;
  growth_pct: number | null; // null 表示上一个周期无数据 (无法计算增长率)
}

export class DashboardComparisonResponseDto {
  revenue: MetricComparisonDto;
  quote_count: MetricComparisonDto;
  appointment_count: MetricComparisonDto;
  conversion_rate: MetricComparisonDto;
  new_customer_count: MetricComparisonDto;
  average_order_value: MetricComparisonDto;
  period_label: string; // "2026年7月 vs 2026年6月"
}
```

#### P5.7.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/admin/dashboard/comparison` | JWT (manager+) | 10/min | 看板同比环比对比 (FR-309) |

#### P5.7.4 Service Logic

**DashboardComparisonService.compare() 核心算法**:

```
compare(storeId, compareType, period, date):
  │
  ├─ 1. 确定当前周期边界:
  │     [currentStart, currentEnd] = calculatePeriod(period, date)
  │     // monthly: date 计算所在月份 [1号, 月末]
  │     // quarterly: date 计算所在季度 [季首, 季末]
  │
  ├─ 2. 确定对比周期边界:
  │     if compareType == 'mom' (环比 Month-over-Month):
  │       [previousStart, previousEnd] = shiftBackOnePeriod(period, currentStart)
  │       // monthly: 上个月 [1号, 月末]
  │       // quarterly: 上个季度 [季首, 季末]
  │     else if compareType == 'yoy' (同比 Year-over-Year):
  │       [previousStart, previousEnd] = shiftBackOneYear(currentStart, currentEnd)
  │       // 去年同月/同季
  │
  ├─ 3. 查询当前周期指标:
  │     currentMetrics = aggregateMetrics(storeId, currentStart, currentEnd)
  │
  ├─ 4. 查询对比周期指标:
  │     previousMetrics = aggregateMetrics(storeId, previousStart, previousEnd)
  │
  ├─ 5. 计算增长率:
  │     FOR EACH metric IN ['revenue', 'quote_count', ...]:
  │       if previousMetrics[metric] > 0:
  │         growth_pct = (currentMetrics[metric] - previousMetrics[metric])
  │                    / previousMetrics[metric] * 100
  │       else:
  │         growth_pct = null // 上一周期为 0，无法计算增长率
  │
  └─ 返回对比数据
```

**aggregateMetrics() 核心 SQL (使用独立子查询避免笛卡尔积)**:

```sql
-- 参数化查询，使用 :storeId, :startDate, :endDate
SELECT
  COALESCE(q_stats.revenue, 0) AS revenue,
  COALESCE(q_stats.quote_count, 0) AS quote_count,
  COALESCE(q_stats.conversion_rate, 0) AS conversion_rate,
  COALESCE(q_stats.average_order_value, 0) AS average_order_value,
  COALESCE(a_stats.appointment_count, 0) AS appointment_count,
  COALESCE(c_stats.new_customer_count, 0) AS new_customer_count
FROM (SELECT 1 AS dummy) d
LEFT JOIN (
  SELECT
    COALESCE(SUM(CASE WHEN status = 'closed' THEN final_price ELSE 0 END), 0) AS revenue,
    COUNT(*) AS quote_count,
    ROUND(
      COUNT(DISTINCT CASE WHEN status = 'closed' THEN id END) * 100.0 /
      NULLIF(COUNT(*), 0), 1
    ) AS conversion_rate,
    ROUND(
      COALESCE(SUM(CASE WHEN status = 'closed' THEN final_price ELSE 0 END), 0) /
      NULLIF(COUNT(DISTINCT CASE WHEN status = 'closed' THEN id END), 0), 2
    ) AS average_order_value
  FROM quote
  WHERE store_id = :storeId
    AND created_at BETWEEN :startDate AND :endDate
    AND deleted_at IS NULL
) q_stats ON TRUE
LEFT JOIN (
  SELECT COUNT(*) AS appointment_count
  FROM appointment
  WHERE store_id = :storeId
    AND appointment_date BETWEEN :startDate AND :endDate
    AND deleted_at IS NULL
) a_stats ON TRUE
LEFT JOIN (
  SELECT COUNT(*) AS new_customer_count
  FROM customer
  WHERE store_id = :storeId
    AND created_at BETWEEN :startDate AND :endDate
    AND deleted_at IS NULL
) c_stats ON TRUE;
```

#### P5.7.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3031 | manager 跨门店查询 |

#### P5.7.6 Redis / Cache Strategy

- **对比数据缓存**: Key `dashboard_comparison:{storeId}:{compareType}:{period}:{dateHash}`，TTL=3600s (1h)。首次请求同步计算并写入缓存
- **Dashboard KPI 接口扩展**: Phase 3 FR-142 的 KPI 接口响应体新增 `last_period_*` 字段（可选），供前端迷你趋势线展示。该部分数据同样走 Redis 缓存

#### P5.7.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **跨年同比**: 2026-01 vs 2025-01 | `shiftBackOneYear()` 正确处理年份边界，同时处理闰年 (2024-02 有 29 天 vs 2025-02 有 28 天 — 按月计算不受影响) |
| **上一周期无数据**: 新门店或上周期无运营 | growth_pct 返回 null，前端展示 "—" 或 "无对比数据"。不允许用 0 作为增长率（会误导为"零增长"） |
| **季度边界**: Q1 = 1-3月, Q2 = 4-6月, Q3 = 7-9月, Q4 = 10-12月 | 按自然季度划分，不按财务季度 |
| **超大时间范围**: date 为空时默认上月 | date 参数用于定位计算窗口，不直接作为查询范围 |

---

### P5.8 案例推荐引擎 (Case Recommendation)

> **需求映射**: FR-313 ~ FR-316 (模块 43), NFR-184  
> **用户故事**: US-252  

#### P5.8.1 Entity / DB Schema

无新建表。基于现有 `case` 表及其关联 (`car_model`, `car_series`, `car_brand`, `color_swatch`) 进行推荐计算。

#### P5.8.2 DTO

```typescript
// src/modules/case/dto/case-recommendation.dto.ts
export class CaseRecommendationQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(20)
  limit?: number = 6;

  @IsOptional() @IsInt() @Min(1)
  store_id?: number; // 可选: 优先推荐本门店案例
}

export class RecommendedCaseDto {
  id: number;
  title: string;
  cover_image_url: string;
  vehicle_summary: string;    // "宝马 3系 / AX 哑光灰"
  like_count: number;
  match_reason?: string;      // "同品牌同车型" | "同色系" | "热门推荐"
}
```

#### P5.8.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/cases/:id/recommendations` | Public | 60/min | 获取相关案例推荐 (FR-313) |

#### P5.8.4 Service Logic

**CaseRecommendationService.recommend() 混合推荐算法**:

```
recommend(caseId, limit = 6, storeId?):
  │
  ├─ 1. 获取当前案例元数据:
  │     currentCase = caseRepo.findOne({
  │       where: { id: caseId, deleted_at: IS NULL },
  │       relations: ['carModel', 'carModel.series', 'carModel.series.brand',
  │                   'partColors', 'partColors.colorSwatch']
  │     })
  │     → NOT FOUND: throw CASE_NOT_FOUND
  │
  ├─ 2. 尝试读取缓存:
  │     cached = redis.get(`case_recommendations:{caseId}`)
  │     if cached: return JSON.parse(cached)
  │
  ├─ 3. 分层推荐 (策略权重):
  │
  │     Layer 1 (权重 40%): 同品牌+同车型
  │       SELECT c.* FROM `case` c
  │       JOIN car_model cm ON c.model_id = cm.id
  │       JOIN car_series cs ON cm.series_id = cs.id
  │       WHERE cs.brand_id = :brandId
  │         AND cm.id = :modelId
  │         AND c.id != :caseId
  │         AND c.status = 'published'
  │         AND c.deleted_at IS NULL
  │       ORDER BY c.like_count DESC, c.view_count DESC
  │       LIMIT :limit
  │
  │     Layer 2 (权重 30%): 同颜色色系
  │       dominantColor = currentCase.partColors[0].colorSwatch.color_hex
  │       SELECT c.* FROM `case` c
  │       JOIN part_color pc ON pc.configuration_id = c.configuration_id
  │       JOIN color_swatch cs ON pc.color_swatch_id = cs.id
  │       WHERE cs.color_hex LIKE :colorPattern  -- 色系模糊匹配
  │         AND c.id != :caseId
  │         AND c.id NOT IN (:layer1Ids)         -- 排除已推荐
  │         AND c.status = 'published'
  │         AND c.deleted_at IS NULL
  │       ORDER BY c.like_count DESC
  │       LIMIT :remainingLimit
  │
  │     Layer 3 (权重 30%): 全平台热门兜底
  │       SELECT c.* FROM `case` c
  │       WHERE c.id NOT IN (:layer1Ids, :layer2Ids)
  │         AND c.status = 'published'
  │         AND c.deleted_at IS NULL
  │       ORDER BY c.like_count DESC, c.view_count DESC
  │       LIMIT :remainingLimit
  │
  ├─ 4. 去重 + 门店加成 (若 store_id 传入):
  │     uniqueResults = dedup(layer1 ++ layer2 ++ layer3)
  │     if storeId:
  │       // 本门店案例排序权重提升
  │       for result in uniqueResults:
  │         result.score *= (result.store_id == storeId) ? 1.1 : 1.0
  │       reorder by score DESC
  │
  ├─ 5. 写入缓存:
  │     redis.setex(`case_recommendations:{caseId}`, 86400, JSON.stringify(results))
  │
  └─ 返回: 去重后前 limit 条推荐
```

**冷启动处理**: 热门案例预计算。每日凌晨 Cron 任务 (`@Cron('0 2 * * *')`) 扫描 `like_count > 0` 的案例，预计算并缓存其推荐结果。

#### P5.8.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4035 | 推荐计算过程中数据库或缓存异常 |
| 5011 | 推荐引擎外部依赖不可用 |

#### P5.8.6 Redis / Cache Strategy

- **案例推荐缓存**: Key `case_recommendations:{caseId}`，TTL=86400s (24h)。热门案例由 Cron 预计算，冷门案例首次请求实时计算并缓存
- **热门案例列表**: Redis Sorted Set `case_hot_score`，按 `like_count + view_count*0.1` 加权。用于 Layer 3 兜底快速查询

#### P5.8.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **无同品牌同车型案例**: Layer 1 返回空 | 自动跳过 Layer 1，Layer 2+3 填充推荐列表。推荐理由标记为"同色系"或"热门" |
| **推荐数量不足 limit**: 各层汇总后总数 < limit | 返回实际可推荐数量 (可能 < limit)，不填充低质量结果 |
| **当前案例为唯一案例**: 没有任何其他案例存在 | 返回空列表 `{ items: [], message: "暂无相关推荐" }` |
| **Redis 缓存过期 + 并发请求**: 同一 caseId 同时多个推荐请求 | 使用 Redis SETNX `lock:recommendation:{caseId}` (TTL=10s) 防止缓存击穿，仅一个请求计算，其余等待 |

---

### P5.9 案例标签系统 (Case Topic/Tag)

> **需求映射**: FR-317 ~ FR-322 (模块 44)  
> **用户故事**: US-253, US-254  

#### P5.9.1 Entity / DB Schema

```sql
-- ============================================================
-- case_tag: 案例标签
-- ============================================================
CREATE TABLE `case_tag` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(30)     NOT NULL              COMMENT '标签名称',
  `color`       VARCHAR(7)      NOT NULL DEFAULT '#1890FF' COMMENT '标签颜色（十六进制）',
  `sort_order`  INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '排序权重',
  `store_id`    BIGINT UNSIGNED NULL                  COMMENT '所属门店 (NULL=平台通用)',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  `deleted_at`  DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name_store` (`name`, `store_id`),
  INDEX `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例标签表';

-- ============================================================
-- case_tag_relation: 案例-标签关联
-- ============================================================
CREATE TABLE `case_tag_relation` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id`     BIGINT UNSIGNED NOT NULL              COMMENT '案例 ID',
  `tag_id`      BIGINT UNSIGNED NOT NULL              COMMENT '标签 ID',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_tag` (`case_id`, `tag_id`),
  INDEX `idx_tag_id` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例-标签关联表';
```

#### P5.9.2 DTO

```typescript
// src/modules/admin/dto/create-tag.dto.ts
export class CreateTagDto {
  @IsString() @MinLength(1) @MaxLength(30)
  name: string;

  @IsOptional() @IsString() @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string = '#1890FF';

  @IsOptional() @IsInt() @Min(0)
  sort_order?: number = 0;

  @IsOptional() @IsInt() @Min(1)
  store_id?: number; // NULL=平台通用标签, 传入=门店自定义标签
}

// src/modules/admin/dto/set-case-tags.dto.ts
export class SetCaseTagsDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  tag_ids: number[]; // 全量替换模式
}

// src/modules/case/dto/query-case.dto.ts (扩展)
// 在 Phase 2/3 的 QueryCaseDto 基础上新增:
// @IsOptional() @IsString() tags?: string; // "1,2,3" (AND 逻辑)
```

#### P5.9.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/tags` | Public | 60/min | 标签列表 (?store_id=) (FR-321) |
| POST | `/api/v1/admin/tags` | JWT (admin) | 20/min | 创建标签 (FR-318) |
| PUT | `/api/v1/admin/tags/:id` | JWT (admin) | 20/min | 编辑标签 (FR-318) |
| DELETE | `/api/v1/admin/tags/:id` | JWT (admin) | 10/min | 删除标签，级联删除关联 (FR-318) |
| PUT | `/api/v1/admin/cases/:id/tags` | JWT (admin / 本门店manager) | 20/min | 为案例设置标签 (FR-319) |
| GET | `/api/v1/admin/tags` | JWT (admin) | 30/min | 管理端标签列表 (?store_id=&keyword=) (FR-318) |

#### P5.9.4 Service Logic

**CaseTagService.setCaseTags() 全量替换**:

```
setCaseTags(caseId, tagIds, storeId):
  │
  ├─ 1. 校验案例存在 + 所属门店:
  │     case = findById(caseId)
  │     → NOT FOUND: throw CASE_NOT_FOUND
  │     → 权限: admin 或 case.store_id == storeId
  │
  ├─ 2. 校验所有 tag_id 存在:
  │     validTags = tagRepo.findByIds(tagIds)
  │     if validTags.length !== tagIds.length:
  │       → throw TAG_NOT_FOUND
  │
  ├─ 3. 事务内全量替换:
  │     BEGIN TRANSACTION
  │     a. 删除旧关联:
  │        DELETE FROM case_tag_relation WHERE case_id = ?
  │     b. 批量插入新关联:
  │        INSERT INTO case_tag_relation (case_id, tag_id)
  │        VALUES (?, ?), (?, ?), ...
  │     COMMIT
  │
  └─ 返回: { case_id, tags: [ { id, name, color } ] }
```

**案例列表标签筛选 (AND 逻辑)**:

```sql
-- 查询同时具有 tag_id=1 AND tag_id=2 的案例
SELECT c.* FROM `case` c
WHERE c.id IN (
  SELECT ctr1.case_id FROM case_tag_relation ctr1
  WHERE ctr1.tag_id = 1
)
AND c.id IN (
  SELECT ctr2.case_id FROM case_tag_relation ctr2
  WHERE ctr2.tag_id = 2
)
AND c.status = 'published' AND c.deleted_at IS NULL
ORDER BY c.created_at DESC
LIMIT :limit OFFSET :offset;
```

> 注：使用 `IN` 子查询实现 AND 逻辑。标签数量较少 (<10) 时性能可接受。若标签筛选成为高频操作，可考虑使用 `GROUP BY + HAVING COUNT(DISTINCT tag_id) = N`。

#### P5.9.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4037 | 创建标签时同门店下名称重复 |
| 3035 (TAG_NOT_FOUND) | 操作的标签 ID 不存在 |

#### P5.9.6 Redis / Cache Strategy

- **公开标签列表**: Key `tags:public:{storeId?}`，TTL=3600s (1h)。CRUD 操作时清除
- **案例标签数据**: 案例详情查询时标签通过 JOIN `case_tag_relation` + `case_tag` 直接获取，不单独缓存

#### P5.9.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **store_id IS NULL 的唯一约束**: 平台通用标签名称唯一 | MySQL `UNIQUE KEY uk_name_store (name, store_id)` 中 NULL 值被视为不同的唯一值。需要应用层校验或使用 `IFNULL(store_id, 0)` 辅助。推荐方案：平台标签的 store_id 设为 0 而非 NULL |
| **删除标签的级联影响**: 标签被删除后案例列表筛选中不再出现 | 级联删除 `case_tag_relation` 中所有关联记录 |
| **门店自定义标签的可见性**: 仅在请求中传入 store_id 时返回 | 公开接口 `GET /api/v1/tags?store_id=` 可选参数控制 |

---

### P5.10 门店热力图 (Store Heatmap)

> **需求映射**: FR-323 ~ FR-326 (模块 45)  
> **用户故事**: US-255  

#### P5.10.1 Entity / DB Schema

无新建表。从 `quote`、`appointment`、`customer` 表中的地址/城市字段聚合计算。

#### P5.10.2 DTO

```typescript
// src/modules/admin/dto/heatmap-query.dto.ts
export class HeatmapQueryDto {
  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsEnum(['grid', 'city'])
  aggregation: 'grid' | 'city';

  @IsOptional()
  @IsEnum(['full_wrap', 'partial_wrap', 'detail_treatment', 'color_change', 'other'])
  service_type?: string;
}

export class HeatmapDataPointDto {
  lat?: number;
  lng?: number;
  city?: string;
  density: number; // 聚合计数
}
```

#### P5.10.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/admin/stores/heatmap` | JWT (admin) | 5/min | 门店客户地理密度热力图 (FR-323) |

#### P5.10.4 Service Logic

**HeatmapService.generate() 聚合策略**:

```
generate(dateFrom, dateTo, aggregation, serviceType?):
  │
  ├─ 1. 日期范围校验:
  │     if (dateTo - dateFrom) > 365 days:
  │       → throw HEATMAP_DATE_RANGE_TOO_LARGE (4040)
  │
  ├─ 2. 尝试读取缓存:
  │     cacheKey = hash(dateFrom, dateTo, aggregation, serviceType)
  │     cached = redis.get(`store_heatmap:{cacheKey}`)
  │     if cached: return JSON.parse(cached)
  │
  ├─ 3. 数据来源聚合:
  │
  │     -- 报价来源
  │     SELECT q.customer_city, q.customer_lat, q.customer_lng
  │     FROM quote q
  │     WHERE q.created_at BETWEEN :dateFrom AND :dateTo
  │       AND q.deleted_at IS NULL
  │       [AND q.service_type = :serviceType]
  │
  │     -- 预约来源
  │     SELECT a.customer_address, a.store_id
  │     FROM appointment a
  │     WHERE a.appointment_date BETWEEN :dateFrom AND :dateTo
  │       AND a.deleted_at IS NULL
  │       [AND a.service_type = :serviceType]
  │
  │     -- 客户档案来源
  │     SELECT c.city, c.address
  │     FROM customer c
  │     WHERE c.created_at BETWEEN :dateFrom AND :dateTo
  │       AND c.deleted_at IS NULL
  │
  ├─ 4. 聚合:
  │
  │     if aggregation == 'city':
  │       GROUP BY customer_city
  │       统计各城市的 density=COUNT(*)
  │       使用内置城市经纬度映射表获取坐标
  │
  │     if aggregation == 'grid':
  │       // 按经纬度网格聚合 (精度: 0.01 度 ≈ 1.1km)
  │       grid_lat = ROUND(lat / 0.01) * 0.01
  │       grid_lng = ROUND(lng / 0.01) * 0.01
  │       GROUP BY (grid_lat, grid_lng)
  │       → 仅当坐标数据可用时生效
  │
  ├─ 5. 写入缓存:
  │     redis.setex(`store_heatmap:{cacheKey}`, 21600, result)
  │     // TTL=6h, Cron 每小时刷新
  │
  └─ 返回: [{ lat, lng, density }, ...]
```

> **地理编码依赖**: 客户地址需先转换为经纬度才能参与 grid 级别聚合。若无精确坐标，降级为城市级别聚合。地理编码使用高德/百度地图 API，需配置 AK。

#### P5.10.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4040 | 日期范围超过 365 天 |
| 5011 | 地理编码服务或数据库聚合异常 |

#### P5.10.6 Redis / Cache Strategy

- **热力图数据缓存**: Key `store_heatmap:{hash(dateFrom,dateTo,aggregation,serviceType)}`，TTL=21600s (6h)
- **定时任务**: `@Cron('0 * * * *')` 每小时为最近 30 天的热力图预计算并更新缓存 (仅对高频查询的默认参数组合)

#### P5.10.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **无任何位置数据**: 所有客户/报价/预约均无地址或城市信息 | 返回空数组 `{ data: [], message: "暂无足够的位置数据生成热力图" }` |
| **仅有城市无精确坐标**: grid 聚合无法使用 | 降级为 city 聚合，使用城市中心坐标作为网格点 |
| **地理编码 API 限流**: 高德/百度 API 每日调用配额不足 | 使用 Redis 缓存已编码的地址→坐标映射 (TTL=30 天)，减少 API 调用 |

---

### P5.11 看板下钻 (Dashboard Drill-Down)

> **需求映射**: FR-327 ~ FR-330 (模块 46)  
> **用户故事**: US-251  

#### P5.11.1 Entity / DB Schema

无新建表。从 `quote`、`appointment`、`customer` 等业务表聚合计算。

#### P5.11.2 DTO

```typescript
// src/modules/admin/dto/drill-down.dto.ts
export class DrillDownQueryDto {
  @IsEnum(['revenue', 'quotes', 'appointments', 'customers'])
  metric_type: string;

  @IsEnum(['monthly', 'weekly'])
  period: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsEnum(['staff', 'brand', 'service_type', 'day'])
  group_by: string;

  @IsOptional() @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  size?: number = 20;
}

export class DrillDownItemDto {
  dimension_value: string;  // 员工名/品牌名/服务类型/日期
  metric_value: number;      // 指标值
  percentage?: number;       // 占比
}
```

#### P5.11.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/admin/dashboard/drill-down` | JWT (manager+) | 15/min | 看板指标下钻 (FR-327) |

#### P5.11.4 Service Logic

**DrillDownService.getDetails() 下钻策略路由**:

```
getDetails(storeId, metricType, period, date, groupBy, page, size):
  │
  ├─ 0. 计算时间窗口:
  │     [startDate, endDate] = calculatePeriod(period, date)
  │
  ├─ 1. 路由到对应查询:
  │
  │     CASE (metricType, groupBy):
  │
  │     (revenue, staff) → FR-328(a):
  │       SELECT st.name AS dimension_value,
  │              SUM(q.final_price) AS metric_value
  │       FROM quote q
  │       JOIN staff st ON st.id = q.staff_id
  │       WHERE q.store_id = :storeId
  │         AND q.status = 'closed'
  │         AND q.created_at BETWEEN :startDate AND :endDate
  │         AND q.deleted_at IS NULL
  │       GROUP BY st.id, st.name
  │       ORDER BY metric_value DESC
  │       LIMIT :limit OFFSET :offset;
  │
  │     (quotes, brand) → FR-328(b):
  │       SELECT cb.name AS dimension_value,
  │              COUNT(DISTINCT q.id) AS metric_value
  │       FROM quote q
  │       JOIN configuration cfg ON q.configuration_id = cfg.id
  │       JOIN car_model cm ON cfg.model_id = cm.id
  │       JOIN car_series cs ON cm.series_id = cs.id
  │       JOIN car_brand cb ON cs.brand_id = cb.id
  │       WHERE q.store_id = :storeId
  │         AND q.created_at BETWEEN :startDate AND :endDate
  │         AND q.deleted_at IS NULL
  │       GROUP BY cb.id, cb.name
  │       ORDER BY metric_value DESC;
  │
  │     (appointments, day) → FR-328(c):
  │       SELECT a.appointment_date AS dimension_value,
  │              COUNT(DISTINCT a.id) AS metric_value
  │       FROM appointment a
  │       WHERE a.store_id = :storeId
  │         AND a.appointment_date BETWEEN :startDate AND :endDate
  │         AND a.deleted_at IS NULL
  │       GROUP BY a.appointment_date
  │       ORDER BY a.appointment_date ASC;
  │
  │     (customers, service_type) → FR-328(d):
  │       SELECT a.service_type AS dimension_value,
  │              COUNT(DISTINCT c.id) AS metric_value
  │       FROM customer c
  │       LEFT JOIN quote q ON q.customer_phone = c.phone
  │         AND q.store_id = :storeId AND q.deleted_at IS NULL
  │       WHERE c.store_id = :storeId
  │         AND c.created_at BETWEEN :startDate AND :endDate
  │         AND c.deleted_at IS NULL
  │       GROUP BY a.service_type;
  │
  ├─ 2. 计算占比:
  │     total = SUM(all metric_value)
  │     FOR EACH item: item.percentage = ROUND(item.metric_value / total * 100, 1)
  │
  └─ 返回分页结果
```

#### P5.11.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3031 | manager 跨门店查询 |

#### P5.11.6 Redis / Cache Strategy

- **下钻数据缓存**: Key `drill_down:{storeId}:{metricType}:{period}:{dateHash}:{groupBy}`，TTL=1800s (30min)
- **缓存共享**: 同一门店同一 metric_type + period 组合共享缓存（不区分 page，缓存全量结果后在应用层分页）

#### P5.11.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **不支持的 group_by 组合**: 如 revenue + day | 返回 400，提示不支持的维度组合 |
| **空结果**: 指定时间段内无数据 | 返回空列表，total=0 |
| **appointments+day 的时间序列**: 30 天内逐日数据 | 返回数组包含每一天，无数据的天 metric_value=0（补零处理，确保前端图表连续性） |

---

### P5.12 定期报表导出调度 (Scheduled Export)

> **需求映射**: FR-331 ~ FR-337 (模块 47), NFR-187  
> **用户故事**: US-256  

#### P5.12.1 Entity / DB Schema

```sql
-- ============================================================
-- scheduled_export: 定期导出配置
-- ============================================================
CREATE TABLE `scheduled_export` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`           BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `name`               VARCHAR(100)    NOT NULL              COMMENT '配置名称',
  `export_type`        ENUM('pdf','excel','csv') NOT NULL    COMMENT '导出类型',
  `sections`           JSON            NOT NULL              COMMENT '导出模块 ["kpi","trends"]',
  `cron_expression`    VARCHAR(50)     NOT NULL              COMMENT 'Cron 表达式',
  `recipients`         JSON            NOT NULL              COMMENT '[{ email, phone? }]',
  `enabled`            TINYINT(1)      NOT NULL DEFAULT 1    COMMENT '是否启用',
  `last_executed_at`   DATETIME        NULL                 COMMENT '上次执行时间',
  `next_execution_at`  DATETIME        NULL                 COMMENT '下次执行时间',
  `created_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE,
  `deleted_at`         DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_name` (`store_id`, `name`),
  INDEX `idx_next_execution` (`enabled`, `next_execution_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定期导出配置表';

-- ============================================================
-- scheduled_export_log: 定期导出执行日志
-- ============================================================
CREATE TABLE `scheduled_export_log` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `schedule_id`    BIGINT UNSIGNED NOT NULL              COMMENT '定期导出配置 ID',
  `status`         ENUM('success','failed') NOT NULL     COMMENT '执行状态',
  `file_url`       VARCHAR(500)    NULL                 COMMENT '导出文件 OSS URL',
  `error_message`  TEXT            NULL                 COMMENT '失败原因',
  `executed_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_schedule_id` (`schedule_id`),
  INDEX `idx_executed_at` (`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定期导出执行日志表';
```

#### P5.12.2 DTO

```typescript
// src/modules/admin/dto/create-scheduled-export.dto.ts
export class CreateScheduledExportDto {
  @IsString() @MaxLength(100)
  name: string;

  @IsEnum(['pdf', 'excel', 'csv'])
  export_type: string;

  @IsArray()
  @IsString({ each: true })
  sections: string[];

  @IsString() @MaxLength(50)
  cron_expression: string; // 需校验合法性

  @IsArray()
  @ValidateNested({ each: true })
  recipients: { email: string; phone?: string }[];

  @IsOptional() @IsBoolean()
  enabled?: boolean = true;
}

// src/modules/admin/dto/update-scheduled-export.dto.ts
export class UpdateScheduledExportDto extends PartialType(CreateScheduledExportDto) {}
```

#### P5.12.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/admin/exports/schedules` | JWT (manager+) | 10/min | 创建定期导出配置 (FR-332) |
| GET | `/api/v1/admin/exports/schedules` | JWT (manager+) | 30/min | 查询定期导出配置列表 (FR-334) |
| PUT | `/api/v1/admin/exports/schedules/:id` | JWT (manager+) | 10/min | 更新配置 (FR-335) |
| DELETE | `/api/v1/admin/exports/schedules/:id` | JWT (manager+) | 5/min | 删除配置 (FR-336) |
| GET | `/api/v1/admin/exports/schedules/:id/logs` | JWT (manager+) | 30/min | 查看执行日志 (FR-337) |

#### P5.12.4 Service Logic

**ScheduledExportScheduler Cron 定时扫描**:

```
@Cron('*/1 * * * *') // 每分钟扫描
processScheduledExports():
  │
  ├─ 1. 分布式锁:
  │     lock = acquireLock('lock:scheduled_export_scheduler', 120)
  │     if !lock: return  // 另一实例正在执行
  │
  ├─ 2. 查询待执行配置 (最多 5 条):
  │     schedules = scheduledExportRepo.find({
  │       where: {
  │         enabled: true,
  │         next_execution_at: LessThanOrEqual(new Date()),
  │         deleted_at: IS NULL
  │       },
  │       order: { next_execution_at: 'ASC' },
  │       take: 5  // FR-333: 每次最多处理 5 条
  │     })
  │
  ├─ 3. FOR EACH schedule:
  │     try:
  │       a. 执行导出:
  │          // 复用 Phase 4 的 PDF/Excel 导出能力 + Phase 5 CSV 导出
  │          fileUrl = exportService.execute(schedule.export_type, schedule.sections, schedule.store_id)
  │
  │       b. 上传 OSS + 生成下载链接:
  │          ossUrl = ossService.upload(fileBuffer, `exports/scheduled/{schedule.id}/{timestamp}.{ext}`)
  │
  │       c. 发送邮件:
  │          FOR EACH recipient IN schedule.recipients:
  │            emailService.send({
  │              to: recipient.email,
  │              subject: `【WrapLab】${schedule.name} — ${date}`,
  │              body: renderTemplate(schedule, ossUrl)
  │            })
  │
  │       d. 记录成功日志:
  │          INSERT INTO scheduled_export_log (schedule_id, status='success', file_url)
  │
  │     catch error:
  │       e. 记录失败日志:
  │          INSERT INTO scheduled_export_log (schedule_id, status='failed', error_message)
  │
  │     f. 更新执行时间:
  │        UPDATE scheduled_export
  │        SET last_executed_at = NOW(),
  │            next_execution_at = calculateNextCron(schedule.cron_expression, NOW())
  │        WHERE id = schedule.id;
  │
  └─ 4. 释放分布式锁
```

**calculateNextCron() Cron 表达式解析**:

```typescript
import { CronJob } from 'cron';

function calculateNextCron(expression: string, fromDate: Date): Date {
  const job = new CronJob(expression, () => {});
  return job.nextDate(fromDate).toJSDate();
}
```

> 使用 `cron` npm 包解析 cron_expression 并计算下一次执行时间。创建/更新配置时同时校验 cron 表达式合法性（`CronJob` 构造会抛出异常）。

#### P5.12.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4037 | 同一门店下配置名称重复 |
| 4036 | 同一门店同一类型已有导出任务进行中 |
| 5012 | 导出生成失败或邮件发送失败 |

#### P5.12.6 Redis / Cache Strategy

- **执行锁**: Key `lock:scheduled_export_scheduler`，TTL=120s
- **单配置执行锁**: Key `lock:schedule_exec:{scheduleId}`，TTL=300s。防止同一配置在集群多实例中重复执行
- **邮件发送限流**: Key `email_rate:{scheduleId}`，TTL=3600s。防止邮件服务被滥用

#### P5.12.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **Cron 解析失败**: 创建/更新时 cron 表达式不合法 | `CronJob` 构造时抛出异常，返回 400 "cron_expression 格式不合法" |
| **邮件全部发送失败**: 所有 recipients 的邮件都未送达 | 记录 failed 日志。不重试（避免对收件人造成邮件轰炸）。在下次 Cron 触发时重新导出+发送 |
| **导出耗时超过 1 分钟**: Cron 每分钟触发一次 | 分布式锁 + 单配置锁防止重复执行。`take: 5` 限制每次最多处理 5 条，若 5 条处理不完则下一分钟继续 |
| **同一时间多条配置到期**: 1 分钟内到期超过 5 条 | 按 `next_execution_at ASC` 排序，优先处理最早的。剩余的下一个 Cron 周期继续处理 |
| **删除配置后执行日志保留**: 配置删除不清理历史日志 | 日志表独立保留，供审计和历史查询 |

---

### P5.13 BI CSV 导出 (BI Data Export)

> **需求映射**: FR-338 ~ FR-341 (模块 48), NFR-186  
> **用户故事**: US-257  

#### P5.13.1 Entity / DB Schema

复用 Phase 4 的 `export_task` 表。无需新建表。

#### P5.13.2 DTO

```typescript
// src/modules/admin/dto/csv-export.dto.ts
export class CsvExportDto {
  @IsEnum(['customers', 'quotes', 'appointments', 'revenue'])
  data_type: string;

  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[]; // 指定导出字段，不传则导出所有标准字段

  @IsOptional()
  @IsObject()
  filters?: {
    brand_id?: number;
    service_type?: string;
    staff_id?: number;
    status?: string;
  };
}

// 响应（异步）
export class CsvExportResponseDto {
  export_id: number;
  status: 'processing';
  estimated_seconds: number;
}
```

#### P5.13.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/admin/exports/csv` | JWT (manager+) | 5/min | 导出 CSV 原始数据 (FR-338) |

#### P5.13.4 Service Logic

**CsvExportService.export() 异步流程**:

```
export(dto, storeId):
  │
  ├─ 1. 行数预检:
  │     estimatedRows = estimateRowCount(dto.data_type, dto.date_from, dto.date_to, dto.filters, storeId)
  │     if estimatedRows > 10000:
  │       → throw EXPORT_ROW_LIMIT_EXCEEDED (4042)
  │
  ├─ 2. 创建导出任务:
  │     task = exportTaskRepo.save({
  │       store_id: storeId,
  │       export_type: 'csv',
  │       status: 'pending',
  │       params: JSON.stringify(dto)
  │     })
  │
  ├─ 3. 提交 Bull 队列 (复用 Phase 4 export 队列):
  │     job = dashboardExportQueue.add('csv-export', {
  │       taskId: task.id,
  │       dataType: dto.data_type,
  │       dateFrom: dto.date_from,
  │       dateTo: dto.date_to,
  │       fields: dto.fields,
  │       filters: dto.filters,
  │       storeId
  │     })
  │
  └─ 返回: { export_id: task.id, status: 'processing' }
```

**CSV 生成 Worker (Bull Consumer)**:

```
processCsvExport(job):
  │
  ├─ 1. 更新状态: UPDATE export_task SET status = 'processing'
  │
  ├─ 2. 查询数据 (流式读取):
  │     query = buildQuery(dataType, dateFrom, dateTo, fields, filters, storeId)
  │     stream = queryRunner.stream(query)
  │
  ├─ 3. 流式写入 CSV:
  │     csvStream = createWriteStream(tempFilePath)
  │     // 写入 UTF-8 BOM (兼容 Excel)
  │     csvStream.write('﻿')
  │     // 写入表头 (中文字段名)
  │     csvStream.write(mapToChineseHeaders(fields).join(',') + '\n')
  │     // 流式写入数据行
  │     FOR EACH row IN stream:
  │       csvRow = formatRow(row, fields)  // 日期→YYYY-MM-DD HH:mm:ss, 金额→2位小数
  │       csvStream.write(csvRow + '\n')
  │
  ├─ 4. 上传 OSS:
  │     ossUrl = ossService.upload(csvPath, `exports/csv/{storeId}/{dataType}_{timestamp}.csv`)
  │
  ├─ 5. 更新任务完成:
  │     UPDATE export_task SET status = 'completed', file_url = ossUrl
  │
  └─ 完成

formatRow(row, fields):
  │
  ├─ 日期字段: format(row.dateField, 'YYYY-MM-DD HH:mm:ss')
  ├─ 金额字段: row.priceField.toFixed(2)
  ├─ JSON 字段: JSON.parse(row.jsonField).map(v => v.name).join(', ')
  └─ 特殊字符转义: CSV 中逗号和双引号需用双引号包裹并转义内嵌双引号
```

**字段映射表 (fields → 中文表头)**:

| data_type | 标准字段 | 中文表头 |
|-----------|----------|----------|
| customers | name, phone, city, vehicle_info, total_visits, total_orders, created_at | 姓名, 手机号, 城市, 车辆信息, 累计到店, 累计订单, 创建时间 |
| quotes | id, customer_name, customer_phone, vehicle_desc, total_price, final_price, status, created_at | 报价单号, 客户姓名, 手机号, 车型, 原价, 成交价, 状态, 创建时间 |
| appointments | id, customer_name, customer_phone, appointment_date, time_slot, service_type, status, created_at | 预约号, 客户姓名, 手机号, 预约日期, 时段, 服务类型, 状态, 创建时间 |
| revenue | quote_id, customer_name, total_price, final_price, campaign_discount, closed_at | 报价单号, 客户姓名, 原价, 成交价, 活动优惠, 成交时间 |

#### P5.13.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4042 | 预估导出行数超过 10,000 行上限 |
| 4036 | 同一门店已有 CSV 导出任务进行中 |
| 5012 | CSV 生成或上传 OSS 失败 |

#### P5.13.6 Redis / Cache Strategy

- **导出频控**: Key `export_csv_rate:{storeId}`，TTL=60s。同一门店 1 分钟内最多 1 次 CSV 导出
- **行数预估缓存**: Key `csv_estimate:{hash(dataType,dateFrom,dateTo,filters,storeId)}`，TTL=600s。避免每次预检都执行 COUNT 查询

#### P5.13.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **10,000 行边界**: 恰好 10,000 行 | 允许导出（<= 10,000 均允许） |
| **fields 传入非法字段名**: 存在于请求中但不在标准字段映射表中 | 忽略该字段（仅导出合法字段），记录 WARN 日志 |
| **大文件内存控制**: 单次 10,000 行 CSV 约 2-5MB（含中文） | 使用 stream 流式写入，避免一次性加载到内存 |
| **特殊字符处理**: 客户备注字段含逗号、换行符、双引号 | CSV 标准转义：双引号包裹整个字段值，内部双引号用 `""` 转义 |

---

### P5.14 评论赞 (Comment Vote)

> **需求映射**: FR-342 ~ FR-345 (模块 49)  
> **用户故事**: US-261  

#### P5.14.1 Entity / DB Schema

```sql
-- ============================================================
-- comment_vote: 评论赞记录
-- ============================================================
CREATE TABLE `comment_vote` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `comment_id`  BIGINT UNSIGNED NOT NULL              COMMENT '评论 ID',
  `staff_id`    BIGINT UNSIGNED NOT NULL              COMMENT '点赞店员 ID',
  `store_id`    BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID (冗余, 便于多租户隔离)',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_comment_staff` (`comment_id`, `staff_id`),
  INDEX `idx_comment_id` (`comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论赞记录表';

-- comment 表新增字段 (Redis 缓存持久化)
ALTER TABLE `comment`
  ADD COLUMN `vote_count` INT NOT NULL DEFAULT 0 COMMENT '赞数（Redis 缓存冗余，定时同步）' AFTER `like_count`;
```

#### P5.14.2 DTO

```typescript
// Vote 接口无请求体 (toggle 模式)
// 响应体
export class CommentVoteResponseDto {
  vote_count: number;  // 当前赞数
  is_voted: boolean;   // 当前用户是否已赞
}
```

#### P5.14.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/cases/comments/:id/vote` | JWT | 60/min | 评论赞 toggle (FR-343) |

#### P5.14.4 Service Logic

**CommentVoteService.toggle() 赞/取消赞 Toggle**:

```
toggle(commentId, staffId, storeId):
  │
  ├─ 1. 评论存在性校验:
  │     comment = commentRepo.findOne({
  │       id: commentId, deleted_at: IS NULL
  │     })
  │     → NOT FOUND: throw COMMENT_NOT_FOUND (3020)
  │
  ├─ 2. 频控检查:
  │     rateKey = `comment_vote_rate:{staffId}`
  │     currentCount = redis.incr(rateKey)
  │     if currentCount == 1: redis.expire(rateKey, 60)  // 首次自增设置 TTL
  │     if currentCount > 30:
  │       → throw VOTE_RATE_LIMITED (4035)
  │
  ├─ 3. 查询已有投票:
  │     existing = commentVoteRepo.findOne({
  │       comment_id: commentId, staff_id: staffId
  │     })
  │
  ├─ 4. Toggle 逻辑:
  │     if existing:
  │       // 取消赞: 删除记录
  │       DELETE FROM comment_vote WHERE id = existing.id
  │       newVoteCount = voteCount - 1
  │       isVoted = false
  │     else:
  │       // 上赞: 创建记录
  │       INSERT INTO comment_vote (comment_id, staff_id, store_id)
  │       // 唯一约束 uk_comment_staff 防御并发重复
  │       newVoteCount = voteCount + 1
  │       isVoted = true
  │
  ├─ 5. 更新评论赞数缓存:
  │     redis.hincrby(`comment_votes`, commentId, isVoted ? 1 : -1)
  │
  └─ 返回: { vote_count: newVoteCount, is_voted: isVoted }
```

**评论列表扩展 (FR-344)**: 在 `GET /api/v1/cases/:id/comments` 响应中，每条评论新增:
- `vote_count`: Redis `HGET comment_votes {commentId}` 或数据库 `SELECT COUNT(*) FROM comment_vote WHERE comment_id=?`
- `is_voted`: Redis `SISMEMBER comment_voters:{commentId} {staffId}` 或数据库检查 (仅当前登录用户)

#### P5.14.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4035 | 60 秒内点赞超过 30 次 |
| 4034 | 并发冲突导致唯一约束失败 (防御性返回，正常 toggle 不会触发) |
| 3020 | 评论不存在 |

#### P5.14.6 Redis / Cache Strategy

- **赞数缓存**: Redis Hash `comment_votes`，field=commentId, value=vote_count
- **已赞用户集合**: Redis Set `comment_voters:{commentId}`，members=staffIds。用于快速判断 `is_voted`
- **频控计数器**: Key `comment_vote_rate:{staffId}`，TTL=60s, INCR 实现
- **缓存一致性**: toggle 时同步更新 Redis。若 Redis 不可用，回退到数据库 COUNT 查询
- **Redis 持久化**: `comment` 表新增 `vote_count INT DEFAULT 0` 列作为 Redis 缓存的持久化副本。每 5 分钟定时任务 `@Cron('*/5 * * * *')` 从 Redis Hash `comment_votes` 全量同步到 DB。Redis 重启时从 DB `comment.vote_count` 列重建 `comment_votes` Hash 缓存

#### P5.14.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **并发 toggle**: 同一用户快速双击点赞 | 数据库 `uk_comment_staff` 唯一约束兜底。若 INSERT 失败 (Duplicate entry)，回退到 DELETE (取消赞) |
| **Redis 赞数与数据库不一致**: Redis 重启或缓存失效后 | 读取时若 Redis Hash miss，从数据库 COUNT 回填。删除操作后也可异步校验 |
| **用户快速连点（赞→取消→赞）**: 1 秒内多次 toggle | 频控为 60s/30次，快速连点容忍。唯一约束保证数据一致性 |

---

### P5.15 USDZ 模型生成 (USDZ Model Generation)

> **需求映射**: FR-346 ~ FR-349 (模块 50)  
> **用户故事**: US-262  

#### P5.15.1 Entity / DB Schema

```sql
-- ============================================================
-- car_model: 新增 usdz_url 字段
-- ============================================================
ALTER TABLE `car_model`
  ADD COLUMN `usdz_url` VARCHAR(500) NULL COMMENT 'USDZ 格式模型文件的 OSS URL' AFTER `ar_model_url`;

-- ============================================================
-- usdz_conversion_log: USDZ 转换日志
-- ============================================================
CREATE TABLE `usdz_conversion_log` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model_id`       BIGINT UNSIGNED NOT NULL              COMMENT '车型 ID',
  `status`         ENUM('processing','completed','failed') NOT NULL COMMENT '转换状态',
  `error_message`  TEXT            NULL                 COMMENT '失败原因',
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_model_id` (`model_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='USDZ 转换日志表';
```

#### P5.15.2 DTO

```typescript
// 触发转换无请求体

// 响应体
export class UsdzGenerationResponseDto {
  status: 'queued';
  model_id: number;
}

export class UsdzInfoResponseDto {
  usdz_url: string | null;
  file_size?: number;     // 字节
  generated_at?: string;
  available: boolean;     // true if usdz_url IS NOT NULL
}
```

#### P5.15.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/v1/admin/vehicles/models/:id/generate-usdz` | JWT (admin) | 5/min | 触发 USDZ 转换 (FR-347) |
| GET | `/api/v1/vehicles/models/:id/usdz` | JWT | 30/min | 获取 USDZ 文件信息 (FR-348) |

#### P5.15.4 Service Logic

**UsdzService.generate() 异步转换**:

```
generate(modelId):
  │
  ├─ 1. 车型存在性校验:
  │     model = carModelRepo.findOne(modelId)
  │     → NOT FOUND: throw MODEL_NOT_FOUND
  │
  ├─ 2. 源模型校验:
  │     if !model.3d_model_url:
  │       → throw MODEL_NOT_CONFIGURED (3034)
  │
  ├─ 3. 已有 USDZ 检查:
  │     if model.usdz_url:
  │       → throw USDZ_ALREADY_EXISTS (4043)
  │       // 注: 需求 FR-347 允许"未请求重新生成"时返回错误
  │
  ├─ 4. 创建转换日志:
  │     log = INSERT INTO usdz_conversion_log (model_id, status='processing')
  │
  ├─ 5. 提交异步队列:
  │     job = usdzConversionQueue.add('convert', {
  │       modelId, logId: log.id,
  │       sourceUrl: model.3d_model_url
  │     })
  │
  └─ 返回: { status: 'queued', model_id: modelId }
```

**USDZ Conversion Worker (Bull Consumer)**:

```
processUsdzConversion(job):
  │
  ├─ 1. 从 OSS 下载源模型 (glTF/GLB):
  │     sourceBuffer = ossService.download(job.data.sourceUrl)
  │     tempDir = `/tmp/usdz-conversion/{job.data.modelId}/{timestamp}/`
  │
  ├─ 2. 调用转换工具:
  │     // 选项 A: usdzconvert (Apple 官方, macOS only)
  │     // 选项 B: gltf-to-usdz (社区工具, 跨平台)
  │     // 选项 C: 通过 HTTP 调用 macOS 构建节点上的转换服务
  │     result = execSync(`gltf-to-usdz -i {input.gltf} -o {output.usdz}`, {
  │       timeout: 300000  // 5 分钟超时
  │     })
  │     // 超时 → throw USDZ_CONVERSION_TIMEOUT (5010)
  │
  ├─ 3. 上传 USDZ 到 OSS:
  │     usdzUrl = ossService.upload(outputPath, `ar/usdz/{modelId}/model.usdz`)
  │
  ├─ 4. 更新 car_model:
  │     UPDATE car_model SET usdz_url = :usdzUrl WHERE id = :modelId
  │
  ├─ 5. 更新日志:
  │     UPDATE usdz_conversion_log SET status = 'completed' WHERE id = :logId
  │
  └─ 完成

  [失败处理]:
    UPDATE usdz_conversion_log
    SET status = 'failed', error_message = :errorMsg
    WHERE id = :logId;
```

#### P5.15.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 3034 | 车型未配置 3D 模型 |
| 4043 | 车型已有 USDZ 文件 |
| 4038 | 转换工具返回非零退出码 |
| 5010 | 转换过程超过 5 分钟超时 |

#### P5.15.6 Redis / Cache Strategy

- **转换状态查询**: 通过轮询数据库 `usdz_conversion_log` 表获取最新状态（不缓存转换中的状态）

#### P5.15.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **转换工具不可用**: Linux 服务端缺少 usdzconvert | 使用 `gltf-to-usdz` npm 包或部署 macOS 构建节点。若均不可用，记录 ERROR 日志返回 4038 |
| **源模型文件过大**: glTF 模型 > 100MB | 下载和转换均在工作目录 `/tmp` 完成，完成后清理临时文件。OS 应配置足够的磁盘空间 |
| **重复转换请求**: 同一车型多次 POST generate-usdz | 已有 `usdz_url` 时返回 4043。若需重新生成，需先清空 `usdz_url`（手动数据库操作或未来扩展 DELETE usdz 端点） |
| **并发转换同一模型**: 两个 admin 同时触发 | 数据库 `usdz_conversion_log` 中检查是否已有 processing 状态的记录 → 若有则返回 409 "转换进行中" |

---

### P5.16 离线缓存清单 (Offline Cache Manifest)

> **需求映射**: FR-350 ~ FR-353 (模块 51), NFR-182 ~ NFR-183  
> **用户故事**: US-260  

#### P5.16.1 Entity / DB Schema

无新建表。对外提供聚合接口，不存储 manifest 数据。

#### P5.16.2 DTO

```typescript
// src/modules/offline/dto/offline-manifest.dto.ts
export class OfflineManifestQueryDto {
  @IsOptional() @IsDateString()
  since?: string; // ISO 8601 时间戳, 增量更新
}

export class CachedResourceDto {
  key: string;            // 资源唯一标识
  type: 'vehicle' | 'color' | 'case' | 'config';
  url: string;            // OSS 资源 URL
  version: string;        // 由 updated_at 生成 (ISO 8601)
  ttl_seconds: number;    // 建议缓存时长
}

export class OfflineManifestResponseDto {
  resources: CachedResourceDto[];
  generated_at: string;   // 本次请求的生成时间 (ISO 8601)
  is_full: boolean;       // true=全量, false=增量
}
```

#### P5.16.3 API Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/v1/offline/manifest` | JWT | 20/min | 获取离线缓存清单 (FR-350) |

#### P5.16.4 Service Logic

**OfflineManifestService.generate() 实时聚合**:

```
generate(storeId, since?):
  │
  ├─ 1. 聚合各资源类型:
  │
  │     a. 热门案例 (最近 50 条):
  │        cases = caseRepo.find({
  │          where: { status: 'published', deleted_at: IS NULL },
  │          order: { like_count: 'DESC', view_count: 'DESC' },
  │          take: 50
  │        })
  │        caseResources = cases.map(c => ({
  │          key: `case:{c.id}:cover`,
  │          type: 'case',
  │          url: c.cover_image_url,
  │          version: c.updated_at.toISOString(),
  │          ttl_seconds: 86400  // 24h
  │        }))
  │
  │     b. 当前门店车型数据:
  │        // 门店关联的车型: 通过该门店报价单中使用过的车型
  │        models = carModelRepo.find({
  │          where: { id: IN(usedByStore(storeId)) }
  │        })
  │        modelResources = models.map(m => ({
  │          key: `vehicle:model:{m.id}`,
  │          type: 'vehicle',
  │          url: m.thumbnail_url,
  │          version: m.updated_at.toISOString(),
  │          ttl_seconds: 604800  // 7d
  │        }))
  │
  │     c. 颜色数据:
  │        colorBrands = colorBrandRepo.find({ deleted_at: IS NULL })
  │        colorResources = colorBrands.flatMap(cb =>
  │          cb.colorSwarches.map(cs => ({
  │            key: `color:{cs.id}`,
  │            type: 'color',
  │            url: cs.swatch_image_url,
  │            version: cs.updated_at.toISOString(),
  │            ttl_seconds: 2592000  // 30d
  │          }))
  │        )
  │
  │     d. 全局配置:
  │        configResources = [
  │          {
  │            key: `config:service_types`,
  │            type: 'config',
  │            url: `/api/v1/stores/{storeId}/service-config`,
  │            version: getMaxUpdatedAt('service_type_config'),
  │            ttl_seconds: 86400
  │          },
  │          {
  │            key: `config:store_info`,
  │            type: 'config',
  │            url: `/api/v1/stores/current`,
  │            version: getStoreUpdatedAt(storeId),
  │            ttl_seconds: 86400
  │          }
  │        ]
  │
  ├─ 2. 增量过滤 (若 since 存在):
  │     if since:
  │       allResources = filter r WHERE r.version > since
  │       isFull = false
  │     else:
  │       allResources = [caseResources ++ modelResources ++ colorResources ++ configResources]
  │       isFull = true
  │
  ├─ 3. 敏感数据脱敏 (NFR-182):
  │     // 若 client manifest 包含客户信息，手机号仅保留前3后4位
  │     // 当前 manifest 不包含客户 PII，此步骤预留
  │
  └─ 返回: { resources: allResources, generated_at: new Date().toISOString(), is_full: isFull }
```

**version 生成规则**: 各实体的 `updated_at` 字段的 ISO 8601 字符串作为 version。客户端比较本地缓存的 version 与 manifest 中的 version，若不同则需重新下载。

#### P5.16.5 Error Codes

| 错误码 | 触发条件 |
|--------|----------|
| 4039 | manifest 数据聚合过程中出现异常 |

#### P5.16.6 Redis / Cache Strategy

- **manifest 不缓存**: `generated_at` 每次请求实时生成（FR-352）
- **各资源子查询可用 Redis 缓存加速**: 热门案例列表 (ZSET `case_hot_score`)，颜色列表 (`colors:all`)，但 manifest 接口本身不缓存
- **usedByStore 子查询优化**: `usedByStore(storeId)` 通过报价单反查门店关联车型，为高频子查询。使用 Redis Set `store_models:{storeId}` 缓存门店到车型的映射关系，TTL 1 小时。随 quote 创建事件 (Phase 3 已有) 失效对应 key，确保缓存与业务数据一致
- **增量更新的 since 参数**: 直接通过数据库 `WHERE updated_at > :since` 过滤，无需单独缓存

#### P5.16.7 Edge Cases

| 场景 | 处理策略 |
|------|----------|
| **since 参数过大**: since 为 3 个月前的日期，返回数据量接近全量 | 客户端应控制增量同步频率（建议每周至少 1 次全量同步），`ttl_seconds` 字段告知客户端何时需要刷新 |
| **门店无关数据污染**: manifest 应仅包含当前门店相关的资源 | 车型和案例按 store_id 过滤，颜色和全局配置为全平台共享 |
| **Type=config 的资源 URL**: config 类资源的 url 是 API 路径而非 OSS 链接 | 客户端缓存 API 响应体而非文件，TTL 较短 (1d) |
| **离线存储容量**: 客户端总计上限 50MB (NFR-183) | manifest 包含 ttl_seconds，客户端按 LRU 策略管理本地缓存。超过限制时淘汰最久未访问的资源 |

---

### P5.17 Phase 5 模块架构总结

```
Phase 5 新增/扩展模块树:
│
├── StoreModule ──────────────── 扩展: 新增 StoreSwitchService, StoreAdminService
│   ├── StoreController                      POST   /stores/switch
│   │                                        GET    /stores/current
│   ├── StaffStoreController                 GET    /staff/me/stores
│   ├── StoreAdminController                 POST   /admin/stores
│   │                                        GET    /admin/stores
│   │                                        GET    /admin/stores/:id
│   │                                        PUT    /admin/stores/:id
│   │                                        DELETE /admin/stores/:id
│   │                                        GET    /admin/stores/comparison
│   │                                        GET    /admin/stores/:id/dashboard
│   │                                        GET    /admin/stores/heatmap
│   ├── staff_store.entity.ts
│   └── store_service_config.entity.ts
│
├── StaffModule ──────────────── 扩展: 新增 StaffMultiStoreService
│   ├── StaffStoreAdminController            GET    /admin/staff/:id/stores
│   │                                        PUT    /admin/staff/:id/stores
│   │                                        GET    /admin/stores/:id/staff
│   └── (staff 表新增 current_store_id 字段)
│
├── AppointmentModule ────────── 扩展: 新增 WaitlistService, TimeSlotCapacityService
│   ├── WaitlistController                   POST   /appointments/waitlist
│   │                                        GET    /appointments/waitlist/status
│   │                                        DELETE /appointments/waitlist/:id
│   │                                        GET    /admin/appointments/waitlist
│   ├── ServiceConfigController              GET    /stores/:id/service-config
│   │                                        PUT    /admin/stores/:id/service-config
│   ├── appointment_waitlist.entity.ts
│   ├── service_type_config.entity.ts
│   └── store_service_config.entity.ts
│
├── DashboardModule ──────────── 扩展: 新增 ComparisonService, DrillDownService
│   ├── DashboardController (扩展)           GET    /admin/dashboard/comparison
│   │                                        GET    /admin/dashboard/drill-down
│   └── (复用现有聚合查询)
│
├── ExportModule ─────────────── 扩展: 新增 ScheduledExportService, CsvExportService
│   ├── ScheduledExportController            POST   /admin/exports/schedules
│   │                                        GET    /admin/exports/schedules
│   │                                        PUT    /admin/exports/schedules/:id
│   │                                        DELETE /admin/exports/schedules/:id
│   │                                        GET    /admin/exports/schedules/:id/logs
│   ├── CsvExportController                  POST   /admin/exports/csv
│   ├── ScheduledExportScheduler             @Cron('*/1 * * * *') 扫描待执行导出
│   ├── scheduled_export.entity.ts
│   └── scheduled_export_log.entity.ts
│
├── CaseModule ───────────────── 扩展: 新增 CaseRecommendationService, CaseTagService, CommentVoteService
│   ├── CaseController (扩展)                GET    /cases/:id/recommendations
│   │                                        (评论列表新增 vote_count + is_voted)
│   ├── CommentVoteController                POST   /cases/comments/:id/vote
│   ├── TagController                        GET    /tags
│   ├── TagAdminController                   GET    /admin/tags
│   │                                        POST   /admin/tags
│   │                                        PUT    /admin/tags/:id
│   │                                        DELETE /admin/tags/:id
│   │                                        PUT    /admin/cases/:id/tags
│   ├── case_tag.entity.ts
│   ├── case_tag_relation.entity.ts
│   └── comment_vote.entity.ts
│
├── VehicleModule ────────────── 扩展: 新增 UsdzService
│   ├── UsdzController                       POST   /admin/vehicles/models/:id/generate-usdz
│   │                                        GET    /vehicles/models/:id/usdz
│   ├── UsdzConversionProcessor              (Bull consumer: 异步转换)
│   └── usdz_conversion_log.entity.ts
│
├── OfflineModule ────────────── 【P5 新增】
│   ├── OfflineController                    GET    /offline/manifest
│   └── OfflineManifestService               (实时聚合各资源版本信息)
│
├── SchedulerModule ──────────── 扩展: Phase 5 新增定时任务
│   ├── WaitlistExpiryScheduler              @Cron('0 3 * * *')   候补过期清理
│   ├── HeatmapCacheScheduler                @Cron('0 * * * *')   热力图缓存刷新
│   ├── RecommendationPrecomputeScheduler    @Cron('0 2 * * *')   热门案例推荐预计算
│   └── ScheduledExportScheduler             @Cron('*/1 * * * *') 定期报表导出扫描
│
└── QueueModule (Bull) ──────── 扩展: Phase 5 新增队列
    ├── usdz-conversion                       USDZ 模型转换 (并发1, 超时300s)
    └── dashboard-export (扩展)                CSV 导出任务类型扩展
```

---

### P5.18 Phase 5 消息队列扩展

| 队列名称 | 用途 | 并发数 | 超时 | 最大等待 | 重试 |
|----------|------|--------|------|----------|------|
| `usdz-conversion` | USDZ 模型格式转换 | 1 | 300s | 20 | 1次 |
| `dashboard-export` (扩展) | 新增 CSV 导出任务类型 | 2 (不变) | 300s | 50 (不变) | 2次/间隔30s |

**usdz-conversion 队列配置**:
```typescript
export const USDZ_CONVERSION_QUEUE = 'usdz-conversion';

export const UsdzQueueConfig: Bull.QueueOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 1,               // 不自动重试（转换失败大概率是模型问题）
    timeout: 300000,           // 5 分钟超时
    removeOnComplete: 20,
    removeOnFail: 50,
  },
};
```

---

### P5.19 Phase 5 定时任务扩展

| 任务名称 | Cron 表达式 | 分布式锁 | 描述 |
|----------|------------|----------|------|
| `waitlist_expiry` | `0 3 * * *` | `lock:waitlist_expiry` (TTL=300s) | 每日 3:00 清理 7 天前 waiting 状态的候补 → expired |
| `heatmap_cache_refresh` | `0 * * * *` | `lock:heatmap_cache` (TTL=300s) | 每小时刷新最近 30 天热力图缓存 |
| `recommendation_precompute` | `0 2 * * *` | `lock:recommendation_precompute` (TTL=600s) | 每日 2:00 预计算热门案例的推荐结果缓存 |
| `scheduled_export_scanner` | `*/1 * * * *` | `lock:scheduled_export` (TTL=120s) | 每分钟扫描待执行的定期导出配置 |

---

### P5.20 配置管理（Phase 5 新增环境变量）

```bash
# ==================== Phase 5 新增 — 多门店 ====================
STORE_SWITCH_JWT_BLACKLIST_ENABLED=true    # 门店切换时旧 JWT 是否进黑名单

# ==================== Phase 5 新增 — 候补 ====================
WAITLIST_MAX_PER_SLOT=20                   # 每时段候补上限
WAITLIST_EXPIRY_DAYS=7                     # 候补过期天数
WAITLIST_PROMOTION_LOCK_TTL=30             # 提升操作分布式锁 TTL (秒)

# ==================== Phase 5 新增 — 推荐 ====================
RECOMMENDATION_CACHE_TTL=86400             # 案例推荐缓存 TTL (秒, 默认 24h)
RECOMMENDATION_PRECOMPUTE_HOT_THRESHOLD=10 # 热门案例阈值 (like_count >= N 才预计算)

# ==================== Phase 5 新增 — 导出 ====================
SCHEDULED_EXPORT_BATCH_SIZE=5               # 每次 Cron 周期最多处理的导出数
CSV_EXPORT_MAX_ROWS=10000                   # CSV 单次导出行数上限

# ==================== Phase 5 新增 — USDZ ====================
USDZ_CONVERSION_TIMEOUT_MS=300000           # USDZ 转换超时 (ms)
USDZ_CONVERSION_TOOL=gltf-to-usdz           # 转换工具: gltf-to-usdz | usdzconvert

# ==================== Phase 5 新增 — 离线 ====================
OFFLINE_MANIFEST_MAX_CASES=50               # 离线清单中最多包含的案例数
```

---

### P5.21 技术决策与 Trade-off 汇总（Phase 5）

| 决策 | 选择 | 备选方案 | 理由 |
|------|------|----------|------|
| 多门店模型 | `staff_store` 中间表 + `current_store_id` | staff JSON 数组存储 store_ids | 中间表可查询、可索引、支持软删除和角色。JSON 数组无法高效检索"某门店有哪些店员" |
| JWT 门店切换 | Redis 黑名单 (SETEX TTL) | 缩短 JWT 有效期至 5 分钟 + Refresh Token | 黑名单免去 Refresh Token 的复杂度。TTL 自动过期零泄漏。Redis 不可用时降级为拒绝切换 |
| 候补队列实现 | 数据库 position 列 + 分布式锁 | Redis List (BRPOP/BLPUSH) | 候补数据需要持久化（>7天），数据库更可靠。`position` 列加 `FOR UPDATE` 配合分布式锁保证并发安全 |
| 案例推荐 | 规则混合推荐（品牌+车型+色系+热门） | 协同过滤 (Collaborative Filtering) | Phase 5 数据量不足以支撑有意义的 CF。规则推荐可解释性强，效果可预期。架构预留推荐策略接口便于未来切换 |
| 标签系统 | 中间表 `case_tag_relation` | case JSON 字段 `tags` | 中间表支持按标签反向查案例 AND 逻辑，JSON 字段实现 AND 筛选复杂且不可索引 |
| CSV 导出 | 流式写入 + Bull 队列异步 | 同步生成返回下载链接 | 10,000 行 CSV 查询+格式化耗时 5-15s，异步队列避免 HTTP 超时。流式写入控制内存 |
| USDZ 转换 | CLI 子进程异步队列 | Node.js 原生库 (如 three.js 导出) | glTF→USDZ 转换是计算密集型任务，CLI 子进程不阻塞 Node.js event loop。队列限并发=1 避免 CPU 争抢 |
| 离线清单 | 实时聚合 + since 增量 | 预先生成全量 JSON 文件存 OSS | 实时聚合确保 version 号始终最新。增量同步减少传输量。manifest 本身数据量小（<100KB），无需缓存 |
| 门店热力图 | 城市级聚合为主，网格级 fallback | 纯网格聚合 (H3/Geohash) | 多数客户数据仅有城市信息无精确坐标，城市级聚合已满足需求。网格聚合作为可选增强 |
| 看板下钻 | 预定义 (metric_type, group_by) 组合路由 | 通用 OLAP 查询引擎 (如 Cube.js) | Phase 5 仅 4 种下钻维度，预定义路由方案简单可维护。未来数据量增大可接入 OLAP 引擎 |

---

### P5.22 不做的事（Phase 5 排除项）

| 事项 | 原因 |
|------|------|
| 门店之间的库存/物料调拨 | 连锁门店库存管理系统复杂度高，放后续版本 |
| 多门店统一权限管理（RBAC 细粒度） | 当前权限模型（staff/manager/admin）已满足需求，细粒度 RBAC 待规模化后建设 |
| 门店排班/考勤系统 | 属于人力资源系统范畴，非 WrapLab 核心场景 |
| 候补的"顺延多时段"自动匹配 | 交互和算法复杂度高，Phase 5 仅做单时段手动候补 |
| 案例推荐的多模态分析（基于图片相似度） | 算法复杂度高，规则推荐已够用 |
| AI 生图的多风格定制（客户照片融合改色效果） | 需额外图像分割+融合模型，成本和技术门槛较高 |
| 离线模式的全量数据同步 | 仅做最近浏览内容缓存，不做全量同步 |
| 评论 "踩" / 点踩功能 | 仅做上赞，保持社区调性正面 |
| USDZ 的 Apple Vision Pro 空间视频格式 | 设备普及率极低，优先支持 iPhone/iPad |
| 案例视频式预览的自动生成（服务端渲染视频） | 客户端用 Canvas 帧动画模拟，服务端不做视频合成 |
| 多门店实时数据大屏 | 为独立可视化项目，通过 BI 导出对接 |
| 地理编码大批量处理 | 依赖第三方地图 API，有调用配额。Phase 5 仅做按需编码+缓存 |

---

*架构版本：v5.0 (Phase 5 新增)*  
*编写角色：🏛️ Software Architect*  
*更新日期：2026-07-22*  
