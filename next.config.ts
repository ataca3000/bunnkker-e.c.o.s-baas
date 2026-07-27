import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";

const isPwaDisabled = process.env.DISABLE_PWA === 'true' || process.env.NODE_ENV === 'development';

const withPWA = withPWAInit({
  dest: "public",
  disable: isPwaDisabled,
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: false,
  outputFileTracingRoot: path.resolve(__dirname),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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

export default withPWA(nextConfig);
