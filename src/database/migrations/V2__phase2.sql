-- ============================================================
-- WrapLab Phase 2 — Case, Favorite, AI, SMS, Parts
-- Engine: InnoDB / Charset: utf8mb4 / COLLATE: utf8mb4_unicode_ci
-- ============================================================

-- ============================================================
-- 1. 车辆部件（全局共享，无 store_id）
-- ============================================================

CREATE TABLE `car_part` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model_id`      BIGINT UNSIGNED NOT NULL,
  `part_code`     VARCHAR(20)     NOT NULL,
  `part_name`     VARCHAR(100)    NOT NULL,
  `area_m2`       DECIMAL(6,2)    NOT NULL DEFAULT 0.00,
  `sort_order`    INT             NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_model_id` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='车辆部件';

-- ============================================================
-- 2. 案例（多租户）
-- ============================================================

CREATE TABLE `case` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `configuration_id`  BIGINT UNSIGNED NOT NULL,
  `title`             VARCHAR(200)    NOT NULL,
  `description`       TEXT            NULL,
  `cover_image_url`   VARCHAR(500)    NULL,
  `images`            JSON            NULL,
  `status`            ENUM('draft','published') NOT NULL DEFAULT 'published',
  `view_count`        INT UNSIGNED    NOT NULL DEFAULT 0,
  `like_count`        INT UNSIGNED    NOT NULL DEFAULT 0,
  `staff_id`          BIGINT UNSIGNED NOT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_store_status` (`store_id`, `status`),
  KEY `idx_store_created` (`store_id`, `created_at`),
  KEY `idx_config_id` (`configuration_id`),
  KEY `idx_staff_id` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例';

-- ============================================================
-- 3. 案例点赞（多租户）
-- ============================================================

CREATE TABLE `case_like` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`      BIGINT UNSIGNED NOT NULL,
  `case_id`       BIGINT UNSIGNED NOT NULL,
  `staff_id`      BIGINT UNSIGNED NULL,
  `anonymous_id`  VARCHAR(64)     NULL,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_staff` (`case_id`, `staff_id`),
  UNIQUE KEY `uk_case_anonymous` (`case_id`, `anonymous_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_case_id` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='案例点赞';

-- ============================================================
-- 4. 收藏（多租户）
-- ============================================================

CREATE TABLE `favorite` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `staff_id`          BIGINT UNSIGNED NOT NULL,
  `configuration_id`  BIGINT UNSIGNED NOT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_staff_id` (`staff_id`),
  KEY `idx_config_id` (`configuration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏';

-- ============================================================
-- 5. AI 生图（多租户）
-- ============================================================

CREATE TABLE `ai_generation` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL,
  `configuration_id`  BIGINT UNSIGNED NOT NULL,
  `prompt_text`       TEXT            NOT NULL,
  `style`             ENUM('scene','studio','outdoor') NOT NULL,
  `status`            ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `result_image_url`  VARCHAR(500)    NULL,
  `error_message`     TEXT            NULL,
  `staff_id`          BIGINT UNSIGNED NOT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_config_id` (`configuration_id`),
  KEY `idx_staff_id` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI生图记录';

-- ============================================================
-- 6. 短信验证码
-- ============================================================

CREATE TABLE `sms_code` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone`         VARCHAR(20)     NOT NULL,
  `code`          VARCHAR(6)      NOT NULL,
  `type`          ENUM('login','verify') NOT NULL,
  `expires_at`    DATETIME        NOT NULL,
  `used`          TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone_type_used` (`phone`, `type`, `used`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短信验证码';

-- ============================================================
-- 7. Staff 扩展 — 微信登录
-- ============================================================

ALTER TABLE `staff` ADD COLUMN `wechat_openid` VARCHAR(100) NULL AFTER `token_version`;
