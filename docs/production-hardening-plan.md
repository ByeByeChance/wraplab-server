# WrapLab Server — 生产环境加固计划

> 当前状态：Phase 5 开发阶段。业务功能基本完整，但生产级加固尚未进行。
> 本文档按优先级排列，每个 Phase 独立交付。

---

## Phase H1: 任务队列（优先级最高）

**现状**：所有操作同步执行，无异步任务处理能力。

**痛楚**：
- AI 生图调用耗时 5-30s，同步等待阻塞请求
- 预约通知短信/模板消息无异步发送能力
- 定时导出报表无后台任务调度
- 无重试机制，失败即丢失

**方案**：BullMQ + Redis

| 队列 | 用途 | 优先级 |
|------|------|--------|
| `ai-generation` | AI 生图异步处理 | high |
| `notification` | 短信/模板消息/邮件 | normal |
| `export` | 定期报表导出 | low |
| `scheduled-task` | 定时任务（清理过期数据等） | low |

**实现步骤**：
1. 安装 `@nestjs/bullmq` + `bullmq`
2. 创建 `QueueModule` 统一管理队列
3. 重构 AI 生图接口：提交任务返回 jobId → 轮询/WebSocket 获取结果
4. `AIGeneration` 实体新增 `job_id` 列追踪任务状态
5. 添加 Bull Board 管理界面（开发/运维用）

```typescript
// 示例：AI 生图队列消费者
@Processor('ai-generation')
export class AiGenerationProcessor {
  @Process('generate')
  async handleGenerate(job: Job<GenerateDto>) {
    // 异步调用 AI API，更新数据库状态
  }
}
```

---

## Phase H2: 流量控制 & 限流

**现状**：仅有基础 `@Throttle` 装饰器，TTL=60s / limit=10，未针对端点差异化。

**方案**：`@nestjs/throttler` + Redis 分布式限流 + 端点分级

| 级别 | 限制 | 适用端点 |
|------|------|---------|
| strict | 5 req/60s | `/auth/login`, `/auth/sms/*` |
| normal | 30 req/60s | `/admin/*` CRUD |
| relaxed | 60 req/60s | `/vehicles/*`, `/colors/*`（读多写少） |

**实现步骤**：
1. 配置 `ThrottlerModule` 使用 Redis 存储（支持多实例）
2. 创建分级装饰器 `@StrictRate()`, `@NormalRate()`, `@RelaxedRate()`
3. 添加限流拦截器，超出限制返回 `429` + Retry-After 头
4. 添加限流监控日志（WARN 级别记录被限流的 IP/用户）

---

## Phase H3: 缓存策略

**现状**：无缓存，每次请求查 MySQL。

**方案**：Redis 多级缓存

| 数据 | 策略 | TTL | 失效策略 |
|------|------|-----|---------|
| 车型/品牌/车系列表 | 全量缓存 | 1h | 管理端更新时主动失效 |
| 色卡  | 全量缓存 | 2h | 管理端更新时主动失效 |
| 门店信息 | 按 ID 缓存 | 30min | 门店信息变更时失效 |
| 案例列表（热门） | LRU + TTL | 15min | 新案例发布时部分失效 |
| JWT 黑名单 | Set 结构 | = token 剩余有效期 | 到期自动清除 |

**实现步骤**：
1. 引入 `cache-manager` + `cache-manager-redis-store`
2. 创建 `@Cacheable()`, `@CacheEvict()` 装饰器
3. 读多写少的数据（车辆、颜色）优先接入
4. 添加缓存命中率监控

---

## Phase H4: 进程管理 & 集群

**现状**：`nest start` 单进程，无法利用多核，崩溃即停服。

**方案**：PM2 Cluster Mode

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wraplab-server',
    script: './dist/main.js',
    instances: 'max',        // 自动 = CPU 核心数
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production' },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    merge_logs: true,
  }]
};
```

**实现步骤**：
1. 安装 `pm2`
2. 创建 `ecosystem.config.js`
3. 添加 `npm run start:prod` → `pm2 start ecosystem.config.js`
4. 添加健康检查端点 `GET /api/v1/health`（返回 DB/Redis 状态）
5. 配置 PM2 的 `watch` 模式（可选，开发环境用）
6. 添加优雅关闭逻辑（`SIGTERM` → 停止接受新请求 → 完成现有请求 → 退出）

---

## Phase H5: 安全加固

### H5.1 输入防护

| 层 | 措施 | 状态 |
|----|------|------|
| DTO 校验 | `class-validator` + `ValidationPipe` | 已有 ✓ |
| SQL 注入 | TypeORM 参数化查询 | 已有 ✓ |
| XSS 防护 | `helmet` 中间件 | **缺失** |
| CORS | `@nestjs/cors` 白名单 | 已有 ✓ |
| 请求体限制 | `body-parser` size limit | **缺失** |

### H5.2 鉴权加固

| 措施 | 说明 |
|------|------|
| 登录失败锁定 | 连续 5 次失败锁定账号 15 分钟 |
| Token 刷新轮转 | refresh token 使用一次后失效（已部分实现） |
| 敏感操作二次验证 | 删除门店/修改权限需验证码 |

**实现步骤**：
1. 安装 `helmet` 并配置 CSP/X-Frame/DNS-Prefetch
2. 配置 `body-parser` 限制 10MB（防止大 payload 攻击）
3. 实现登录失败计数器（Redis `login_failed:{phone}`）
4. 添加请求日志脱敏中间件（手机号/密码不记录到日志）

---

## Phase H6: 可观测性

| 组件 | 选型 |
|------|------|
| 日志 | `winston` + 结构化 JSON 日志 |
| 链路追踪 | `@nestjs/terminus` 健康检查 |
| 性能监控 | Node.js `perf_hooks` + 自定义 middleware |
| 错误追踪 | 统一 `ExceptionFilter`（已有） + error 级别告警 |

**实现步骤**：
1. 安装 `nest-winston`, `winston-daily-rotate-file`
2. 配置按天轮转日志文件，保留 30 天
3. 添加请求耗时 middleware（`X-Response-Time` 头）
4. 慢查询日志（> 500ms 记录 WARN）

---

## Phase H7: CI/CD & 部署

| 项 | 方案 |
|----|------|
| CI | GitHub Actions → lint → test:e2e:mysql → build |
| 数据库迁移 | `npm run db:setup` 集成到 CI |
| 部署 | Docker Compose（MySQL + Redis + App） |
| 静态资源 | OSS CDN（3D 模型 / 图片） |

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY scripts/ ./scripts/
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## 优先级汇总

| 优先级 | Phase | 内容 | 工作量估算 |
|--------|-------|------|-----------|
| **P0 紧急** | H1 | 任务队列 (BullMQ) | 3-5 天 |
| **P1 高** | H2 | 流量控制 | 1-2 天 |
| **P1 高** | H4 | PM2 集群 + 优雅关闭 | 1 天 |
| **P2 中** | H3 | 缓存策略 | 2-3 天 |
| **P2 中** | H5 | 安全加固 | 2-3 天 |
| **P3 低** | H6 | 可观测性 | 2-3 天 |
| **P3 低** | H7 | CI/CD + Docker | 2-3 天 |

---

*本计划待评审通过后，按 P0→P3 顺序逐 Phase 实施。*
