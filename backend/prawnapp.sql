-- ============================================
-- DATABASE: prawnapp
-- ============================================
CREATE DATABASE IF NOT EXISTS prawnapp;
USE prawnapp;

-- ============================================
-- 1. PONDS TABLE
-- ============================================
CREATE TABLE  IF NOT EXISTS `ponds` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `pond_name` VARCHAR(50) COLLATE utf8mb4_general_ci NOT NULL,
    `status` ENUM(
        'new','active','good','moderate','critical',
        'under_maintenance','inactive','harvested',
        'feeding_alert','water_alert'
    ) COLLATE utf8mb4_general_ci DEFAULT 'new',
    `pond_size` VARCHAR(50) COLLATE utf8mb4_general_ci NOT NULL,
    `num_prawns` INT(11) NOT NULL,
    `age` VARCHAR(50) COLLATE utf8mb4_general_ci NOT NULL,
    `location` VARCHAR(255) COLLATE utf8mb4_general_ci NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_general_ci;

-- ============================================
-- 2. WATER QUALITY PARAMETERS TABLE
-- ============================================
CREATE TABLE `water_quality_parameters` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `pond_id` INT(11) NOT NULL,
    `temperature` VARCHAR(10) COLLATE utf8mb4_general_ci NOT NULL,
    `pH` VARCHAR(10) COLLATE utf8mb4_general_ci NOT NULL,
    `salinity` VARCHAR(10) COLLATE utf8mb4_general_ci NOT NULL,
    `ammonia` VARCHAR(10) COLLATE utf8mb4_general_ci NOT NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `pond_id` (`pond_id`),
    CONSTRAINT `water_quality_parameters_ibfk_1`
        FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_general_ci;

-- ============================================
-- 3. FEEDING MANAGEMENT ACTION TABLE
-- ============================================
CREATE TABLE `feeding_management_action` (
    `fm_id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `pond_id` INT NOT NULL,
    `scheduled_timestamp` DATETIME NOT NULL,
    `amount_of_feed` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `feed_unit` ENUM('g','kg') NOT NULL DEFAULT 'g',
    `action_status` ENUM(
        'pending','feeding','completed',
        'canceled_by_user','canceled_by_ai','failed'
    ) NOT NULL DEFAULT 'pending',
    `control_mode` ENUM('ai mode','manual mode') NOT NULL DEFAULT 'ai mode',
    `fd_id` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP 
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`pond_id`) REFERENCES `ponds`(`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci;



CREATE TABLE `water_management_action` (
    `wm_id`              INT NOT NULL AUTO_INCREMENT,
    `pond_id`            INT NOT NULL,
    `wd_id`              INT DEFAULT NULL,

    -- Fixed: removed trailing comma
    `action_type`        ENUM('refill') NOT NULL,

    `scheduled_timestamp` DATETIME DEFAULT NULL,

    -- Fixed: removed double comma
    `action_status`      ENUM(
        'pending',
        'in_progress',
        'completed',
        'canceled',
        'failed'
    ) DEFAULT 'pending',

    `created_at`         DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME DEFAULT CURRENT_TIMESTAMP 
                             ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`wm_id`),

    CONSTRAINT `fk_water_management_pond`
        FOREIGN KEY (`pond_id`) REFERENCES `ponds` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE

) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_general_ci;
 