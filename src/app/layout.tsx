import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdminAsistente from "@/components/AdminAsistente";
import AdminLayout from "@/components/admin/AdminLayout";
import UpdateNotification from "@/components/UpdateNotification";
import ConnectionStatus from "@/components/ConnectionStatus";
import SchemaMarkup from "@/components/SchemaMarkup";
import UsbLockScreen from "@/components/UsbLockScreen";

const inter = { className: "font-sans" };

import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'default';
  const host = headersList.get('host') || 'admin.com';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const defaultVerification = {
    google: 'CRRkmj4XJ1qPMAkpFbfzftUC4kS0viq_JgEFG_YvG3Y'
  };

  if (tenantId === 'default' || tenantId === 'admin.com') {
    return {
      title: "BUNKKER E.C.O.S. | Sistema ERP",
      description: "BUNKKER E.C.O.S. — Ecosistema Comercial Offline Sincronizado. El mejor sistema de gestión empresarial, punto de venta y logística para PYMEs.",
      keywords: ["BUNKKER", "BUNKKER ERP", "ERP", "punto de venta", "gestión empresarial", "facturación", "local-first"],
      manifest: '/manifest.json',
      verification: defaultVerification,
      alternates: {
        canonical: baseUrl,
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title: "BUNKKER E.C.O.S. | Sistema ERP",
        description: "BUNKKER E.C.O.S. — Ecosistema Comercial Offline Sincronizado. El mejor sistema de gestión empresarial, punto de venta y logística para PYMEs.",
        url: baseUrl,
        siteName: "BUNKKER E.C.O.S.",
        locale: "es_MX",
        type: "website",
      }
    };
  }

  // Capitalizar el nombre del tenant para usarlo como título base
  const storeName = tenantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return {
    title: `${storeName} | Tienda`,
    description: `Catálogo oficial de ${storeName}, impulsado de forma segura por BUNKKER E.C.O.S.`,
    manifest: '/manifest.json',
    verification: defaultVerification,
    alternates: {
      canonical: baseUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${storeName} | Tienda`,
      description: `Catálogo oficial de ${storeName}, impulsado de forma segura por BUNKKER E.C.O.S.`,
      url: baseUrl,
      siteName: storeName,
      locale: "es_MX",
      type: "website",
    }
  };
}

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
};

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import ClickSoundProvider from "@/components/ClickSoundProvider";
import AntiDevTools from "@/components/AntiDevTools";
import DeviceLockScreen from "@/components/DeviceLockScreen";
import ParticlesBackground from "@/components/ParticlesBackground";
import ToastContainer from "@/components/ToastContainer";
import { Analytics } from '@vercel/analytics/next';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'default';

  return (
    <html lang="es" className="bg-[var(--terraform-surface)]">
      <body className={`${inter.className} bg-[var(--terraform-surface)] text-[var(--terraform-ink)] antialiased font-sans`}>
        <SchemaMarkup />
        <UsbLockScreen />
        <div className="flex flex-col min-h-screen">
          <AuthProvider>
            <DeviceLockScreen>
              <CartProvider>
                <ConnectionStatus />
                <Navbar />
                <AdminLayout>
                  {children}
                </AdminLayout>
                <AdminAsistente />
                <ClickSoundProvider />
                <UpdateNotification />
                <Footer />
                <ToastContainer />
              </CartProvider>
            </DeviceLockScreen>
          </AuthProvider>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
