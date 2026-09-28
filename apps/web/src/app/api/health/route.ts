import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { doorframeVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  try {
    getDb().prepare("SELECT 1").get();
  } catch {
    // Do not echo paths or driver errors; the terminal running Doorframe has the details.
    return NextResponse.json({ ok: false, service: "doorframe-web", error: "Database unavailable." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, service: "doorframe-web", version: doorframeVersion() ?? null });
}
