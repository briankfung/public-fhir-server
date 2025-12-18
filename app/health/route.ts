import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const rows = await sql`select 1 as ok`;
  const first = Array.isArray(rows) && rows.length > 0 ? (rows[0] as Record<string, unknown>) : {};
  const ok = first["ok"] === 1;
  return NextResponse.json({ ok }, { status: 200 });
}
