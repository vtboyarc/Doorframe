import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// The published `doorframe` package version, inlined at build time so reports
// and the UI show the version that was actually built.
const doorframeVersion = JSON.parse(readFileSync(path.join(repoRoot, "apps", "cli", "package.json"), "utf8")).version;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    DOORFRAME_VERSION: doorframeVersion
  },
  allowedDevOrigins: ["127.0.0.1"],
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
