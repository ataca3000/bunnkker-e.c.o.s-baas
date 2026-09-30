"use client";

import { usePathname } from "next/navigation";

import Link from "next/link";

export default function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <footer style={{ backgroundColor: '#0F172A', color: '#64748B', padding: '1.5rem', borderTop: '1px solid #1E293B', fontSize: '0.65rem', textAlign: 'center' }}>
      <p style={{ margin: 0 }}>
        &copy; {new Date().getFullYear()} BUNKKER E.C.O.S. Todos los derechos reservados.
      </p>
      <div style={{ margin: '8px 0', display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <Link href="/privacidad" style={{ color: '#06b6d4', textDecoration: 'none' }}>
          Política de Privacidad
        </Link>
        <span style={{ color: '#334155' }}>•</span>
        <Link href="/terminos" style={{ color: '#06b6d4', textDecoration: 'none' }}>
          Términos de Servicio
        </Link>
        <span style={{ color: '#334155' }}>•</span>
        <Link href="/cookies" style={{ color: '#06b6d4', textDecoration: 'none' }}>
          Cookies y Almacenamiento
        </Link>
      </div>
      <p style={{ color: '#475569', fontSize: '0.6rem', margin: 0 }}>
        Desarrollado por Brecha Solución S.A. de C.V.
      </p>
    </footer>
  );
}
