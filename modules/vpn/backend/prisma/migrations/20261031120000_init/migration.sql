-- CreateTable
CREATE TABLE `devices` (
    `device_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `public_key` VARCHAR(44) NOT NULL,
    `ip_index` INTEGER NOT NULL,
    `encrypted_config` TEXT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `devices_public_key_key`(`public_key`),
    UNIQUE INDEX `devices_ip_index_key`(`ip_index`),
    INDEX `devices_user_id_idx`(`user_id`),
    PRIMARY KEY (`device_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
