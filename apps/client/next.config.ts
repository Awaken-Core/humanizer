import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "128mb"
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nys3952oa4.ufs.sh",
        pathname: "/f/*"
      },
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/*"
      },
    ],
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
