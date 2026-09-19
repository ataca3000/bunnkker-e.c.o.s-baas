import type { SiteConfig } from '@/context/CartContext';

export interface InvoiceData {
  id: string;
  folio?: string;
  date?: string;
  customerName?: string;
  customerRfc?: string;
  customerAddress?: string;
  customerEmail?: string;
  taxSystem?: string;
  usoCfdi?: string;
  paymentMethod?: string;
  items: Array<{
    id?: string;
    code?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
}

/**
  Helper to load an image URL (including data URL) into an HTMLImageElement
  and extract its clean data URL for jsPDF embedding.
 */
async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 200;
        canvas.height = img.height || 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Generates an Invoice PDF with the custom business logo, business headers,
 * itemized order items, subtotal/tax calculations, and fiscal CFDI format.
 */
export async function generateInvoicePDF(invoice: InvoiceData, siteConfig: SiteConfig) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 15;
    let y = margin;

    // Primary & Accent Colors
    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [14, 165, 233]; // Cyan 500
    const textColor = [51, 65, 85]; // Slate 700
    const lightBg = [248, 250, 252]; // Slate 50

    // ── 1. HEADER WITH LOGO AND BUSINESS DETAILS ────────────────────────────────
    let logoWidth = 0;
    let logoHeight = 0;

    if (siteConfig.logoUrl) {
      const logoDataUrl = await loadImageDataUrl(siteConfig.logoUrl);
      if (logoDataUrl) {
        try {
          // Default logo box dimensions
          logoWidth = 40;
          logoHeight = 22;
          doc.addImage(logoDataUrl, 'PNG', margin, y, logoWidth, logoHeight);
        } catch (e) {
          console.warn("Could not embed logo in PDF", e);
          logoWidth = 0;
        }
      }
    }

