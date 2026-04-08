import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const monorepoRoot = path.resolve(currentDirectory, "../..");
loadEnvConfig(monorepoRoot, process.env.NODE_ENV === "development");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(currentDirectory, "../..")
  },
  transpilePackages: [
    "@intentvault/providers",
    "@intentvault/schemas",
    "@intentvault/security",
    "@intentvault/workflows"
  ]
};

export default nextConfig;
