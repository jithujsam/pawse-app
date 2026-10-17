import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // US ZIP centres are read from disk by the geocoding route.
  outputFileTracingIncludes: {
    "/api/datasets/[id]/geocode": ["./data/us-zcta.csv"],
  },
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
