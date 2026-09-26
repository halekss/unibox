import type { NextConfig } from "next";

const config: NextConfig = {
  // The OAuth callback URLs (Microsoft, Google) carry the authorization code: keep it out of request logs.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/(google\/)?callback/] } },
  agentRules: false,
};

export default config;
