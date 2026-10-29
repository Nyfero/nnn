-- CreateTable
CREATE TABLE `servers` (
    `server_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `container` VARCHAR(128) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `servers_container_key`(`container`),
    PRIMARY KEY (`server_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `serverPermissions` (
    `server_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `serverPermissions_user_id_idx`(`user_id`),
    PRIMARY KEY (`server_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `serverPermissions` ADD CONSTRAINT `serverPermissions_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers`(`server_id`) ON DELETE CASCADE ON UPDATE CASCADE;
