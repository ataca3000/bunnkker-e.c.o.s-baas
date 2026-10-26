const https = require('https');

https.get('https://bunnkker-e-c-o-s-baas.vercel.app', (res) => {
  let html = '';
  res.on('data', chunk => { html += chunk; });
  res.on('end', async () => {
    const regex = /(?:src|href)=["']([^"']+)["']/g;
    const matches = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(match[1]);
    }
    const unique = [...new Set(matches)];
    console.log('Total asset matches:', unique.length);

    // Filter relevant assets
    const assets = unique.filter(u => 
      u.startsWith('http') || u.startsWith('/_next') || u.startsWith('/images') || u.match(/\.(png|jpg|webp|mp4|webm|svg|css|js)/i)
    );

    console.log('--- ASSETS ---');
    for (const url of assets) {
      const fullUrl = url.startsWith('http') ? url : `https://bunnkker-e-c-o-s-baas.vercel.app${url}`;
      try {
        const headRes = await fetch(fullUrl, { method: 'HEAD' });
        const size = headRes.headers.get('content-length');
        const type = headRes.headers.get('content-type');
        console.log(`${Math.round((size || 0)/1024)} KiB | ${type} | ${fullUrl}`);
      } catch (err) {
        console.log(`ERR | ${fullUrl}: ${err.message}`);
      }
    }
  });
});
