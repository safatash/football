-- Phase 3: league branding lives on the organization instead of in the code.
ALTER TABLE "organizations" ADD COLUMN "facebookUrl" TEXT,
ADD COLUMN "fullName" TEXT,
ADD COLUMN "instagramUrl" TEXT,
ADD COLUMN "tagline" TEXT,
ADD COLUMN "twitterUrl" TEXT;

ALTER TABLE "organization_settings" ADD COLUMN "legacyRedirects" BOOLEAN NOT NULL DEFAULT false;

-- NVASA's values, previously hard-coded in the pages
UPDATE "organizations" SET
  "fullName" = COALESCE("fullName", 'Northern Virginia Adult Soccer'),
  "tagline" = COALESCE("tagline", 'Recreational and competitive adult soccer across Fairfax, Arlington and Alexandria. Register for the season or buy a single-match game pass.'),
  "facebookUrl" = COALESCE("facebookUrl", 'https://www.facebook.com/groups/nvasa/'),
  "twitterUrl" = COALESCE("twitterUrl", 'https://twitter.com/NVASA'),
  "contactEmail" = COALESCE("contactEmail", 'office@nvasa.org'),
  "supportEmail" = COALESCE("supportEmail", 'office@nvasa.org')
WHERE "id" = 'org_nvasa';

-- Only NVASA had the old ColdFusion site
UPDATE "organization_settings" SET "legacyRedirects" = true WHERE "organizationId" = 'org_nvasa';
