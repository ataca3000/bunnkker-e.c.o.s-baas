"use client";

import Script from 'next/script';

export default function SchemaMarkup({ tenantId = 'default' }: { tenantId?: string }) {
  const isDefault = tenantId === 'default' || tenantId === 'admin.com';
  
  // Normalizar nombre de la tienda
  const storeName = isDefault 
    ? "brechaopensource" 
    : tenantId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const baseUrl = isDefault ? "https://admin.com" : `https://${tenantId}.admin.com`;
  const description = isDefault 
    ? "Agencia de desarrollo de software y tecnología." 
    : `Catálogo oficial de ${storeName}, impulsado de forma segura por TERRAFORM ERP.`;

  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": storeName,
        "alternateName": isDefault ? "brechaopensource" : storeName,
        "url": baseUrl,
        "description": description,
        "telephone": "+52-765-833-5528",
        "email": isDefault ? "brechasolucionesds@outloock.com" : `contacto@${tenantId}.admin.com`,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": isDefault ? "Apizaco" : "México",
          "addressRegion": isDefault ? "Tlaxcala" : "México",
          "addressCountry": "MX"
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${baseUrl}/#software`,
        "name": "TERRAFORM ERP",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, Windows, macOS, Linux, iOS, Android",
        "description": "Enterprise Control & Operating System. El mejor sistema de gestión empresarial, ERP, punto de venta y logística sin depender de la nube.",
        "provider": {
          "@id": `${baseUrl}/#organization`
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
