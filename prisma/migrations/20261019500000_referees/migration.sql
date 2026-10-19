-- Referees become records; match officials move from three name columns to a join table.

-- CreateEnum
CREATE TYPE "RefereePosition" AS ENUM ('CENTER', 'ASSISTANT');
CREATE TYPE "OfficialRole" AS ENUM ('CENTER', 'AR1', 'AR2', 'FOURTH');
CREATE TYPE "OfficialStatus" AS ENUM ('ASSIGNED', 'CONFIRMED', 'DECLINED', 'NO_SHOW');

-- Default referee pay per role, per division
ALTER TABLE "divisions" ADD COLUMN "assistantRefFee" DECIMAL(10,2),
ADD COLUMN "centerRefFee" DECIMAL(10,2),
ADD COLUMN "fourthRefFee" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "referees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "certLevel" TEXT,
    "certExpires" DATE,
    "positions" "RefereePosition"[] DEFAULT ARRAY['CENTER', 'ASSISTANT']::"RefereePosition"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "referees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "referees_name_idx" ON "referees"("name");

CREATE TABLE "match_officials" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "role" "OfficialRole" NOT NULL,
    "status" "OfficialStatus" NOT NULL DEFAULT 'ASSIGNED',
    "fee" DECIMAL(10,2),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "match_officials_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "match_officials_refereeId_idx" ON "match_officials"("refereeId");
CREATE UNIQUE INDEX "match_officials_matchId_role_key" ON "match_officials"("matchId", "role");
ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "referees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One referee per distinct name in ref1/ref2/ref3 (names compared trimmed, case-insensitively)
INSERT INTO "referees" ("id", "name", "updatedAt")
SELECT 'ref_' || md5(lower(n)), min(n), CURRENT_TIMESTAMP
FROM (
  SELECT trim("ref1") AS n FROM "matches" UNION ALL
  SELECT trim("ref2") FROM "matches" UNION ALL
  SELECT trim("ref3") FROM "matches"
) names
WHERE coalesce(n, '') <> ''
GROUP BY lower(n);

-- Their assignments: ref1 = center, ref2 = AR1, ref3 = AR2. Completed games count as worked.
INSERT INTO "match_officials" ("id", "matchId", "refereeId", "role", "status", "updatedAt")
SELECT 'mo_' || md5(m."id" || r.role), m."id", 'ref_' || md5(lower(r.n)), r.role::"OfficialRole",
       CASE WHEN m."status" = 'COMPLETED' THEN 'CONFIRMED'::"OfficialStatus" ELSE 'ASSIGNED'::"OfficialStatus" END,
       CURRENT_TIMESTAMP
FROM "matches" m
CROSS JOIN LATERAL (VALUES (trim(m."ref1"), 'CENTER'), (trim(m."ref2"), 'AR1'), (trim(m."ref3"), 'AR2')) AS r(n, role)
WHERE coalesce(r.n, '') <> '';

-- The referees prisma/seed.ts made up are sample data
UPDATE "referees" SET "isDemo" = true WHERE "name" IN (
  'Daniel Kim', 'Lucia Fernandes', 'Omar Haddad', 'Sam Okoye', 'Irene Park',
  'Luis Mejía', 'Paul Grant', 'Ana Silva', 'Tara Boone', 'Hugo Bell'
);

-- The names now live on referees
ALTER TABLE "matches" DROP COLUMN "ref1",
DROP COLUMN "ref2",
DROP COLUMN "ref3";
