/*
  Warnings:

  - You are about to drop the column `bookId` on the `genre` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "genre" DROP CONSTRAINT "genre_bookId_fkey";

-- AlterTable
ALTER TABLE "genre" DROP COLUMN "bookId";

-- CreateTable
CREATE TABLE "_BookToGenre" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookToGenre_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BookToGenre_B_index" ON "_BookToGenre"("B");

-- AddForeignKey
ALTER TABLE "_BookToGenre" ADD CONSTRAINT "_BookToGenre_A_fkey" FOREIGN KEY ("A") REFERENCES "book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookToGenre" ADD CONSTRAINT "_BookToGenre_B_fkey" FOREIGN KEY ("B") REFERENCES "genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
