const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.resolve(__dirname, '..', 'public');

// Vector SVG para BUNKKER E.C.O.S. (Emblema Búnker Hexagonal + P2P Mesh + Letra B)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b132b" />
      <stop offset="50%" stop-color="#1c2541" />
      <stop offset="100%" stop-color="#0b132b" />
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2ff" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Fondo con esquinas redondeadas -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="4"/>

  <!-- Malla de Búnker / Escudo Hexagonal Exterior -->
  <polygon points="256,60 416,152 416,360 256,452 96,360 96,152" 
           fill="none" stroke="url(#cyanGrad)" stroke-width="12" stroke-linejoin="round" opacity="0.4"/>

  <!-- Escudo Interior con Glow -->
  <polygon points="256,90 388,168 388,344 256,422 124,344 124,168" 
           fill="#0f172a" stroke="url(#glowGrad)" stroke-width="14" stroke-linejoin="round" filter="url(#neonGlow)"/>

  <!-- Nodos de red P2P en los vértices -->
  <circle cx="256" cy="90" r="10" fill="#38bdf8"/>
  <circle cx="388" cy="168" r="10" fill="#38bdf8"/>
  <circle cx="388" cy="344" r="10" fill="#38bdf8"/>
  <circle cx="256" cy="422" r="10" fill="#38bdf8"/>
  <circle cx="124" cy="344" r="10" fill="#38bdf8"/>
  <circle cx="124" cy="168" r="10" fill="#38bdf8"/>

  <!-- Logotipo Estilizado "B" Cyber/Industrial -->
  <!-- Columna principal -->
  <path d="M 190 160 L 190 352" stroke="white" stroke-width="32" stroke-linecap="round"/>
  
  <!-- Lóbulo Superior -->
  <path d="M 190 176 L 270 176 C 315 176, 315 240, 270 240 L 190 240" 
        fill="none" stroke="url(#cyanGrad)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
        
  <!-- Lóbulo Inferior -->
  <path d="M 190 240 L 285 240 C 335 240, 335 336, 285 336 L 190 336" 
        fill="none" stroke="url(#cyanGrad)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Punto Central Núcleo E.C.O.S -->
  <circle cx="256" cy="256" r="14" fill="#00f2ff" filter="url(#neonGlow)"/>
</svg>`;

// Vector Maskable SVG (sin redondeo de esquinas exterior para permitir que Android recorte en círculo/squircle)
const iconMaskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b132b" />
      <stop offset="50%" stop-color="#1c2541" />
      <stop offset="100%" stop-color="#0b132b" />
    </linearGradient>
    <linearGradient id="cyanGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="glowGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2ff" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <filter id="neonGlowMask" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Fondo completo cuadrado -->
  <rect width="512" height="512" fill="url(#bgGradMask)"/>

  <!-- Zona segura 80% (Escudo Búnker centrado) -->
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <polygon points="256,60 416,152 416,360 256,452 96,360 96,152" 
             fill="none" stroke="url(#cyanGradMask)" stroke-width="12" stroke-linejoin="round" opacity="0.4"/>

    <polygon points="256,90 388,168 388,344 256,422 124,344 124,168" 
             fill="#0f172a" stroke="url(#glowGradMask)" stroke-width="14" stroke-linejoin="round" filter="url(#neonGlowMask)"/>

    <circle cx="256" cy="90" r="10" fill="#38bdf8"/>
    <circle cx="388" cy="168" r="10" fill="#38bdf8"/>
    <circle cx="388" cy="344" r="10" fill="#38bdf8"/>
    <circle cx="256" cy="422" r="10" fill="#38bdf8"/>
    <circle cx="124" cy="344" r="10" fill="#38bdf8"/>
    <circle cx="124" cy="168" r="10" fill="#38bdf8"/>

    <path d="M 190 160 L 190 352" stroke="white" stroke-width="32" stroke-linecap="round"/>
    
    <path d="M 190 176 L 270 176 C 315 176, 315 240, 270 240 L 190 240" 
          fill="none" stroke="url(#cyanGradMask)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
          
    <path d="M 190 240 L 285 240 C 335 240, 335 336, 285 336 L 190 336" 
          fill="none" stroke="url(#cyanGradMask)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>

    <circle cx="256" cy="256" r="14" fill="#00f2ff" filter="url(#neonGlowMask)"/>
  </g>
</svg>`;

async function generate() {
  console.log('⚡ Generando assets PWA para BUNKKER E.C.O.S...');

  // 1. Guardar SVG actualizados
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), iconMaskableSvg, 'utf8');
  console.log('✅ icon.svg y icon-maskable.svg actualizados con diseño BUNKKER.');

  // 2. Generar PNGs
  const svgBuffer = Buffer.from(iconSvg);
  const maskableSvgBuffer = Buffer.from(iconMaskableSvg);

  const targets = [
    { name: 'icon-192x192.png', size: 192, buffer: svgBuffer },
    { name: 'icon-512x512.png', size: 512, buffer: svgBuffer },
    { name: 'icon-maskable-192x192.png', size: 192, buffer: maskableSvgBuffer },
    { name: 'icon-maskable-512x512.png', size: 512, buffer: maskableSvgBuffer },
    { name: 'apple-touch-icon.png', size: 180, buffer: svgBuffer },
    { name: 'favicon-32x32.png', size: 32, buffer: svgBuffer },
    { name: 'favicon-16x16.png', size: 16, buffer: svgBuffer },
  ];

  for (const t of targets) {
    await sharp(t.buffer)
      .resize(t.size, t.size)
      .png({ quality: 95, compressionLevel: 9 })
      .toFile(path.join(publicDir, t.name));
    console.log(`✅ Generado public/${t.name} (${t.size}x${t.size})`);
  }

  // 3. Generar Screenshots para PWA Store / Install Prompt
  const previewPath = path.join(publicDir, 'dashboard_preview.png');
  if (fs.existsSync(previewPath)) {
    await sharp(previewPath)
      .resize(1280, 720, { fit: 'cover', position: 'top' })
      .png({ quality: 90 })
      .toFile(path.join(publicDir, 'screenshot-desktop.png'));
    console.log('✅ Generado public/screenshot-desktop.png (1280x720)');

    await sharp(previewPath)
      .resize(750, 1334, { fit: 'cover', position: 'left' })
      .png({ quality: 90 })
      .toFile(path.join(publicDir, 'screenshot-mobile.png'));
    console.log('✅ Generado public/screenshot-mobile.png (750x1334)');
  }

  console.log('✨ Todos los assets PWA generados con éxito.');
}

generate().catch(err => {
  console.error('Error generando assets PWA:', err);
  process.exit(1);
});
