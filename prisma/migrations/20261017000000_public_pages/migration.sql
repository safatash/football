-- CreateEnum
CREATE TYPE "InGame" AS ENUM ('IN', 'OUT', 'DNP');

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "legacyKey" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "legacyDatasource" TEXT,
ADD COLUMN     "slug" TEXT;
-- "Spring 2026" -> slug "spring-2026", legacy datasource "spring2026" (the old site's naming)
UPDATE "seasons" SET
  "slug" = trim(both '-' from lower(regexp_replace("name", '[^A-Za-z0-9]+', '-', 'g'))),
  "legacyDatasource" = lower(regexp_replace("name", '[^A-Za-z0-9]+', '', 'g'));
ALTER TABLE "seasons" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "divisions" ADD COLUMN     "legacyId" INTEGER;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "awayShirt" TEXT,
ADD COLUMN     "awayShorts" TEXT,
ADD COLUMN     "formation" TEXT,
ADD COLUMN     "homeShirt" TEXT,
ADD COLUMN     "homeShorts" TEXT,
ADD COLUMN     "legacyId" INTEGER,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "fieldId" TEXT,
ADD COLUMN     "legacyId" INTEGER;

-- AlterTable
ALTER TABLE "player_match_stats" ADD COLUMN     "inGame" "InGame" NOT NULL DEFAULT 'IN',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "secondYellow" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL,
    "complex" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "legacyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fields_legacyId_key" ON "fields"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "fields_complex_name_key" ON "fields"("complex", "name");

-- CreateIndex
CREATE UNIQUE INDEX "players_legacyKey_key" ON "players"("legacyKey");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_slug_key" ON "seasons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_legacyDatasource_key" ON "seasons"("legacyDatasource");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_seasonId_legacyId_key" ON "divisions"("seasonId", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_seasonId_legacyId_key" ON "teams"("seasonId", "legacyId");

-- CreateIndex
CREATE INDEX "matches_fieldId_idx" ON "matches"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "matches_seasonId_legacyId_key" ON "matches"("seasonId", "legacyId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

