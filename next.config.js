/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // 'standalone' bundles a minimal node_modules + server.js into
  // .next/standalone for Docker deploy. On Vercel (VERCEL=1 is injected
  // automatically) leave output unset so Vercel's own build adapter handles
  // it — forcing standalone there breaks static asset serving. Override
  // locally with NEXT_OUTPUT_MODE='' for plain `next start` flows.
  output: process.env.VERCEL ? undefined : (process.env.NEXT_OUTPUT_MODE ?? 'standalone'),
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.filename = 'static/chunks/[name]-[contenthash:8].js';
      config.output.chunkFilename = 'static/chunks/[contenthash:16].js';
    }
    return config;
  },
};

module.exports = nextConfig;
