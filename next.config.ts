import type { NextConfig } from "next";
import path from "path";

let withPWA = (config: NextConfig) => config;

if (process.env.NODE_ENV === 'production' && process.env.DISABLE_PWA !== 'true') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withPWAInit = require("@ducanh2912/next-pwa").default;
    withPWA = withPWAInit({
      dest: "public",
      disable: false,
      register: true,
      skipWaiting: true,
    });
  } catch (e: any) {
    console.warn("[PWA] Plugin deshabilitado por falta de dependencias workbox:", e.message);
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
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
