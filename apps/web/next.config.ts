import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ai-notes/shared-types",
    "@ai-notes/ui-kit",
    "@ai-notes/icons",
  ],
};

export default nextConfig;
