-- AlterTable
ALTER TABLE `nodes` MODIFY `name` VARCHAR(1536) NOT NULL,
    ADD COLUMN `encrypted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_vault` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `vault_id` INTEGER NULL,
    ADD COLUMN `name_key` VARCHAR(64) NULL,
    ADD COLUMN `wrapped_key` TEXT NULL,
    ADD COLUMN `trashed_at` DATETIME(3) NULL,
    ADD COLUMN `trash_root` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `nodes_vault_id_idx` ON `nodes`(`vault_id`);

-- CreateIndex
CREATE INDEX `nodes_trash_root_trashed_at_idx` ON `nodes`(`trash_root`, `trashed_at`);
