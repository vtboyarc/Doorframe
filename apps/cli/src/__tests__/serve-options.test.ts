import { describe, expect, it } from "vitest";
import { parseServeOptions } from "../serve-options";

describe("serve options", () => {
  it("uses the same default port as Next.js", () => {
    expect(parseServeOptions([], {})).toMatchObject({ port: "3000", host: "127.0.0.1" });
  });

  it.each([["--port", "3317"], ["-p", "3317"], ["--port=3317"], ["-p3317"]])(
    "accepts port arguments %j",
    (...args) => {
      expect(parseServeOptions(args, { PORT: "3001" }).port).toBe("3317");
    }
  );

  it("preserves environment configuration and lets flags override it", () => {
    const env = { PORT: "3100", HOSTNAME: "0.0.0.0", DOORFRAME_DATA_DIR: "/tmp/doorframe" };
    expect(parseServeOptions([], env)).toEqual({ port: "3100", host: "0.0.0.0", dataDir: "/tmp/doorframe" });
    expect(parseServeOptions(["-p", "3200", "--host", "127.0.0.1", "--data-dir", "./data"], env))
      .toEqual({ port: "3200", host: "127.0.0.1", dataDir: "./data" });
  });

  it.each(["", "abc", "1.5", "-1", "0", "65536"])("rejects invalid PORT=%j", (port) => {
    expect(() => parseServeOptions([], { PORT: port })).toThrow(/Port must be/);
  });

  it("rejects missing values and unknown options instead of starting on the default port", () => {
    expect(() => parseServeOptions(["-p"], {})).toThrow();
    expect(() => parseServeOptions(["--prot", "3317"], {})).toThrow();
  });
});
