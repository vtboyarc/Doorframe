import path from "node:path";

export function resolveDoorframeDataDir(value: string | undefined, cwd = process.cwd()): string {
  return path.resolve(cwd, value?.trim() || ".doorframe");
}
