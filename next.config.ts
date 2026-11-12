import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Phone testing over Wi-Fi: `npm run dev -- -H 0.0.0.0`, then put your PC's
  // LAN IP in .env.local as DEV_PHONE_HOST=192.168.x.x so Next serves the dev
  // assets (HMR, chunks) to that origin.
  allowedDevOrigins: process.env.DEV_PHONE_HOST ? [process.env.DEV_PHONE_HOST] : [],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
