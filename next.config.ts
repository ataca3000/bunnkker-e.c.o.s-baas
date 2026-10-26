import type { NextConfig } from "next";
import path from "path";

const isDesktopBuild = (process.env.BUILD_TARGET === 'desktop' || process.env.NEXT_PUBLIC_APP_ENV === 'local') && !process.env.VERCEL;

const nextConfig: NextConfig = {
  ...(isDesktopBuild ? { output: 'standalone' } : {}),
  // TODO (S3.2): Reactivar reactStrictMode: true una vez identificado el componente
  // que causa doble-render problemático. StrictMode detecta efectos secundarios
  // inesperados y refs obsoletas — su desactivación oculta bugs reales.
  reactStrictMode: false,
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || (process.env.VERCEL ? 'demo' : ''),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'firebase', 'firebase/firestore', '@stripe/stripe-js', 'framer-motion']
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: false,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/prisma/*.db*',
          '**/.agents/**',
          '**/lfeds/**',
          '**/unsupervised_topic_modeling-master/**',
          '**/logs/**',
          '**/build-resources/**',
          '**/*.txt'
        ]
      };
    }
    return config;
  }
};

export default nextConfig;
