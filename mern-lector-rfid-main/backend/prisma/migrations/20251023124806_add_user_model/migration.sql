/*
  Warnings:

  - A unique constraint covering the columns `[tagId]` on the table `RFIDTag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `RFIDTag` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RFIDTag" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "rfidTagId" TEXT,
    CONSTRAINT "User_rfidTagId_fkey" FOREIGN KEY ("rfidTagId") REFERENCES "RFIDTag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_rfidTagId_key" ON "User"("rfidTagId");

-- CreateIndex
CREATE UNIQUE INDEX "RFIDTag_tagId_key" ON "RFIDTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "RFIDTag_userId_key" ON "RFIDTag"("userId");
