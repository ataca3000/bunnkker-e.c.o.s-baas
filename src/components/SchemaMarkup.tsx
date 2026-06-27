"use client";

import Script from 'next/script';

export default function SchemaMarkup() {
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://admin.com/#organization",
        "name": "Brecha Soluciones",
        "alternateName": "The Brecha Solutions Company S.A. de C.V.",
        "url": "https://admin.com",
        "description": "Agencia de desarrollo de software y tecnología.",
        "telephone": "+52-765-833-5528",
        "email": "brechasolucionesds@outloock.com",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Apizaco",
          "addressRegion": "Tlaxcala",
          "addressCountry": "MX"
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://admin.com/#software",
        "name": "BUNKKER E.C.O.S",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, Windows, macOS, Linux, iOS, Android",
        "description": "Enterprise Control & Operating System. El mejor sistema de gestión empresarial, ERP, punto de venta y logística sin depender de la nube.",
        "provider": {
          "@id": "https://admin.com/#organization"
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "MXN"
        }
      }
    ]
  };

  return (
    <Script
      id="schema-markup"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
}
