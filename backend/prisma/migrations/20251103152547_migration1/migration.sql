-- CreateTable
CREATE TABLE "cameras" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "rtspUrl" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stream_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cameraId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "cameras_name_key" ON "cameras"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_rtspUrl_key" ON "cameras"("rtspUrl");
