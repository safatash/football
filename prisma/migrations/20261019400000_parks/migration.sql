-- Parks hold the address once; fields belong to a park.

-- CreateEnum
CREATE TYPE "FieldSurface" AS ENUM ('GRASS', 'TURF');
CREATE TYPE "FieldSize" AS ENUM ('FULL', 'SMALL_SIDED');

-- CreateTable
CREATE TABLE "parks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "mapUrl" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "parks_name_key" ON "parks"("name");

-- One park per complex, taking the address from its first field that has one
INSERT INTO "parks" ("id", "name", "address", "city", "state", "zip", "createdAt", "updatedAt")
SELECT 'park_' || md5("complex"), "complex",
       (array_agg("address" ORDER BY "address" IS NULL, "createdAt"))[1],
       (array_agg("city" ORDER BY "city" IS NULL, "createdAt"))[1],
       (array_agg("state" ORDER BY "state" IS NULL, "createdAt"))[1],
       (array_agg("zip" ORDER BY "zip" IS NULL, "createdAt"))[1],
       min("createdAt"), CURRENT_TIMESTAMP
FROM "fields"
GROUP BY "complex";

-- AlterTable
ALTER TABLE "fields" ADD COLUMN "parkId" TEXT,
ADD COLUMN "surface" "FieldSurface" NOT NULL DEFAULT 'GRASS',
ADD COLUMN "lights" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "size" "FieldSize" NOT NULL DEFAULT 'FULL',
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notes" TEXT;

UPDATE "fields" SET "parkId" = 'park_' || md5("complex");
ALTER TABLE "fields" ALTER COLUMN "parkId" SET NOT NULL;

DROP INDEX "fields_complex_name_key";
ALTER TABLE "fields" DROP COLUMN "complex",
DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "state",
DROP COLUMN "zip";

CREATE UNIQUE INDEX "fields_parkId_name_key" ON "fields"("parkId", "name");
ALTER TABLE "fields" ADD CONSTRAINT "fields_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The parks created by prisma/seed.ts are sample data, not NVASA's real fields
UPDATE "parks" SET "isDemo" = true WHERE "name" IN (
  'Wakefield Park', 'Chinquapin Park', 'Lee District', 'Burke Lake', 'Mason District',
  'Long Bridge Park', 'Baron Cameron', 'Lake Accotink', 'Bready Park', 'Grist Mill Park'
);
