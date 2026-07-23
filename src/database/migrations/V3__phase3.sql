-- ============================================================
-- WrapLab Phase 3 — Store Location, Appointment, Campaign, Customer
-- Engine: InnoDB / Charset: utf8mb4 / COLLATE: utf8mb4_unicode_ci
-- ============================================================

-- ============================================================
-- 1. 门店位置（1:1 with store）
-- ============================================================

CREATE TABLE `store_location` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`      BIGINT UNSIGNED NOT NULL,
  `lat`           DECIMAL(10,7)   NOT NULL,
  `lng`           DECIMAL(10,7)   NOT NULL,
  `address`       VARCHAR(500)    NULL,
  `province`      VARCHAR(100)    NULL,
  `city`          VARCHAR(100)    NULL,
  `district`      VARCHAR(100)    NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_id` (`store_id`),
  KEY `idx_lat_lng` (`lat`, `lng`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店位置';

-- ============================================================
-- 2. 预约（多租户）
-- ============================================================

CREATE TABLE `appointment` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `customer_id`       BIGINT UNSIGNED NULL,
  `customer_name`     VARCHAR(100)    NOT NULL,
  `customer_phone`    VARCHAR(20)     NOT NULL,
  `service_type`      VARCHAR(50)     NOT NULL,
  `appointment_date`  DATE            NOT NULL,
  `time_slot`         ENUM('MORNING','AFTERNOON','EVENING') NOT NULL,
  `status`            ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  `vehicle_info`      JSON            NULL,
  `remark`            VARCHAR(500)    NULL,
  `cancel_reason`     VARCHAR(500)    NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_date` (`store_id`, `appointment_date`),
  KEY `idx_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预约';

-- ============================================================
-- 3. 营销活动
-- ============================================================

CREATE TABLE `campaign` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(200)    NOT NULL,
  `type`              ENUM('PERCENTAGE','FIXED_AMOUNT','GIFT') NOT NULL,
  `discount_value`    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `min_amount`        DECIMAL(12,2)   NULL,
  `gift_name`         VARCHAR(200)    NULL,
  `target_store_ids`  JSON            NULL,
  `new_customer_only` TINYINT(1)      NOT NULL DEFAULT 0,
  `start_time`        DATETIME        NOT NULL,
  `end_time`          DATETIME        NOT NULL,
  `status`            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_time` (`status`, `start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销活动';

-- ============================================================
-- 4. 营销活动领取记录
-- ============================================================

CREATE TABLE `campaign_claim` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id`       BIGINT UNSIGNED NOT NULL,
  `quote_id`          BIGINT UNSIGNED NOT NULL,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `discount_amount`   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_quote_campaign` (`quote_id`, `campaign_id`),
  KEY `idx_campaign_id` (`campaign_id`),
  KEY `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='营销活动领取记录';

-- ============================================================
-- 5. 客户（多租户）
-- ============================================================

CREATE TABLE `customer` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`      BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(100)    NOT NULL,
  `phone`         VARCHAR(20)     NOT NULL,
  `source`        ENUM('appointment','quote','import') NOT NULL DEFAULT 'appointment',
  `total_orders`  INT             NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_phone` (`store_id`, `phone`),
  KEY `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户';

-- ============================================================
-- 6. Quote 扩展 — 营销活动 + 状态机
-- ============================================================

ALTER TABLE `quote`
  ADD COLUMN `campaign_id`    BIGINT UNSIGNED NULL AFTER `total_price`,
  ADD COLUMN `discount_amount` DECIMAL(12,2)   NOT NULL DEFAULT 0.00 AFTER `campaign_id`,
  ADD COLUMN `final_price`    DECIMAL(12,2)   NULL AFTER `discount_amount`,
  MODIFY COLUMN `status`      ENUM('pending','confirmed','cancelled','submitted','followed_up','closed','expired') NOT NULL DEFAULT 'pending',
  ADD KEY `idx_campaign_id` (`campaign_id`);