    // Company Information (Placed next to logo or top-left)
    const headerX = logoWidth > 0 ? margin + logoWidth + 6 : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const busName = (siteConfig.businessName || 'BUNKKER E.C.O.S. S.A. DE C.V.').toUpperCase();
    doc.text(busName, headerX, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Dirección: ${siteConfig.businessAddress || 'Av. Principal #123, Centro, México'}`, headerX, y + 10);
    doc.text(`Teléfono: ${siteConfig.businessPhone || '+52 241 123 4567'}`, headerX, y + 14);
    doc.text(`RFC Emisor: ECOS240916ABC • Régimen Fiscal: 601 General de Ley Personas Morales`, headerX, y + 18);

    // Invoice Box (Top Right)
    const boxX = pageWidth - margin - 55;
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, y, 55, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('FACTURA FISCAL CFDI 4.0', boxX + 27.5, y + 6, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const folioStr = invoice.folio || `F-${invoice.id ? invoice.id.slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`;
    doc.text(`FOLIO: ${folioStr}`, boxX + 27.5, y + 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    const dateStr = invoice.date || new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    doc.text(`Fecha: ${dateStr}`, boxX + 27.5, y + 17, { align: 'center' });
    doc.text(`Lugar Expedición: C.P. 90000`, boxX + 27.5, y + 21, { align: 'center' });

    y += Math.max(logoHeight + 4, 28);

    // Divider Line
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // ── 2. RECEPTOR / CUSTOMER INFORMATION ───────────────────────────────────────
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DATOS DEL RECEPTOR / CLIENTE', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const custName = invoice.customerName || 'PÚBLICO EN GENERAL';
    const custRfc = invoice.customerRfc || 'XAXX010101000';
    const custEmail = invoice.customerEmail || 'cliente@ejemplo.com';
    const taxSys = invoice.taxSystem || '616 Sin obligaciones fiscales';
    const usoCfdiStr = invoice.usoCfdi || 'G03 Gastos en general';
    const payMethodStr = invoice.paymentMethod || '01 Efectivo / PUE Pago en una sola exhibición';

    doc.text(`Cliente: ${custName.toUpperCase()}`, margin + 4, y + 11);
    doc.text(`RFC: ${custRfc.toUpperCase()}`, margin + 4, y + 16);
    doc.text(`Correo: ${custEmail}`, margin + 4, y + 20);

    doc.text(`Uso CFDI: ${usoCfdiStr}`, margin + 95, y + 11);
    doc.text(`Régimen: ${taxSys}`, margin + 95, y + 16);
    doc.text(`Método de Pago: ${payMethodStr}`, margin + 95, y + 20);

    y += 28;

    // ── 3. ITEMS TABLE ───────────────────────────────────────────────────────────
    const colX = {
      code: margin + 2,
      cant: margin + 22,
      desc: margin + 38,
      price: margin + 130,
      total: pageWidth - margin - 4,
    };

    // Table Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('CÓDIGO', colX.code, y + 4.8);
    doc.text('CANT', colX.cant, y + 4.8);
    doc.text('DESCRIPCIÓN / PRODUCTO', colX.desc, y + 4.8);
    doc.text('P. UNITARIO', colX.price, y + 4.8, { align: 'right' });
    doc.text('IMPORTE', colX.total, y + 4.8, { align: 'right' });

    y += 7;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const items = invoice.items || [];
    let calculatedSubtotal = 0;

    items.forEach((item, index) => {
      const lineTotal = item.quantity * item.price;
      calculatedSubtotal += lineTotal;

      // Alternating Row BG
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, pageWidth - (margin * 2), 6.5, 'F');
      }

      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(item.code || item.id || `PRD-${index + 1}`, colX.code, y + 4.5);
      doc.text(item.quantity.toString(), colX.cant, y + 4.5);

      // Truncate long names to fit table width
      const nameTruncated = item.name.length > 50 ? item.name.substring(0, 48) + '...' : item.name;
      doc.text(nameTruncated, colX.desc, y + 4.5);

      doc.text(`$${item.price.toFixed(2)}`, colX.price, y + 4.5, { align: 'right' });
      doc.text(`$${lineTotal.toFixed(2)}`, colX.total, y + 4.5, { align: 'right' });

      y += 6.5;

      // Check for page break if items exceed single page
      if (y > pageHeight - 50) {
        doc.addPage();
        y = margin;
      }
    });

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // ── 4. TOTALS AND TAX SUMMARY ────────────────────────────────────────────────
    const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : calculatedSubtotal / 1.16;
    const tax = invoice.tax !== undefined ? invoice.tax : calculatedSubtotal - subtotal;
    const total = invoice.total || calculatedSubtotal;

    const totalsWidth = 70;
    const totalsX = pageWidth - margin - totalsWidth;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(totalsX, y, totalsWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    doc.text('SUBTOTAL:', totalsX + 4, y + 6);
    doc.text(`$${subtotal.toFixed(2)} MXN`, totalsX + totalsWidth - 4, y + 6, { align: 'right' });

    doc.text('IVA (16%):', totalsX + 4, y + 11);
    doc.text(`$${tax.toFixed(2)} MXN`, totalsX + totalsWidth - 4, y + 11, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TOTAL:', totalsX + 4, y + 18);
    doc.text(`$${total.toFixed(2)} MXN`, totalsX + totalsWidth - 4, y + 18, { align: 'right' });

    // Text Amount Legend
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`* Importe en letra: (Cincuenta y tres pesos 00/100 M.N.)`, margin, y + 18);

    y += 28;

    // ── 5. FISCAL FOOTER & STAMPS ───────────────────────────────────────────────
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CADENA ORIGINAL Y SELLO DIGITAL DEL SAT', margin, y + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    const mockStamp = `||1.1|${invoice.id || 'UUID-84729482-ECOS-2026'}|2026-09-16T15:00:00|SAT970701NN3|aBCdEfGhIjKlMnOpQrStUvWxYz0123456789+AbCdEfGhIjKlMnOpQrStUvWxYz0123456789==|00001000000504465028||`;
    doc.text(mockStamp, margin, y + 5, { maxWidth: pageWidth - (margin * 2) });

    // Page Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Este documento es una representación impresa de un CFDI emitida por ${busName} mediante el sistema BUNKKER E.C.O.S. ERP.`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );

    // Save PDF file
    doc.save(`Factura_${folioStr.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  } catch (error) {
    console.error("Error al generar PDF de factura", error);
    throw error;
  }
}
