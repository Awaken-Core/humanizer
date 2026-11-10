import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
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
};

export default nextConfig;
