-- Season registration window (date-only, inclusive, in the league's time zone)
ALTER TABLE "seasons" ADD COLUMN "registrationOpensOn" DATE;
ALTER TABLE "seasons" ADD COLUMN "registrationClosesOn" DATE;
