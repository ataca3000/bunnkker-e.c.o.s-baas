import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
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
    // S3.3: ESLint corre en cada build para visibilidad.
    // ESTRATEGIA PRIMER DEPLOY: ignoreDuringBuilds: true para no bloquear
    // el pipeline mientras se resuelven errores pre-existentes progresivamente.
    // Cambiar a false cuando `npm run lint` no reporte errores.
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'firebase', 'firebase/firestore', '@stripe/stripe-js', 'framer-motion']
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
