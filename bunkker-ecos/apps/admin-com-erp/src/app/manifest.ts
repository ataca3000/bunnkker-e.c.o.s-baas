import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Admin.com ERP",
    short_name: "Admin.com",
    description: "Sistema integral ERP P2P para gestión de recursos, inventario y ventas.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0ea5e9",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "finance"],
    lang: "es-MX",
    dir: "ltr",
    icons: [
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
        src: "/screenshot-desktop.svg",
        sizes: "1280x720",
        type: "image/svg+xml"
      },
      {
        src: "/screenshot-mobile.svg",
        sizes: "720x1280",
        type: "image/svg+xml"
      }
    ]
  };
}
