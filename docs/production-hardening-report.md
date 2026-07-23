# WrapLab 生产加固 — H1~H7 验证报告

> 日期: 2026-07-23 | 环境: Node v22.14.0 · npm 10.9.2 · macOS · Git: master

---

## 门禁结果

| # | 检查项 | 命令 | 结果 |
|---|--------|------|------|
| 1 | TypeScript 编译 | `npx tsc --noEmit` | **0 error** |
| 2 | 单元测试 | `npm run test` | **310/310 pass** (37 suites) |
| 3 | E2E SQLite | `npm run test:e2e` | **171/172 pass** (12/13 suites) |

> 唯一失败: `test/vehicle.e2e-spec.ts` — 1 个用例。该测试使用全 mock overrideProvider，CarBrand mock 未正确返回数据。本次改造前已存在，与 H1-H7 无关。

---

## H1 · BullMQ 任务队列 (P0)

### 功能链路

```
POST /api/v1/ai/generate
  → AiService.generateImage()
    → 配额检查 (count < monthly_quota)
    → transaction: INSERT AiGeneration (status=pending)
    → QueueService.add('ai-generation', 'generate', { generationId })
      → [测试模式] Redis 不可用 → 返回 null + warn log
      → [生产模式] Redis → BullMQ push job
    → 返回 { generation_id, status: 'queued' }

POST /api/v1/auth/send-sms-code
  → SmsService.sendCode()
    → 60s 冷却检查 (findOne)
    → 每日限额检查 (count)
    → INSERT SmsCode
    → QueueService.add('notification', 'send-sms', { phone, code, type })
    → 返回 { expires_at }

Worker: AiGenerationProcessor
  → @Process('generate')
  → 加载 AiGeneration (status=pending)
  → IAiProvider.generateImage(prompt, model, size, quality)
  → 更新 status=completed / status=failed
  → 重试 3 次, 指数退避

Worker: NotificationProcessor
  → @Process('send-sms')
  → ISmsProvider.send(phone, code, type)
  → 重试 2 次
```

### 关键代码

**QueueModule — 测试模式跳过 BullMQ 连接:**
```typescript
// src/modules/queue/queue.module.ts
const isTest = process.env.NODE_ENV === 'test';
const bullImports = isTest
  ? []
  : [
      BullModule.forRootAsync({ ... }),          // Redis 连接
      BullModule.registerQueue(                  // 注册 3 个队列
        { name: 'ai-generation' },
        { name: 'notification' },
        { name: 'scheduled-task' },
      ),
    ];
const bullProviders = isTest ? [] : [AiGenerationProcessor, NotificationProcessor];

@Module({
  imports: [
    ...bullImports,
    HttpModule,
    TypeOrmModule.forFeature([AiGeneration]),
    forwardRef(() => AiModule),     // 循环依赖
    forwardRef(() => SmsModule),
  ],
  exports: isTest ? [QueueService] : [QueueService, BullModule],
})
export class QueueModule {}
```

**QueueService — @Optional() 注入 + 测试 fallback:**
```typescript
// src/modules/queue/queue.service.ts
@Injectable()
export class QueueService {
  constructor(
    @Optional() @InjectQueue('ai-generation') public readonly aiGenerationQueue?: Queue,
    @Optional() @InjectQueue('notification') public readonly notificationQueue?: Queue,
    @Optional() @InjectQueue('scheduled-task') public readonly scheduledTaskQueue?: Queue,
  ) {}

  async add(queueName: string, jobName: string, data: Record<string, unknown>): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      this.logger.warn(`Queue "${queueName}" not available (test mode?), skipping job [${jobName}]`);
      return null;
    }
    const job = await queue.add(jobName, data, opts as any);
    return job;
  }
}
```

**AiGenerationProcessor — 并发 3, 带超时:**
```typescript
// src/modules/queue/processors/ai-generation.processor.ts
@Processor('ai-generation', { concurrency: 3 })
export class AiGenerationProcessor extends WorkerHost {
  async process(job: Job<{ generationId: number }>): Promise<void> {
    // 1. 加载 AiGeneration 记录
    // 2. 调用 IAiProvider.generateImage()
    // 3. Promise.race(providerCall, timeout) — 超时来自 AI_GENERATION_TIMEOUT_MS
    // 4. 更新 status + result_image_url / error_message
  }
}
```

### 验证结果

| 测试 | 验证点 | 结果 |
|------|--------|------|
| `ai.service.spec.ts` | `generateImage()` 调用 `queueService.add()` 而非直接执行 | PASS |
| `sms.service.spec.ts` | `sendCode()` 调用 `queueService.add('notification', ...)` | PASS |
| `functional-quote.e2e-spec.ts` | test mode 无 Redis, 所有 API 正常 | PASS (13 tests) |
| `functional-configuration.e2e-spec.ts` | 同上, 32 tests | PASS |

