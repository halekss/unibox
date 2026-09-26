import { NextResponse } from "next/server";
import { db } from "@/lib/db.ts";
import { mailbox } from "@/lib/mailbox.ts";

// Syncs every connected account (Outlook and Gmail).
// Protected by proxy.ts (password + same-origin check).
export async function POST() {
  const { rows } = await db.query("SELECT * FROM accounts ORDER BY id");
  const results = [];
  for (const acc of rows) {
    try {
      results.push({ email: acc.email, provider: acc.provider, ...(await mailbox(acc).sync(acc)) });
    } catch (e) {
      results.push({ email: acc.email, provider: acc.provider, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results });
}
