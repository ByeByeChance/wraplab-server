#!/usr/bin/env bash
# ============================================================
# WrapLab Server — 一键部署脚本
# Usage:
#   ./scripts/setup.sh            # 建库 + 迁移 + 验证
#   ./scripts/setup.sh --seed     # 建库 + 迁移 + 种子数据 + 验证
#   ./scripts/setup.sh --check    # 仅验证（不建库不迁移）
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ---- 颜色 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ---- 加载 .env ----
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USERNAME:-root}"
DB_PASS="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-wraplab}"

MYSQL_CMD="mysql -u ${DB_USER} -p${DB_PASS} -h ${DB_HOST} -P ${DB_PORT} --protocol=TCP"

echo "=========================================="
echo "  WrapLab Server — 一键部署"
echo "=========================================="
echo "  DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# ---- Step 1: 检查 MySQL 连接 ----
echo "[1/4] 检查 MySQL 连接..."
if ! ${MYSQL_CMD} -e "SELECT 1" &>/dev/null; then
  err "无法连接 MySQL，请检查 .env 中的 DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD"
fi
log "MySQL 连接正常"

# ---- Step 2: 建库 ----
if [ "${1:-}" != "--check" ]; then
  echo "[2/4] 创建数据库 ${DB_NAME}..."
  ${MYSQL_CMD} -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  log "数据库就绪"

  # ---- Step 3: 迁移 ----
  echo "[3/4] 执行数据迁移..."
  MIGRATION_COUNT=0
  for f in src/database/migrations/V*.sql; do
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    ${MYSQL_CMD} "${DB_NAME}" < "$f" || err "迁移失败: $(basename $f)"
    echo "       $(basename $f)"
  done
  log "全部 ${MIGRATION_COUNT} 个迁移脚本执行成功"

  # ---- Step 4: 种子数据 (可选) ----
  if [ "${1:-}" = "--seed" ]; then
    echo "[4/4] 种子数据..."
    if [ -f src/database/seeds/seed.ts ]; then
      npx ts-node -P tsconfig.json -r tsconfig-paths/register src/database/seeds/seed.ts || warn "种子数据失败（可手动执行）"
    else
      warn "无种子数据脚本，跳过 (创建 src/database/seeds/seed.ts 以添加种子数据)"
    fi
  else
    echo "[4/4] 种子数据: 跳过 (使用 --seed 参数启用)"
  fi
fi

# ---- 验证 ----
echo ""
echo "=========================================="
echo "  验证: 全链路 E2E 测试"
echo "=========================================="
echo ""

# 运行验证脚本
npx ts-node -P tsconfig.json -r tsconfig-paths/register test/verify-flows.ts

EXIT_CODE=$?
echo ""
if [ $EXIT_CODE -eq 0 ]; then
  log "部署验证通过！"
  echo ""
  echo "  启动开发服务器:"
  echo "    npm run start:dev"
  echo ""
  echo "  可用端点:"
  echo "    小程序 API:  http://localhost:3000/api/v1"
  echo "    后台管理 API: http://localhost:3000/api/v1/admin"
else
  err "验证失败，请检查日志"
fi
