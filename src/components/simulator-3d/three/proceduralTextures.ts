import * as THREE from 'three';

/**
 * Procedural textures generated directly on HTML5 Canvas.
 * Strictly zero external image URLs or 404 dependencies.
 */

// Warehouse concrete floor with expansion joints and industrial safety markings
export function createWarehouseFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base concrete grey
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle concrete noise / grit
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const brightness = Math.floor(Math.random() * 30 - 15);
    ctx.fillStyle = `rgba(${35 + brightness}, ${42 + brightness}, ${53 + brightness}, 0.25)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Expansion grid joints
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  const gridSize = 256;
  for (let x = 0; x <= 1024; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Hazard diagonal yellow and black stripe tape
export function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308'; // Safety yellow
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#111827'; // Dark charcoal black
  const stripeWidth = 32;
  for (let i = -64; i < 300; i += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + stripeWidth, 0);
    ctx.lineTo(i + stripeWidth - 40, 64);
    ctx.lineTo(i - 40, 64);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Cardboard box texture with packing tape, barcode, and handling icons
export function createCardboardTexture(titleText: string = 'FRÁGIL'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Cardboard Kraft Brown
  ctx.fillStyle = '#c59a67';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fiber texture
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(160, 120, 75, 0.15)' : 'rgba(230, 195, 145, 0.15)';
    ctx.fillRect(x, y, 3, 1);
  }

  // Center packing tape
  ctx.fillStyle = '#8a6237';
  ctx.fillRect(0, 220, 512, 72);

  // White shipping label sticker
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(50, 70, 210, 120);

  // Barcode lines
  ctx.fillStyle = '#0f172a';
  for (let x = 65; x < 240; x += 4 + (x % 7)) {
    const w = (x % 3 === 0) ? 3 : 1.5;
    ctx.fillRect(x, 85, w, 40);
  }

  // Label text
  ctx.font = 'bold 12px monospace';
  ctx.fillText('FERRE-EXPRESS #8942', 65, 145);
  ctx.font = '10px sans-serif';
  ctx.fillText('DEST: RUTA CLIENTE', 65, 162);

  // Fragile icon box
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 3;
  ctx.strokeRect(320, 80, 140, 60);
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('▲▲ ' + titleText, 330, 118);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * High-visibility color-coded package texture tailored by destination.
 * - 'caja': Emerald green (#059669 / #10b981) for Store Counter / POS sales.
 * - 'domicilio': Electric Safety Orange (#ea580c / #f97316) for Home Delivery van route.
 * - 'carga': Cyan Blue (#0891b2 / #06b6d4) for Supplier Inbound restock to racks.
 */
export function createDestinationBoxTexture(
  destination: 'caja' | 'domicilio' | 'carga',
  trackingId: string = '#BX-01',
  productName: string = 'Producto Ferretero'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  let primaryColor = '#10b981';
  let darkColor = '#065f46';
  let lightColor = '#34d399';
  let tapeColor = '#047857';
  let badgeTitle = 'MOSTRADOR DE TIENDA';
  let badgeSubtitle = '🏪 VENTA / RETIRO EN CAJA';
  let destBadgeBg = '#10b981';
  let destBadgeText = '#ffffff';

  if (destination === 'domicilio') {
    primaryColor = '#f97316';
    darkColor = '#9a3412';
    lightColor = '#fb923c';
    tapeColor = '#ea580c';
    badgeTitle = 'REPARTO A DOMICILIO';
    badgeSubtitle = '🚚 FERRE-EXPRESS RESIDENCIAL';
    destBadgeBg = '#f97316';
    destBadgeText = '#0f172a';
  } else if (destination === 'carga') {
    primaryColor = '#06b6d4';
    darkColor = '#155e75';
    lightColor = '#38bdf8';
    tapeColor = '#0891b2';
    badgeTitle = 'RECEPCIÓN DE MERCANCÍA';
    badgeSubtitle = '📥 PROVEEDOR -> RACKS BODEGA';
    destBadgeBg = '#06b6d4';
    destBadgeText = '#0f172a';
  }

  // Base background with rich gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, darkColor);
  grad.addColorStop(0.5, primaryColor);
  grad.addColorStop(1, darkColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle industrial grid pattern
  ctx.strokeStyle = lightColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.25;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Heavy duty reinforced packaging cross-tape
  ctx.fillStyle = tapeColor;
  ctx.fillRect(0, 220, 512, 72);
  ctx.fillRect(220, 0, 72, 512);

  // Glowing Tape borders
  ctx.strokeStyle = lightColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 220, 512, 72);
  ctx.strokeRect(220, 0, 72, 512);

  // White Logistics Shipping Label
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 40, 260, 160);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, 260, 160);

  // Destination Pill on Label
  ctx.fillStyle = destBadgeBg;
  ctx.fillRect(50, 50, 240, 32);
  ctx.fillStyle = destBadgeText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badgeTitle, 170, 72);

  // Tracking ID
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(trackingId, 55, 112);

  // Barcode
  ctx.fillStyle = '#0f172a';
  for (let x = 55; x < 285; x += 5 + (x % 5)) {
    const w = (x % 3 === 0) ? 3.5 : 1.5;
    ctx.fillRect(x, 124, w, 32);
  }

  // Verification stamp
  ctx.fillStyle = '#15803d';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('✓ CONTROL CALIDAD OK', 55, 184);

  // Big Destination Stamp on Lower Right
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(280, 310, 210, 170);
  ctx.strokeStyle = lightColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(280, 310, 210, 170);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DESTINO FINAL', 385, 338);

  ctx.fillStyle = lightColor;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(badgeSubtitle, 385, 370);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 13px monospace';
  const truncProd = productName.length > 18 ? productName.substring(0, 16) + '...' : productName;
  ctx.fillText(truncProd, 385, 410);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px sans-serif';
  ctx.fillText('LOGÍSTICA FERRETERA', 385, 450);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Asphalt road texture with yellow & white center lines
export function createRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Dark asphalt
  ctx.fillStyle = '#1c1f26';
  ctx.fillRect(0, 0, 512, 1024);

  // Speckles
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 1024;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // White side margins
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(15, 0, 8, 1024);
  ctx.fillRect(489, 0, 8, 1024);

  // Yellow dashed lane divider
  ctx.fillStyle = '#eab308';
  for (let y = 0; y < 1024; y += 80) {
    ctx.fillRect(250, y + 10, 12, 50);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Signboard generator (e.g. "FERRETERÍA CENTRAL", "ALMACÉN & RACKS")
export function createSignboardTexture(text: string, subtitle?: string, bgColor: string = '#1e3a8a'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 128);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, subtitle ? 52 : 64);

  if (subtitle) {
    ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(subtitle, 256, 92);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * High-fidelity 3D Neon Zone Signboard Texture (Matches the reference maqueta signs)
 * Examples: 'ALMACÉN / SPA', 'SURTIDO / SPA', 'CAJA DE COBRO / SPA', 'ENTREGAS / SPA', 'LOGÍSTICA / SPA', 'ATENCIÓN / SPA'
 */
export function createNeonSignboardTexture(title: string, subtitle: string = 'SPA'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  // Deep tech gradient background
  const grad = ctx.createLinearGradient(0, 0, 768, 192);
  grad.addColorStop(0, '#030712');
  grad.addColorStop(0.5, '#0b1329');
  grad.addColorStop(1, '#030712');
  ctx.fillStyle = grad;

  // Draw rounded pill boundary
  const radius = 32;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 752, 176, radius);
  } else {
    ctx.rect(8, 8, 752, 176);
  }
  ctx.fill();

  // Multi-layered Glowing Neon Cyan Outer & Inner Border
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(14, 14, 740, 164, radius - 4);
  } else {
    ctx.strokeRect(14, 14, 740, 164);
  }
  ctx.stroke();

  // Reset shadow for crisp text
  ctx.shadowBlur = 0;

  // Inner subtle border
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 24, 720, 144, radius - 10);
  } else {
    ctx.strokeRect(24, 24, 720, 144);
  }
  ctx.stroke();

  // Corner tech tick marks
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(40, 32, 12, 3);
  ctx.fillRect(40, 32, 3, 12);
  ctx.fillRect(716, 32, 12, 3);
  ctx.fillRect(725, 32, 3, 12);
  ctx.fillRect(40, 157, 12, 3);
  ctx.fillRect(40, 148, 3, 12);
  ctx.fillRect(716, 157, 12, 3);
  ctx.fillRect(725, 148, 3, 12);

  // Status indicator dot
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(60, 96, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(60, 96, 3, 0, Math.PI * 2);
  ctx.fill();

  // Render Title and Subtitle
  const fullText = subtitle ? `${title} / ${subtitle}` : title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Neon text glow layer
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 48px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(fullText, 400, 96);

  ctx.shadowBlur = 0;
  if (subtitle) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(fullText, 400, 96);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Logistics NOC / Control Center Video Wall Displays
 */
export function createNocScreenTexture(variant: 'map' | 'charts' | 'telemetry'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#050c1e';
  ctx.fillRect(0, 0, 512, 384);

  // Grid lines
  ctx.strokeStyle = '#0f274a';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 384);
    ctx.stroke();
  }
  for (let y = 0; y <= 384; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Header bar
  ctx.fillStyle = '#0a1d3f';
  ctx.fillRect(0, 0, 512, 42);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';

  if (variant === 'map') {
    ctx.fillText('🌐 RED LOGÍSTICA GLOBAL - SPA', 16, 28);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('ONLINE [24/7]', 400, 28);

    // World map continent silhouettes
    ctx.fillStyle = '#1e3a8a';
    for (let i = 0; i < 200; i++) {
      const rx = 50 + (i * 2.1) % 400;
      const ry = 80 + Math.sin(i * 0.4) * 60 + ((i * 7) % 180);
      ctx.fillRect(rx, ry, 3, 3);
    }

    // Glowing logistics routes
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    const hubs = [
      { x: 120, y: 150 },
      { x: 260, y: 190 },
      { x: 380, y: 140 },
      { x: 320, y: 270 },
      { x: 180, y: 280 },
    ];
    for (let i = 0; i < hubs.length; i++) {
      const h1 = hubs[i];
      const h2 = hubs[(i + 1) % hubs.length];
      ctx.beginPath();
      ctx.moveTo(h1.x, h1.y);
      ctx.quadraticCurveTo((h1.x + h2.x) / 2, Math.min(h1.y, h2.y) - 40, h2.x, h2.y);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(h1.x, h1.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (variant === 'charts') {
    ctx.fillText('📊 RENDIMIENTO DE SURTIDO & PEDIDOS', 16, 28);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('142 PKG/H', 410, 28);

    const bars = [45, 62, 85, 94, 78, 110, 135, 142, 128, 150, 165, 158];
    const barWidth = 26;
    const startX = 40;
    const baseY = 320;
    bars.forEach((val, idx) => {
      const x = startX + idx * 36;
      const h = (val / 180) * 220;
      const bGrad = ctx.createLinearGradient(x, baseY, x, baseY - h);
      bGrad.addColorStop(0, '#0284c7');
      bGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = bGrad;
      ctx.fillRect(x, baseY - h, barWidth, h);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${val}`, x + barWidth / 2, baseY - h - 6);
    });
  } else {
    ctx.fillText('⚡ TELEMETRÍA DE FLOTA & ALMACÉN', 16, 28);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('8 VANS EN RUTA', 370, 28);

    const kpis = [
      { label: 'Tiempo Picking', val: '2.4 min', color: '#10b981' },
      { label: 'Eficacia Despacho', val: '99.8%', color: '#38bdf8' },
      { label: 'Capacidad Racks', val: '86.4%', color: '#f59e0b' },
      { label: 'Órdenes Activas', val: '28 und', color: '#ec4899' },
    ];
    kpis.forEach((kpi, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 30 + col * 235;
      const y = 65 + row * 135;
      ctx.fillStyle = '#0a1d3f';
      ctx.fillRect(x, y, 215, 115);
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, 215, 115);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(kpi.label, x + 16, y + 36);

      ctx.fillStyle = kpi.color;
      ctx.font = 'bold 28px monospace';
      ctx.fillText(kpi.val, x + 16, y + 80);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Floor Grid Texture with Glowing Lavender-Navy & Circuit Connections
 */
export function createCircuitGridFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d1322';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = '#18243c';
  ctx.lineWidth = 1;
  const step = 32;
  for (let x = 0; x <= 1024; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#223659';
  ctx.lineWidth = 2;
  const majorStep = 128;
  for (let x = 0; x <= 1024; x += majorStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += majorStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#38bdf8';
  for (let x = 0; x <= 1024; x += majorStep) {
    for (let y = 0; y <= 1024; y += majorStep) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Modular podium top surface textures
 */
export function createModularPodiumTexture(type: 'industrial' | 'office' | 'asphalt' | 'island' | 'residential'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (type === 'industrial') {
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(512, x);
      ctx.stroke();
    }

    ctx.fillStyle = '#eab308';
    ctx.fillRect(32, 40, 448, 8);
    ctx.fillRect(32, 464, 448, 8);
  } else if (type === 'asphalt') {
    ctx.fillStyle = '#141720';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }

    ctx.fillStyle = '#facc15';
    ctx.fillRect(60, 40, 10, 430);
    ctx.fillRect(250, 40, 10, 430);
    ctx.fillRect(440, 40, 10, 430);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(60, 460, 180, 14);
    ctx.fillRect(260, 460, 180, 14);
  } else if (type === 'island') {
    ctx.fillStyle = '#172033';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(200, 20, 112, 472);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.strokeRect(200, 20, 112, 472);

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 464, 464);
  } else if (type === 'residential') {
    // Rich manicured lawn & flagstone stone walkway for Home Delivery
    ctx.fillStyle = '#064e3b'; // Deep emerald lawn
    ctx.fillRect(0, 0, 512, 512);

    // Subtle grass texture
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(20, 83, 45, 0.2)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Flagstone Paver Walkway from driveway to porch
    ctx.fillStyle = '#334155';
    ctx.fillRect(180, 0, 150, 512);

    // Paving stone joints
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    for (let y = 0; y <= 512; y += 48) {
      ctx.beginPath();
      ctx.moveTo(180, y);
      ctx.lineTo(330, y);
      ctx.stroke();
    }

    // Welcoming decorative porch trim
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(160, 480, 190, 12);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, x);
      ctx.lineTo(512, x);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
