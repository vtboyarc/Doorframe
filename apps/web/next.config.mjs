/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@doorframe/core",
    "@doorframe/parsers",
    "@doorframe/analyzers",
    "@doorframe/reporting"
  ],
  serverExternalPackages: ["better-sqlite3"]
};

export default nextConfig;
