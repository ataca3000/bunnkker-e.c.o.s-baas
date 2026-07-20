import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";

const isDesktop = process.env.BUILD_TARGET === 'desktop' || process.env.BUILD_TARGET === 'docker';

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  output: 'standalone', // Standalone para Electron + Docker
  outputFileTracingRoot: path.join(__dirname, './'),
  // @ts-ignore
  turbopack: {},
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    optimizePackageImports: ['lucide-react', 'firebase', 'firebase/firestore', '@stripe/stripe-js', 'recharts']
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules', 'C:\\pagefile.sys', 'C:\\hiberfil.sys', 'C:\\swapfile.sys']
    };
    return config;
  }
};

export default withPWA(nextConfig);
