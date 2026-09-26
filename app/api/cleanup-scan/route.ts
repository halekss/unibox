import { NextRequest, NextResponse } from "next/server";
import { scanFoldersForCleanup } from "@/lib/classify.ts";

// POST ?limit=N : examines the next N filed emails for deletion (results show up on /nettoyage).
// ponytail: no auth, local-only (same as /api/sync).
export async function POST(req: NextRequest) {
  return NextResponse.json(await scanFoldersForCleanup(Number(req.nextUrl.searchParams.get("limit") ?? 20)));
}
