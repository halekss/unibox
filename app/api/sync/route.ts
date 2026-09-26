import { NextResponse } from "next/server";
import { syncAll } from "@/lib/mailbox.ts";

// Syncs every connected account (Outlook and Gmail).
// Protected by proxy.ts (password + same-origin check).
export async function POST() {
  return NextResponse.json({ results: await syncAll() });
}
