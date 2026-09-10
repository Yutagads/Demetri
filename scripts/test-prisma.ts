import "dotenv/config";
import { prisma } from "../server/prisma";

async function main() {
  try {
    await prisma.$connect();

    const result = await prisma.$queryRaw<
      { now: Date }[]
    >`SELECT NOW() AS now`;

    console.log("✅ Prisma connected to PostgreSQL");
    console.log("Database time:", result[0]?.now);
  } catch (error) {
    console.error("❌ Prisma connection failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();