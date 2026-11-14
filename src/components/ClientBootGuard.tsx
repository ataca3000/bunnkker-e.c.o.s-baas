"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearStaffSession } from '@/lib/staffAuth';

const KIOSK_KEY = 'bunkker_client_kiosk';

export default function ClientBootGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const lockKiosk = params.get('lock') === '1';

    if (mode === 'client') {
      sessionStorage.setItem(KIOSK_KEY, '1');
      document.documentElement.dataset.kioskMode = 'client';
      if (lockKiosk) {
        clearStaffSession();
      }
    } else if (mode === 'staff' || pathname === '/login' || pathname === '/pair') {
      sessionStorage.removeItem(KIOSK_KEY);
      delete document.documentElement.dataset.kioskMode;
    }

    const isKioskActive = sessionStorage.getItem(KIOSK_KEY) === '1';
    if (isKioskActive) {
      document.documentElement.dataset.kioskMode = 'client';
      if (pathname?.startsWith('/dashboard')) {
        router.replace('/?mode=client');
      }
    }
  }, [pathname, router]);

  return <>{children}</>;
}
