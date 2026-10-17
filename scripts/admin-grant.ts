/**
 * Promote a user to league-office admin.
 *   npm run admin:grant -- someone@example.com
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim();
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run admin:grant -- <email>");
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    console.error(`No user with email ${email}. They need an account first.`);
    process.exit(1);
  }
  if (user.role === "ADMIN") {
    console.log(`${user.email} is already an admin.`);
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`${user.email} is now a league-office admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
