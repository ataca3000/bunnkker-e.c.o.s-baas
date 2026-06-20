import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdminAsistente from "@/components/AdminAsistente";
import AdminLayout from "@/components/admin/AdminLayout";
import UpdateNotification from "@/components/UpdateNotification";
import ConnectionStatus from "@/components/ConnectionStatus";

const inter = { className: "font-sans" };

import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  // En Next.js 15, await headers() es necesario
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'default';

  if (tenantId === 'default' || tenantId === 'admin.com') {
    return {
      title: "EvoStore ERP",
      description: "Sistema integral de gestión empresarial — EvoStore ERP",
      manifest: '/manifest.json',
      verification: {
        google: 'CRRkmj4XJ1qPMAkpFbfzftUC4kS0viq_JgEFG_YvG3Y'
      }
    };
  }

  // Capitalizar el nombre del tenant para usarlo como título base
  const storeName = tenantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return {
    title: `${storeName} | Tienda`,
    description: `Catálogo oficial de ${storeName}, impulsado de forma segura por EvoStore ERP.`,
    manifest: '/manifest.json',
    verification: {
      google: 'CRRkmj4XJ1qPMAkpFbfzftUC4kS0viq_JgEFG_YvG3Y'
    }
  };
}

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
};

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import WalkieTalkieRadio from "@/components/WalkieTalkieRadio";
import ClickSoundProvider from "@/components/ClickSoundProvider";
import AntiDevTools from "@/components/AntiDevTools";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
          <AntiDevTools />
          <AuthProvider>
            <CartProvider>
              <ConnectionStatus />
              <Navbar />
              <AdminLayout>
                {children}
              </AdminLayout>
              <AdminAsistente />
              <WalkieTalkieRadio />
              <ClickSoundProvider />
              <UpdateNotification />
              <Footer />
            </CartProvider>
          </AuthProvider>
      </body>
    </html>
  );
}
