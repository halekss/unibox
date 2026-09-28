import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized, isSameOrigin } from "./lib/auth.ts";

// Guards every page, API route and server action. OAuth callbacks included: the browser resends the
// credentials on Microsoft/Google's redirect back to us.
export function proxy(req: NextRequest) {
  if (!process.env.APP_PASSWORD) return new NextResponse("APP_PASSWORD manquant dans .env", { status: 500 });
  if (!isAuthorized(req.headers.get("authorization"), process.env.APP_PASSWORD))
    return new NextResponse("Authentification requise", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Unibox", charset="UTF-8"' },
    });
  // Behind Tailscale serve the public host may only be in X-Forwarded-Host (browsers cannot forge it cross-site).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!isSameOrigin(req.method, req.headers.get("origin"), host))
    return new NextResponse("Origine refusée", { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
