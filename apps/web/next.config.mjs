/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@doorframe/core",
    "@doorframe/parsers",
    "@doorframe/analyzers",
    "@doorframe/reporting",
    "@doorframe/storage"
  ],
  serverExternalPackages: ["better-sqlite3"]
};

export default nextConfig;
