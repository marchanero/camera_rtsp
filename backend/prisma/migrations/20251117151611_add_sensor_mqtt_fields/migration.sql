-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sensors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sensorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "location" TEXT,
    "deviceId" TEXT,
    "topicBase" TEXT,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_sensors" ("config", "createdAt", "id", "isActive", "location", "name", "sensorId", "type", "unit", "updatedAt") SELECT "config", "createdAt", "id", "isActive", "location", "name", "sensorId", "type", "unit", "updatedAt" FROM "sensors";
DROP TABLE "sensors";
ALTER TABLE "new_sensors" RENAME TO "sensors";
CREATE UNIQUE INDEX "sensors_sensorId_key" ON "sensors"("sensorId");
CREATE INDEX "sensors_type_idx" ON "sensors"("type");
CREATE INDEX "sensors_deviceId_idx" ON "sensors"("deviceId");
CREATE INDEX "sensors_topicBase_idx" ON "sensors"("topicBase");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
