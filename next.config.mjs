/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const staticExport = process.env.STATIC_EXPORT === "true";

// Default local/dev build keeps API routes (needed for SQLite + workflow proxy).
// Set STATIC_EXPORT=true for the old static /roverv2 export deploy.
const basePath = staticExport && isProd ? "/roverv2" : "";
const assetPrefix = staticExport && isProd ? "/roverv2/" : "";

const nextConfig = {
  ...(staticExport
    ? {
        output: "export",
        trailingSlash: true,
      }
    : {
        trailingSlash: true,
      }),
  basePath,
  assetPrefix,
  env: {
    NEXT_PUBLIC_ASSET_PREFIX: assetPrefix,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {},
};

export default nextConfig;
