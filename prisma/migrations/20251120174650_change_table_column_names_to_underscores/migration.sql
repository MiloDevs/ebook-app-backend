/*
  Warnings:

  - You are about to drop the column `authorId` on the `book` table. All the data in the column will be lost.
  - You are about to drop the column `bestSelling` on the `book` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `book` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `book` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `book` table. All the data in the column will be lost.
  - You are about to drop the column `releasedAt` on the `book` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `book` table. All the data in the column will be lost.
  - Added the required column `file_url` to the `book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `image_url` to the `book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `released_at` to the `book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `book` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "book" DROP CONSTRAINT "book_authorId_fkey";

-- AlterTable
ALTER TABLE "book" DROP COLUMN "authorId",
DROP COLUMN "bestSelling",
DROP COLUMN "createdAt",
DROP COLUMN "fileUrl",
DROP COLUMN "imageUrl",
DROP COLUMN "releasedAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "author_id" UUID,
ADD COLUMN     "best_selling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "file_url" TEXT NOT NULL,
ADD COLUMN     "image_url" TEXT NOT NULL,
ADD COLUMN     "released_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AddForeignKey
ALTER TABLE "book" ADD CONSTRAINT "book_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author"("id") ON DELETE SET NULL ON UPDATE CASCADE;
