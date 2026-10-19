/**
 * Give someone league-office access (ADMIN membership) in one league.
 *   npm run admin:grant -- someone@example.com [league-slug]
 * The slug defaults to ORG_SLUG, then "nvasa".
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim();
  const slug = (process.argv[3] ?? process.env.ORG_SLUG ?? "nvasa").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run admin:grant -- <email> [league-slug]");
    process.exit(1);
  }
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    console.error(`No league with slug "${slug}".`);
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    console.error(`No user with email ${email}. They need an account first.`);
    process.exit(1);
  }
  const member = await prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: org.id } } });
  if (member?.role === "OWNER" || member?.role === "ADMIN") {
    console.log(`${user.email} already has league-office access in ${org.name}.`);
    return;
  }
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { userId: user.id, organizationId: org.id, role: "ADMIN", joinedAt: new Date() },
  });
  console.log(`${user.email} is now a league-office admin in ${org.name}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
