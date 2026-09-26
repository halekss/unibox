import type { NextConfig } from "next";

const config: NextConfig = {
  // The OAuth callback URL carries the authorization code: keep it out of request logs.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/callback/] } },
  agentRules: false,
};

export default config;
