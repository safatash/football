/**
 * The raw, unscoped Prisma client. Only the platform layer (this folder), migrations, scripts and
 * tests may import it; app code uses the league-scoped client from `@/lib/db`.
 * tests/raw-client.test.ts fails the build if anything else imports this file.
 */
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => new PrismaClient();

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
