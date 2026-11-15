import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password || password.length < 12) {
    throw new Error(
      "SEED_ADMIN_USERNAME and a 12+ character SEED_ADMIN_PASSWORD are required",
    );
  }

  await prisma.store.upsert({
    where: { code: "main" },
    create: { code: "main", name: "铁码数码维修" },
    update: {},
  });

  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash: await hash(password),
      role: UserRole.ADMIN,
      displayName: "系统管理员",
    },
    update: { passwordHash: await hash(password), role: UserRole.ADMIN },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
