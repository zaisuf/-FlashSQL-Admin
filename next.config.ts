import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const nextConfig: NextConfig = {
  distDir,
  output: "standalone",
  serverExternalPackages: ["pg", "mysql2", "mssql", "better-sqlite3"],
};

export default nextConfig;
