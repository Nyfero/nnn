-- CreateTable
CREATE TABLE `nodes` (
    `node_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `parent_id` INTEGER NULL,
    `name` VARCHAR(255) NOT NULL,
    `is_folder` BOOLEAN NOT NULL DEFAULT false,
    `size` BIGINT NOT NULL DEFAULT 0,
    `mime` VARCHAR(191) NULL,
    `storage_backend` VARCHAR(64) NULL,
    `storage_key` VARCHAR(255) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'ready',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `nodes_user_id_parent_id_idx`(`user_id`, `parent_id`),
    INDEX `nodes_parent_id_idx`(`parent_id`),
    INDEX `nodes_storage_backend_idx`(`storage_backend`),
    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `user_id` INTEGER NOT NULL,
    `quota_bytes` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
