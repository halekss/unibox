import { NextResponse } from "next/server";
import { db } from "@/lib/db.ts";
import { syncInbox } from "@/lib/microsoft.ts";

// ponytail: no auth on this route, local-only; add a session/API key before exposing the app anywhere.
export async function POST() {
  const { rows } = await db.query("SELECT * FROM accounts WHERE provider = 'outlook'");
  const results = [];
  for (const acc of rows) {
    try {
      results.push({ email: acc.email, ...(await syncInbox(acc)) });
    } catch (e) {
      results.push({ email: acc.email, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results });
}
