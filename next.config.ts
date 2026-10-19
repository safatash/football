import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // League subdomains in development (nvasa.app.localhost:3000, demo.app.localhost:3000)
  allowedDevOrigins: ["*.app.localhost", "*.localhost"],
};

export default nextConfig;
