/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `users_email_is_email_verified_idx` ON `users`;

-- AlterTable
ALTER TABLE `users` ALTER COLUMN `email` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);
