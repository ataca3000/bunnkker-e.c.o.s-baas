import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || process.env.VERCEL === "1",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Electron packaging
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
    cpus: 1
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
