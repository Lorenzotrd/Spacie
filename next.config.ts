import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["@modelcontextprotocol/sdk", "@electric-sql/pglite", "pg"],
};
export default config;
