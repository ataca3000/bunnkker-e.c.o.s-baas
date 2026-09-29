import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BUNKKER E.C.O.S. ERP",
    short_name: "BUNKKER",
    description: "Sistema ERP Local-First y Punto de Venta Masivo con Sincronización P2P.",
    start_url: "/",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#0ea5e9",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "finance"],
    lang: "es-MX",
    dir: "ltr",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png"
      },
      {
        src: "/screenshot-mobile.png",
        sizes: "750x1334",
        type: "image/png"
      }
    ]
  };
}
