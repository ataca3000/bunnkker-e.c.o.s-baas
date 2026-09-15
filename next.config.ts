import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'firebase', 'firebase/firestore', '@stripe/stripe-js', 'recharts', 'framer-motion']
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: false,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/prisma/*.db*']
      };
    }
    return config;
  }
};

export default nextConfig;
