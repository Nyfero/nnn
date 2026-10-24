-- CreateTable
CREATE TABLE `passwords` (
    `password_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `password` TEXT NULL,
    `email` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `is_compromised` BOOLEAN NOT NULL DEFAULT false,
    `is_stared` BOOLEAN NOT NULL DEFAULT false,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_time` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `passwords_user_id_idx`(`user_id`),
    PRIMARY KEY (`password_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
