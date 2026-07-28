import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admin routes below read from disk at request time (readdirSync/
  // readFileSync) using paths Next.js's build-time file tracer can't always
  // resolve statically — migrate()'s migrationsFolder is a process.cwd()-
  // relative path, and checklist-data/seed-data are read via runtime
  // directory listing. Without these, the serverless bundle can silently
  // omit them and the route 500s in production despite working locally.
  outputFileTracingIncludes: {
    "/api/admin/checklist/import": ["migrations/**/*", "src/db/checklist-data/**/*"],
    "/api/admin/seed": ["src/db/seed-data/**/*"],
  },
};

export default nextConfig;
