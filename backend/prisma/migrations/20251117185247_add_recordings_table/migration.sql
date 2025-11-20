-- CreateTable
CREATE TABLE "recordings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scenarioId" INTEGER NOT NULL,
    "cameraId" INTEGER NOT NULL,
    "videoPath" TEXT,
    "sensorPath" TEXT,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "duration" INTEGER,
    "fileSize" BIGINT,
    "sensorRecords" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "recordings_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "recordings_scenarioId_startTime_idx" ON "recordings"("scenarioId", "startTime");

-- CreateIndex
CREATE INDEX "recordings_cameraId_startTime_idx" ON "recordings"("cameraId", "startTime");
