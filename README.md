# WrapLab Server — 车衣改色 SaaS 后端 API

基于 NestJS + TypeORM + MySQL + Redis 构建的后端服务，为 WrapLab 小程序和后台管理提供 RESTful API。

## 核心模块

| 模块 | 功能 |
|------|------|
| 车辆管理 | 品牌/车系/车型/部件面积 CRUD |
| 颜色管理 | 色系/色板/材质 CRUD |
| 选色配置 | 3D 部件配色方案 |
| AI 生图 | BullMQ 异步任务队列（DALL-E） |
| 短信验证 | 阿里云/腾讯云 SMS + 60s 冷却 + 日限额 |
| 报价管理 | 选色 → 计算面积 → 报价单 |
| 案例广场 | 案例发布/标签/点赞/推荐 |
| 预约系统 | 预约创建/排队/时间槽容量 |
| 门店管理 | 多门店/多角色 RBAC/LBS 附近门店 |
| 数据看板 | 热力图/门店对比/CSV 导出 |
| WebSocket | 3D 预览实时同步 |

## 技术栈

| 层 | 选型 |
|---|------|
| 框架 | NestJS 10 |
| ORM | TypeORM (MySQL 8.0) |
| 缓存 | Redis (ioredis) |
| 任务队列 | BullMQ + Redis |
| 限流 | @nestjs/throttler (三级分级) |
| 日志 | Winston + Daily Rotate File |
| 部署 | PM2 Cluster + Docker |

## 生产加固（H1-H7）

- **H1** BullMQ 任务队列（AI 生图 + 短信异步发送）
- **H2** 流量控制分级（Strict 5/min / Normal 30/min / Relaxed 60/min）
- **H3** Redis Cache-Aside（车辆/颜色缓存，TTL 900-7200s）
- **H4** PM2 集群 + 健康检查 + 优雅关闭
- **H5** Helmet 安全头 + Body 1MB 限制 + 登录失败锁（Redis，5次/15min）
- **H6** Winston 日志轮转 + X-Response-Time + 慢请求/慢查询告警（>500ms）
- **H7** Docker 多阶段构建 + docker-compose + GitHub Actions CI

## 快速开始

```bash
# 一键部署（建库 + 迁移 + 验证）
npm run db:setup

# 开发模式
npm run start:dev

# 运行测试
npm run test              # 单元测试 (310 tests)
npm run test:e2e          # E2E SQLite (171 tests)
npm run test:e2e:mysql    # E2E MySQL

# 构建
npm run build
```

## 环境变量

```bash
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=wraplab
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_secret
THROTTLE_LIMIT=10
```
