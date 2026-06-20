import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development" || process.env.VERCEL === "1",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Electron packaging
  // @ts-ignore
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
        const WebpackObfuscator = require('webpack-obfuscator');
        config.plugins.push(
            new WebpackObfuscator({
                rotateStringArray: true,
                stringArray: true,
                stringArrayEncoding: ['rc4'],
                deadCodeInjection: true,
                debugProtection: false,
                disableConsoleOutput: false
            }, ['**/*.server.js']) // Excluir archivos del servidor para no romper Next.js
        );
    }
    return config;
  }
};

export default withPWA(nextConfig);
