-- AlterTable
ALTER TABLE `roles` ADD COLUMN `all_modules` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `initialized` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `storage_quota_mb` INTEGER NULL;

-- CreateTable
CREATE TABLE `roleModules` (
    `role_id` INTEGER NOT NULL,
    `module_id` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`role_id`, `module_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `roleModules` ADD CONSTRAINT `roleModules_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE CASCADE ON UPDATE CASCADE;
