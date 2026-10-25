import { db } from "@/lib/db";
import { getBrand } from "@/lib/branding";
import { leaguePaymentsMode } from "@/lib/league-checkout";

/** What a new league still has to do, worked out from its data. */
export async function setupSteps() {
  const brand = await getBrand();
  const [seasons, divisions, fields, office, payments] = await Promise.all([
    db.season.count(),
    db.division.count({ where: { registrationFee: { gt: 0 } } }),
    db.field.count(),
    db.organizationMember.count({ where: { role: { in: ["OWNER", "ADMIN", "STAFF"] }, status: { not: "REMOVED" } } }),
    leaguePaymentsMode(),
  ]);
  return [
    { key: "profile", title: "League profile", sub: "Name, logo, colors and contact email", href: "/admin/settings/league", done: !!(brand.contactEmail && (brand.logoUrl || brand.tagline || brand.primaryColor)) },
    { key: "season", title: "First season", sub: "Dates, and an optional starter template", href: "/admin/seasons/new", done: seasons > 0 },
    { key: "divisions", title: "Divisions and fees", sub: "Who can play and what it costs", href: "/admin/divisions", done: divisions > 0 },
    { key: "fields", title: "Fields", sub: "Parks and fields you play at", href: "/admin/settings/fields", done: fields > 0 },
    { key: "staff", title: "Invite staff", sub: "Other admins, or view-only staff", href: "/admin/settings/staff", done: office > 1 },
    { key: "payments", title: "Connect payments", sub: "Get paid online for registrations and game passes", href: "/admin/settings/online-payments", done: payments === "connected" },
  ];
}
