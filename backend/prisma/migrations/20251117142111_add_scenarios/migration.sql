-- CreateTable
CREATE TABLE "scenarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cameras" TEXT NOT NULL DEFAULT '[]',
    "sensors" TEXT NOT NULL DEFAULT '[]',
    "thresholds" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_name_key" ON "scenarios"("name");
