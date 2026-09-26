import type { NextConfig } from "next";

const config: NextConfig = {
  // The OAuth callback URLs (Microsoft, Google) carry the authorization code: keep it out of request logs.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/(google\/)?callback/] } },
  agentRules: false,
  // Tailscale serve (https://<pc>.<tailnet>.ts.net), reachable only from the user's own devices.
  allowedDevOrigins: ["*.ts.net"],
  experimental: { serverActions: { allowedOrigins: ["*.ts.net"] } },
};

export default config;
