import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDoorframeDataDir } from "../paths";

describe("Doorframe CLI paths", () => {
  it("resolves a relative data directory before starting the packaged web server", () => {
    const cwd = path.join(path.parse(process.cwd()).root, "workspace", "doorframe");
    expect(resolveDoorframeDataDir("./local-data", cwd)).toBe(path.resolve(cwd, "local-data"));
  });

  it("keeps an absolute data directory unchanged", () => {
    const absoluteDataDir = path.join(path.parse(process.cwd()).root, "var", "lib", "doorframe");
    expect(resolveDoorframeDataDir(absoluteDataDir, process.cwd())).toBe(absoluteDataDir);
  });
});
