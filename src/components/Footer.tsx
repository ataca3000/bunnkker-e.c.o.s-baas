"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <footer style={{ backgroundColor: '#0F172A', color: '#64748B', padding: '1.5rem', borderTop: '1px solid #1E293B', fontSize: '0.65rem', textAlign: 'center' }}>
      <p style={{ margin: 0 }}>
        &copy; {new Date().getFullYear()} bunkker Todos los derechos reservados.
      </p>
      <a 
        href="http://localhost:3000" 
        target="_blank" 
        rel="noopener noreferrer" 
        style={{ color: '#475569', textDecoration: 'none', fontSize: '0.6rem', marginTop: '4px', display: 'inline-block' }}
      >
        Desarrollado por Brecha Solución S.A. de C.V.
      </a>
    </footer>
  );
}
