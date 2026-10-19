-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Teams created by prisma/seed.ts are sample data
UPDATE "teams" SET "isDemo" = true WHERE ("code", "name") IN (
  ('ffx', 'Fairfax United'),
  ('alx', 'Alexandria FC'),
  ('pot', 'Potomac Valkyries'),
  ('brk', 'Burke Athletic'),
  ('nvs', 'Nova Strikers'),
  ('arl', 'Arlington SC'),
  ('rst', 'Reston Rovers'),
  ('spr', 'Springfield Athletic'),
  ('bld', 'Bloodline'),
  ('hrn', 'Herndon Hustle'),
  ('vie', 'Vienna Athletic'),
  ('shi', 'Shirlington Social'),
  ('mvm', 'Mount Vernon Masters')
);
