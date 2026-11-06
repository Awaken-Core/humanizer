import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
  compress: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "128mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nys3952oa4.ufs.sh",
        pathname: "/f/*",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/*",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
