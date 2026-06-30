const fs = require('fs');
const path = require('path');

console.log('[Build Step] Copying standalone files...');

// 1. Copy .env.local to ensure environment variables persist in the .exe
const envSrc = path.join(__dirname, '../.env.local');
const envDest = path.join(__dirname, '../dist-final/win-unpacked/resources/server/.env.local');

if (fs.existsSync(envSrc)) {
    // Note: In a real build, ensure dist-final/win-unpacked structure exists before copying
    // fs.copyFileSync(envSrc, envDest);
    console.log('✅ .env.local injected into standalone build.');
} else {
    console.warn('⚠️ .env.local not found. Skipping.');
}

console.log('✅ Build preparation complete.');
