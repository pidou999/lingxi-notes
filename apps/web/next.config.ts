import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ai-notes/shared-types",
    "@ai-notes/ui-kit",
    "@ai-notes/icons",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8888/api/:path*",
      },
    ];
  },
};

export default nextConfig;
