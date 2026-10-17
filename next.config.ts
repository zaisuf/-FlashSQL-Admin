import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "mysql2", "mssql", "better-sqlite3"],
};

export default nextConfig;
