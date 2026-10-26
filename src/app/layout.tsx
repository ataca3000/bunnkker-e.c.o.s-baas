import { VercelToolbar } from '@vercel/toolbar/next';
import CookieConsent from '@/components/CookieConsent';
import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
    google: [
      'CRRkmj4XJ1qPMAkpFbfzftUC4kS0viq_JgEFG_YvG3Y',
      'RUykPROROSIAER1hDacV4WS_Op3YAlo0ua4ea6Az8Wo'
    ]
  };

  if (tenantId === 'default' || tenantId === 'admin.com') {
    return {
      title: "BUNKKER ERP | Tecnología que Genera Impacto Real",
      description: "BUNKKER E.C.O.S. — Energía · Control · Optimización · Sostenibilidad. Plataforma de alta tecnología y control operativo autónomo.",
      keywords: ["BUNKKER", "BUNKKER ERP", "ERP", "punto de venta", "gestión empresarial", "facturación", "local-first"],
      manifest: '/manifest.json',
      icons: {
        icon: [
          { url: '/favicon.ico' },
          { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
          { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { url: '/icon.svg', type: 'image/svg+xml' }
        ],
        apple: [
          { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
      },
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
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon.svg', type: 'image/svg+xml' }
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
      ]
    },
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
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeScript } from "@/components/ThemeScript";
import ClickSoundProvider from "@/components/ClickSoundProvider";
import AntiDevTools from "@/components/AntiDevTools";
import DeviceLockScreen from "@/components/DeviceLockScreen";
import ParticlesBackground from "@/components/ParticlesBackground";
import ToastContainer from "@/components/ToastContainer";
import FreemiumLockModal from "@/components/FreemiumLockModal";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ClientBootGuard from "@/components/ClientBootGuard";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'default';
  const shouldInjectToolbar = process.env.NODE_ENV === 'development';

  return (
    <html lang="es" suppressHydrationWarning className="dark bg-[var(--bunkker-surface)]">
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-17871952404"
        />
        <Script
          id="google-analytics-aw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-17871952404');
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-[var(--bunkker-surface)] text-[var(--bunkker-ink)] antialiased font-sans`}>
        <SchemaMarkup />
        <UsbLockScreen />
        <div className="flex flex-col min-h-screen">
          <LanguageProvider>
            <ThemeProvider>
              <AuthProvider>
                <DeviceLockScreen>
                  <CartProvider>
                    <ConnectionStatus />
                    <Navbar />
                    <AdminLayout>
                      <ClientBootGuard>
                        {children}
                      </ClientBootGuard>
                    </AdminLayout>
                    <AdminAsistente />
                    <ClickSoundProvider />
                    <UpdateNotification />
                    <FreemiumLockModal />
                    <Footer />
                    <ToastContainer />
                    <ServiceWorkerRegister />
                  </CartProvider>
                </DeviceLockScreen>
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </div>
        <CookieConsent />
        {shouldInjectToolbar ? <VercelToolbar /> : null}
      </body>
    </html>
  );
}
