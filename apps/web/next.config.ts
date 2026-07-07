import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: [
    "@ai-notes/shared-types",
    "@ai-notes/ui-kit",
    "@ai-notes/icons",
  ],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8888/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
