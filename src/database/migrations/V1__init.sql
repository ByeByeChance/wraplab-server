-- ============================================================
-- WrapLab Phase 1 MVP — Initial Schema
-- Engine: InnoDB / Charset: utf8mb4 / COLLATE: utf8mb4_unicode_ci
-- ============================================================

-- ============================================================
-- 1. 车型体系（全局共享，无 store_id）
-- ============================================================

CREATE TABLE `car_brand` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100)    NOT NULL,
  `logo`          VARCHAR(500)    NULL,
  `sort_order`    INT             NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='汽车品牌';

CREATE TABLE `car_series` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `brand_id`      BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(100)    NOT NULL,
  `year_start`    INT             NULL,
  `year_end`      INT             NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_brand_id` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='车系';

CREATE TABLE `car_model` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `series_id`     BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(100)    NOT NULL,
  `year`          INT             NOT NULL,
  `body_type`     VARCHAR(50)     NULL,
  `model_3d_url`  VARCHAR(500)    NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_series_id` (`series_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='车型';

-- ============================================================
-- 2. 色卡体系（全局共享，无 store_id）
-- ============================================================

CREATE TABLE `color_brand` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(100)    NOT NULL,
  `description`   VARCHAR(500)    NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='色卡品牌';

CREATE TABLE `color_swatch` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `brand_id`      BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(100)    NOT NULL,
  `hex`           VARCHAR(7)      NOT NULL,
  `rgb_r`         TINYINT UNSIGNED NOT NULL,
  `rgb_g`         TINYINT UNSIGNED NOT NULL,
  `rgb_b`         TINYINT UNSIGNED NOT NULL,
  `price_per_m2`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_brand_id` (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='颜色';

CREATE TABLE `material` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`             VARCHAR(100)    NOT NULL,
  `description`      VARCHAR(500)    NULL,
  `price_multiplier` DECIMAL(4,2)    NOT NULL DEFAULT 1.00,
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材质';

-- ============================================================
-- 3. 门店（自身即门店，无需 store_id）
-- ============================================================

CREATE TABLE `store` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(200)    NOT NULL,
  `address`       VARCHAR(500)    NULL,
  `phone`         VARCHAR(20)     NULL,
  `logo`          VARCHAR(500)    NULL,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店';

-- ============================================================
-- 4. 业务数据（带 store_id 多租户）
-- ============================================================

CREATE TABLE `staff` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`      BIGINT UNSIGNED NOT NULL,
  `name`          VARCHAR(100)    NOT NULL,
  `phone`         VARCHAR(20)     NOT NULL,
  `password_hash` VARCHAR(255)    NOT NULL,
  `role`          ENUM('admin','manager','staff') NOT NULL DEFAULT 'staff',
  `avatar`        VARCHAR(500)    NULL,
  `status`        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  `token_version` INT UNSIGNED    NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店员';

CREATE TABLE `configuration` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`        BIGINT UNSIGNED NOT NULL,
  `model_id`        BIGINT UNSIGNED NOT NULL,
  `name`            VARCHAR(200)    NULL,
  `note`            TEXT            NULL,
  `customer_name`   VARCHAR(100)    NULL,
  `customer_phone`  VARCHAR(20)     NULL,
  `status`          ENUM('draft','confirmed','quoted') NOT NULL DEFAULT 'draft',
  `staff_id`        BIGINT UNSIGNED NOT NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`      DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_status` (`store_id`, `status`),
  KEY `idx_store_created` (`store_id`, `created_at`),
  KEY `idx_staff_id` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='改色方案';

CREATE TABLE `part_color` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `configuration_id`  BIGINT UNSIGNED NOT NULL,
  `part_code`         VARCHAR(20)     NOT NULL,
  `color_swatch_id`   BIGINT UNSIGNED NOT NULL,
  `material_id`       BIGINT UNSIGNED NOT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_config_id` (`configuration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部件颜色配置';

CREATE TABLE `quote` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `configuration_id`  BIGINT UNSIGNED NOT NULL,
  `total_price`       DECIMAL(12,2)   NOT NULL,
  `status`            ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  `staff_id`          BIGINT UNSIGNED NOT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_created` (`store_id`, `created_at`),
  KEY `idx_config_id` (`configuration_id`),
  KEY `idx_staff_id` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报价单';
