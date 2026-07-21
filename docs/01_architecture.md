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
