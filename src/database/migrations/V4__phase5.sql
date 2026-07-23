-- ============================================================
-- V4: Phase 5 — Multi-Store & Data Intelligence
-- ============================================================

-- ============================================================
-- P5.1: staff_store junction table
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

-- ============================================================
-- P5.1: staff.current_store_id — 3-step migration
-- ============================================================
ALTER TABLE `staff`
  ADD COLUMN `current_store_id` BIGINT UNSIGNED NULL COMMENT '当前活跃门店 ID'
  AFTER `store_id`;

UPDATE `staff` SET `current_store_id` = `store_id` WHERE `current_store_id` IS NULL;

ALTER TABLE `staff`
  MODIFY `current_store_id` BIGINT UNSIGNED NOT NULL;

-- ============================================================
-- P5.3: store table extensions
-- ============================================================
ALTER TABLE `store`
  ADD COLUMN `location`         JSON          NULL COMMENT '门店地理坐标 { lat, lng }' AFTER `address`,
  ADD COLUMN `business_hours`   JSON          NULL COMMENT '营业时间 { open: "09:00", close: "18:00", off_days: ["Sunday"] }' AFTER `location`,
  ADD COLUMN `services_offered` JSON          NULL COMMENT '服务项目 ["full_wrap","partial_wrap","detail_treatment"]' AFTER `business_hours`,
  ADD COLUMN `capacity_config`  JSON          NULL COMMENT '产能配置 { max_daily_appointments: 10, slot_duration_minutes: 60 }' AFTER `services_offered`,
  ADD COLUMN `region`           VARCHAR(100)  NULL COMMENT '所属区域 (如: 华东区)' AFTER `capacity_config`;

ALTER TABLE `store` ADD UNIQUE KEY `uk_name` (`name`);

-- ============================================================
-- P5.5: appointment_waitlist
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
  `updated_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`                DATETIME        NULL                 COMMENT '软删除标记',
  PRIMARY KEY (`id`),
  INDEX `idx_slot_status` (`time_slot_id`, `appointment_date`, `status`),
  INDEX `idx_phone_date` (`customer_phone`, `appointment_date`),
  INDEX `idx_store_date` (`store_id`, `appointment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预约候补队列表';

-- ============================================================
-- P5.6: service_type_config + store_service_config
-- ============================================================
CREATE TABLE `service_type_config` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_type`      ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') NOT NULL,
  `duration_minutes`  INT UNSIGNED    NOT NULL              COMMENT '默认时长（分钟）',
  `label`             VARCHAR(50)     NOT NULL              COMMENT '显示标签',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_type` (`service_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务类型全局时长配置表';

INSERT INTO `service_type_config` (`service_type`, `duration_minutes`, `label`) VALUES
  ('full_wrap',        480, '全车改色'),
  ('partial_wrap',     240, '局部改色'),
  ('detail_treatment', 120, '细节处理'),
  ('color_change',     480, '改色方案'),
  ('other',            120, '其他服务');

CREATE TABLE `store_service_config` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `store_id`          BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `service_type`      ENUM('full_wrap','partial_wrap','detail_treatment','color_change','other') NOT NULL,
  `duration_minutes`  INT UNSIGNED    NOT NULL              COMMENT '门店自定义时长（分钟）',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_service` (`store_id`, `service_type`),
  INDEX `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店级服务时长配置表';

-- ============================================================
-- P5.9: case_tag + case_tag_relation
-- ============================================================
CREATE TABLE `case_tag` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(30)     NOT NULL              COMMENT '标签名称',
  `color`       VARCHAR(7)      NOT NULL DEFAULT '#1890FF' COMMENT '标签颜色（十六进制）',
  `sort_order`  INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '排序权重',
  `store_id`    BIGINT UNSIGNED NULL                  COMMENT '所属门店 (NULL=平台通用)',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name_store` (`name`, `store_id`),
  INDEX `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例标签表';

CREATE TABLE `case_tag_relation` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id`     BIGINT UNSIGNED NOT NULL              COMMENT '案例 ID',
  `tag_id`      BIGINT UNSIGNED NOT NULL              COMMENT '标签 ID',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_case_tag` (`case_id`, `tag_id`),
  INDEX `idx_tag_id` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例-标签关联表';

-- ============================================================
-- P5.12: scheduled_export + scheduled_export_log
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
  `updated_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`         DATETIME        NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_name` (`store_id`, `name`),
  INDEX `idx_next_execution` (`enabled`, `next_execution_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定期导出配置表';

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

-- ============================================================
-- P5.14: case_comment + comment_vote
-- ============================================================
CREATE TABLE `case_comment` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id`     BIGINT UNSIGNED NOT NULL              COMMENT '案例 ID',
  `store_id`    BIGINT UNSIGNED NOT NULL              COMMENT '门店 ID',
  `staff_id`    BIGINT UNSIGNED NOT NULL              COMMENT '评论者 ID',
  `parent_id`   BIGINT UNSIGNED NULL                 COMMENT '父评论 ID',
  `content`     VARCHAR(500)    NOT NULL              COMMENT '评论内容',
  `status`      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' COMMENT '审核状态',
  `vote_count`  INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '赞数',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME        NULL                 COMMENT '软删除标记',
  PRIMARY KEY (`id`),
  INDEX `idx_case_id` (`case_id`),
  INDEX `idx_staff_id` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='案例评论表';

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

-- ============================================================
-- P5.15: usdz_conversion_log
-- ============================================================
ALTER TABLE `car_model`
  ADD COLUMN `usdz_url` VARCHAR(500) NULL COMMENT 'USDZ 格式模型文件的 OSS URL' AFTER `model_3d_url`;

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