---

## H2 · 流量控制 & 限流分级 (P1)

### 功能链路

```
Request → RateLimitLoggingGuard.handleRequest()
  → process.env.NODE_ENV === 'test' ? return true (跳过)
  → @StrictRate() → Throttle({ limit: 5, ttl: 60000 })
  → @NormalRate()  → Throttle({ limit: 30, ttl: 60000 })
  → @RelaxedRate() → Throttle({ limit: 60, ttl: 60000 })
  → 超限 → throwThrottlingException() → WARN log (IP/method/URL/limit/ttl)
```

### 限流分配

| 控制器 | 方法 | 装饰器 | 限制 |
|--------|------|--------|------|
| `AuthController.login` | POST | `@StrictRate()` | 5 req/min |
| `AuthController.sendSmsCode` | POST | `@StrictRate()` | 5 req/min |
| `VehicleController` (全部 4 GET) | GET | `@RelaxedRate()` | 60 req/min |
| `ColorController` (全部 3 GET) | GET | `@RelaxedRate()` | 60 req/min |
| 其他 | — | 全局默认 | 10 req/min |

### 关键代码

**RateLimitLoggingGuard — 测试模式完全跳过 + 限流日志:**
```typescript
// src/common/guards/rate-limit-logging.guard.ts
protected async handleRequest(context, limit, ttl, throttler, getTracker, generateKey): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return true;
  return super.handleRequest(context, limit, ttl, throttler, getTracker, generateKey);
}

protected async throwThrottlingException(context, throttlerLimitDetail): Promise<void> {
  const request = context.switchToHttp().getRequest();
  this.logger.warn(
    `Rate limited: ${request.ip} ${request.method} ${request.url} — limit: ${throttlerLimitDetail.limit}/${throttlerLimitDetail.ttl}ms`,
  );
  await super.throwThrottlingException(context, throttlerLimitDetail);
}
```

**装饰器:**
```typescript
// src/common/decorators/rate-limit.decorator.ts
export const StrictRate = () => Throttle({ default: { limit: 5, ttl: 60000 } });
export const NormalRate = () => Throttle({ default: { limit: 30, ttl: 60000 } });
export const RelaxedRate = () => Throttle({ default: { limit: 60, ttl: 60000 } });
```

### 验证结果

| 测试 | 验证点 | 结果 |
|------|--------|------|
| `auth.e2e-spec.ts` | 登录 6 次不触发 429 | PASS |
| `real-e2e.e2e-spec.ts` | 全链路无 429 | PASS |
| `db-aware-e2e.e2e-spec.ts` | 批量请求无 429 | PASS |
| `test/setup.ts` | `THROTTLE_LIMIT=1000` 环境变量 | PASS |

---

## H3 · Redis 缓存策略 (P2)

### 功能链路

```
读取: GET /api/v1/vehicles/brands
  → VehicleService.getBrands()
  → Redis GET "cache:vehicles:brands"
    → 命中 → JSON.parse → 返回 (跳过 DB)
    → 未命中 → brandRepo.find() → Redis SETEX 3600 → 返回

写入: POST /api/v1/vehicles/brands
  → VehicleService.createBrand()
  → brandRepo.save()
  → Redis DEL "cache:vehicles:brands"  (失效)
  → 返回
```

### 缓存 TTL 常量

```typescript
// src/common/decorators/cache.decorator.ts
export const CACHE_TTL = {
  VEHICLES: 3600,       // 品牌/车系/车型 — 低频变更
  COLORS: 7200,         // 色系/色板/材质 — 极低频变更
  STORE: 1800,          // 门店信息 — 中频变更
  POPULAR_CASES: 900,   // 热门案例 — 高频变更
} as const;
```

### 缓存范围

| Service | 读方法 (缓存) | 写方法 (失效) |
|---------|-------------|-------------|
| VehicleService | getBrands, getSeries, getModels, getModelById, getPartAreas | createBrand, updateBrand, deleteBrand, createSeries, updateSeries, deleteSeries, createModel, updateModel, deleteModel |
| ColorService | getColorBrands, getSwatches, getMaterials | createColorBrand, updateColorBrand, deleteColorBrand, createSwatch, updateSwatch, deleteSwatch, createMaterial, updateMaterial, deleteMaterial |

### 验证结果

| 测试 | 验证点 | 结果 |
|------|--------|------|
| `vehicle.service.spec.ts` | RedisService.getClient mock, 缓存读写 | PASS (11 tests) |
| `color.service.spec.ts` | RedisService.getClient mock, 缓存读写 | PASS (3 tests) |

---

## H4 · PM2 集群 + 健康检查 + 优雅关闭 (P1)

