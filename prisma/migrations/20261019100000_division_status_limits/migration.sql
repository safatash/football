-- CreateEnum
CREATE TYPE "DivisionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "divisions" ADD COLUMN     "gamePassFee" DECIMAL(10,2),
ADD COLUMN     "maxTeams" INTEGER,
ADD COLUMN     "rosterMax" INTEGER,
ADD COLUMN     "rosterMin" INTEGER,
ADD COLUMN     "status" "DivisionStatus" NOT NULL DEFAULT 'ACTIVE';

