import { defineConfig, env } from "prisma/config";
import { fileURLToPath } from "node:url";

const seedFile = fileURLToPath(new URL("./prisma/seed.ts", import.meta.url));
const tsxLoader = import.meta.resolve("tsx");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: `node --import ${tsxLoader} ${seedFile}`,
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
