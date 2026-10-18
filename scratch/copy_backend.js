import fs from 'node:fs';
import path from 'node:path';

const files = ['app.js', 'server.js', 'sse.js', 'promo.js'];
for (const f of files) {
  if (fs.existsSync(path.join('src', f))) {
    fs.copyFileSync(path.join('src', f), path.join('backend', 'src', f));
    console.log(`Copied ${f} to backend/src/`);
  }
}
