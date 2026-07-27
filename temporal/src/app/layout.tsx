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
      title: "TERRAFORM ERP | Sistema Integral",
      description: "TERRAFORM ERP - Desarrollado por brechaopensource. El mejor sistema de gestión empresarial, punto de venta y logística.",
      keywords: ["TERRAFORM ERP", "brechaopensource", "ERP", "punto de venta", "gestión empresarial", "facturación"],
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
        title: "TERRAFORM ERP | Sistema Integral",
        description: "TERRAFORM ERP - Desarrollado por brechaopensource. El mejor sistema de gestión empresarial, punto de venta y logística.",
        url: baseUrl,
        siteName: "TERRAFORM ERP",
        locale: "es_MX",
        type: "website",
      }
    };
  }

  // Capitalizar el nombre del tenant para usarlo como título base
  const storeName = tenantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return {
    title: `${storeName} | Tienda`,
    description: `Catálogo oficial de ${storeName}, impulsado de forma segura por TERRAFORM ERP.`,
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
      description: `Catálogo oficial de ${storeName}, impulsado de forma segura por TERRAFORM ERP.`,
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
import DevCodeMinimap from "@/components/DevCodeMinimap";
import ClickSoundProvider from "@/components/ClickSoundProvider";
import AntiDevTools from "@/components/AntiDevTools";
import DeviceLockScreen from "@/components/DeviceLockScreen";
import ParticlesBackground from "@/components/ParticlesBackground";
import ToastContainer from "@/components/ToastContainer";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'default';

  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-900 text-slate-200 antialiased font-sans`}>
        <SchemaMarkup />
        <ConnectionStatus />
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
                <DevCodeMinimap />
                <ClickSoundProvider />
                <UpdateNotification />
                <Footer />
                <ToastContainer />
              </CartProvider>
            </DeviceLockScreen>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
