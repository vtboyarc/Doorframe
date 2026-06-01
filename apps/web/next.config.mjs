import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: [
    "@doorframe/core",
    "@doorframe/parsers",
    "@doorframe/analyzers",
    "@doorframe/reporting",
    "@doorframe/storage"
  ],
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: repoRoot
  }
};

export default nextConfig;