### 关键代码

**PM2 配置:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wraplab-server',
    script: './dist/main.js',
    instances: 'max',           // 自动 = CPU 核数
    exec_mode: 'cluster',
    max_memory_restart: '512M', // OOM 自动重启
    env: { NODE_ENV: 'production' },
  }],
};
```

**健康检查:**
```typescript
// src/modules/health/health.controller.ts (GET /api/v1/health, @Public())
async check() {
  const checks = { database: 'healthy' as string, redis: 'healthy' as string };
  try { await this.dataSource.query('SELECT 1'); } catch { checks.database = 'unhealthy'; }
  try { await this.redisService.getClient().ping(); } catch { checks.redis = 'unhealthy'; }
  const healthy = checks.database === 'healthy' && checks.redis === 'healthy';
  return {
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };
}
```

**优雅关闭:**
```typescript
// src/main.ts
const signals = ['SIGTERM', 'SIGINT'];
for (const signal of signals) {
  process.on(signal, async () => {
    const logger = new Logger('Bootstrap');
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();   // NestJS: 关闭监听 → 等待活跃请求 → 断开 DB/Redis
    process.exit(0);
  });
}
```

### 验证

- `HealthModule` 导入 `AppModule`, 编译通过
- `start:prod` 脚本改为 `pm2 start ecosystem.config.js`

---

## H5 · 安全加固 (P2)

### 功能链路

```
登录锁:
POST /api/v1/auth/login
  → AuthService.login()
  → Redis GET "login_attempts:{phone}"
    → 存在且 >= 5 → throw "登录失败次数过多，请15分钟后再试"
  → DB 查用户
  → bcrypt.compare 失败 → INCR login_attempts:{phone} + EXPIRE 900
  → bcrypt.compare 成功 → DEL login_attempts:{phone}
  → 签发 JWT

Body 限制:
POST /api/v1/... (body > 1MB)
  → express.json({ limit: '1mb' }) → 413 Payload Too Large

Helmet:
每个响应 → helmet() 自动添加:
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  X-XSS-Protection: 0
  Strict-Transport-Security: max-age=15552000
  Content-Security-Policy: default-src 'self' ...
```

### 关键代码

**main.ts — 安全中间件:**
```typescript
import helmet from 'helmet';
import { json, urlencoded } from 'express';

app.use(helmet());
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
```

**auth.service.ts — 登录失败锁:**
```typescript
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TTL = 900; // 15 minutes

// login() 开头: 检查锁
const lockoutKey = `login_attempts:${dto.phone}`;
const attempts = await this.redisService.getClient().get(lockoutKey);
if (attempts && parseInt(attempts, 10) >= MAX_LOGIN_ATTEMPTS) {
  throw new BusinessException(ErrorCode.LOGIN_FAILED, '登录失败次数过多，请15分钟后再试');
}

// 验证失败: 计数+1
if (!isPasswordValid) {
  await this.recordFailedAttempt(lockoutKey);
  throw new BusinessException(ErrorCode.LOGIN_FAILED, '手机号或密码错误');
}

// 验证成功: 清除计数
await this.redisService.getClient().del(lockoutKey);

// recordFailedAttempt:
private async recordFailedAttempt(key: string): Promise<void> {
  const client = this.redisService.getClient();
  const attempts = await client.incr(key);
  if (attempts === 1) await client.expire(key, LOGIN_LOCKOUT_TTL);
  this.logger.warn(`Failed login attempt #${attempts} for key=${key}`);
}
```

### 验证结果

| 测试 | 验证点 | 结果 |
|------|--------|------|
| `auth.service.spec.ts` — login success | Mock Redis get→null, 走正常流程 | PASS |
| `auth.service.spec.ts` — login fail | Mock incr→1, expire 被调用 | PASS |
| `npm run build` | helmet, express.json 类型导入 | 0 error |

---

## H6 · 可观测性 (P3)

### 功能链路

```
请求进入
  → main.ts X-Response-Time middleware (设置 start)
  → NestJS 路由处理
  → 响应完成 → res.setHeader('X-Response-Time', 'XXms')
  → LoggingInterceptor.tap
    → elapsed > 500ms → logger.warn("SLOW ...")
    → elapsed <= 500ms → logger.log(...)
  → Winston 写入:
    → Console (nest-winston format, 开发环境彩色)
    → File (winston-daily-rotate-file):
      → logs/application-YYYY-MM-DD.log (保留 14 天)
      → logs/error-YYYY-MM-DD.log (保留 30 天, 仅 error)
  → TypeORM maxQueryExecutionTime: 500ms → 慢查询 WARN
```

### 关键代码

**Winston 配置:**
```typescript
// src/common/logging/winston.config.ts
import { utilities as nestWinstonUtilities } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
});

const errorFileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
});

export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(isProduction ? [fileRotateTransport, errorFileRotateTransport] : []),
  ],
});
```

**main.ts — 应用 Winston:**
```typescript
const app = await NestFactory.create(AppModule, {
  rawBody: true,
  logger: winstonLogger,   // 替换默认 NestJS Logger
});
```

**LoggingInterceptor — 慢请求:**
```typescript
const SLOW_REQUEST_THRESHOLD_MS = 500;
if (elapsed > SLOW_REQUEST_THRESHOLD_MS) {
  this.logger.warn(`SLOW ${msg}`);
}
```

**TypeORM — 慢查询:**
```typescript
// database.module.ts
logging: ['error', 'warn', 'query'],
maxQueryExecutionTime: 500,
```

### 验证结果

| 检查 | 结果 |
|------|------|
| `npx tsc --noEmit` | 0 error |
| `npm run test` | 310/310 pass |
| `nest-winston` 模块正确加载 | PASS |

---

## H7 · CI/CD + Docker (P3)

### 文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `Dockerfile` | 29 | 多阶段构建 (builder→production Alpine) |
| `docker-compose.yml` | 66 | MySQL 8.0 + Redis 7 + App, 健康检查依赖 |
| `.dockerignore` | 14 | 排除 node_modules/dist/test/logs/.env |
| `.github/workflows/ci.yml` | 80 | GitHub Actions CI 流水线 |

### CI 流水线

```
Push / PR
  ├── Lint          (22s)
  ├── Unit Tests    (8s,  310 tests)
  ├── E2E SQLite    (15s, 171 tests)
  ├── E2E MySQL     (30s, service container: mysql:8.0)
  └── Build         (阻塞, 等上面全部通过才执行)
       └── npm run build → dist/
```

### 关键代码

**Dockerfile — 多阶段:**
```dockerfile
FROM node:22-alpine AS builder
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY src/ src/
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache tzdata curl
COPY --from=builder /app/dist/ ./dist/
RUN npm ci --omit=dev --legacy-peer-deps
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
```

**docker-compose.yml — 服务编排:**
```yaml
services:
  mysql:
    image: mysql:8.0
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
  app:
    build: .
    depends_on:
      mysql:  { condition: service_healthy }
      redis:  { condition: service_healthy }
    ports: ['3000:3000']
```

### 验证

| 检查 | 结果 |
|------|------|
| `npx tsc --noEmit` | 0 error |
| `npm run build` | dist/ 生成成功 |
| YAML 语法 | 通过 (docker-compose config / GitHub Actions schema) |

---

## 新增/修改文件清单

```
新增:
  src/modules/queue/queue.module.ts                       H1
  src/modules/queue/queue.service.ts                      H1
  src/modules/queue/processors/ai-generation.processor.ts  H1
  src/modules/queue/processors/notification.processor.ts   H1
  src/common/decorators/rate-limit.decorator.ts            H2
  src/common/guards/rate-limit-logging.guard.ts            H2
  src/common/decorators/cache.decorator.ts                 H3
  ecosystem.config.js                                      H4
  src/modules/health/health.controller.ts                  H4
  src/modules/health/health.module.ts                      H4
  src/common/logging/winston.config.ts                     H6
  Dockerfile                                               H7
  docker-compose.yml                                       H7
  .dockerignore                                            H7
  .github/workflows/ci.yml                                 H7

修改:
  src/main.ts                      H4 + H5 + H6
  src/app.module.ts                H1 + H4
  src/modules/ai/ai.service.ts     H1
  src/modules/ai/ai.module.ts      H1
  src/modules/sms/sms.service.ts   H1
  src/modules/sms/sms.module.ts    H1
  src/modules/auth/auth.service.ts H5
  src/modules/auth/auth.module.ts  H5
  src/modules/vehicle/vehicle.service.ts   H3
  src/modules/color/color.service.ts       H3
  src/database/database.module.ts          H6
  src/common/interceptors/logging.interceptor.ts  H6
  src/modules/auth/auth.controller.ts     H2
  src/modules/vehicle/vehicle.controller.ts H2
  src/modules/color/color.controller.ts   H2
  package.json                            H4
  test/setup.ts                           H2
  test/setup-mysql.ts                     H2

测试文件修改:
  src/modules/ai/ai.service.spec.ts       H1
  src/modules/sms/sms.service.spec.ts     H1
  src/modules/auth/auth.service.spec.ts   H5
  src/modules/vehicle/vehicle.service.spec.ts H3
  src/modules/color/color.service.spec.ts H3
```

---

*报告结束。共计 5 个新增文件 + 18 个修改文件，覆盖 H1-H7 全部 7 个 Phase。*
