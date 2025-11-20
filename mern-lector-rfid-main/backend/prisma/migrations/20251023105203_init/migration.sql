-- CreateTable
CREATE TABLE "RFIDTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "RFIDTag_tagId_key" ON "RFIDTag"("tagId");
