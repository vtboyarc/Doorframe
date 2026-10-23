import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const read = (name: string) => readFileSync(fileURLToPath(new URL(name, root)), "utf8");
const version = JSON.parse(read("apps/cli/package.json")).version;

describe("distribution version metadata", () => {
  it("pins the packaged framework runtime to the versions used to build the web app", () => {
    const lock = JSON.parse(read("package-lock.json"));
    for (const dependency of ["next", "react", "react-dom"]) {
      const builtVersion = lock.packages[`node_modules/${dependency}`].version;
      for (const workspace of ["apps/cli", "apps/web"]) {
        expect(JSON.parse(read(`${workspace}/package.json`)).dependencies[dependency]).toBe(builtVersion);
        expect(lock.packages[workspace].dependencies[dependency]).toBe(builtVersion);
      }
    }
  });

  it("keeps package and lockfile versions aligned", () => {
    expect(JSON.parse(read("package.json")).version).toBe(version);
    const lock = JSON.parse(read("package-lock.json"));
    expect(lock.version).toBe(version);
    expect(lock.packages[""].version).toBe(version);
    expect(lock.packages["apps/cli"].version).toBe(version);
  });

  it("keeps the Compose image and local Docker build defaults aligned", () => {
    const compose = read("docker-compose.yml");
    expect(compose.match(/^\s+image: ghcr\.io\/vtboyarc\/doorframe:(\S+)$/m)?.[1]).toBe(version);
    expect(compose.match(/^\s+VERSION: (\S+)$/m)?.[1]).toBe(version);
    expect(read("docker/Dockerfile").match(/^ARG VERSION=(\S+)$/m)?.[1]).toBe(version);
  });
});
