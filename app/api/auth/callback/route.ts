import { NextRequest, NextResponse } from "next/server";
import { connectAccount } from "@/lib/microsoft.ts";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return NextResponse.json({ error: p.get("error"), description: p.get("error_description") }, { status: 400 });

  const state = p.get("state");
  const code = p.get("code");
  if (!code || !state || state !== req.cookies.get("oauth_state")?.value) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  const email = await connectAccount(code);
  const res = NextResponse.json({ connected: email });
  res.cookies.delete({ name: "oauth_state", path: "/api/auth" });
  return res;
}
