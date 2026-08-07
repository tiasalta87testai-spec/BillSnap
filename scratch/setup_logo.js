const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../iconalogo/iconalogo.png');
const publicDir = path.join(__dirname, '../public');
const iconsDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

if (fs.existsSync(srcPath)) {
  // Copy to /public/logo.png
  fs.copyFileSync(srcPath, path.join(publicDir, 'logo.png'));
  // Copy to icons
  fs.copyFileSync(srcPath, path.join(iconsDir, 'icon-512.png'));
  fs.copyFileSync(srcPath, path.join(iconsDir, 'icon-192.png'));
  fs.copyFileSync(srcPath, path.join(iconsDir, 'apple-touch-icon.png'));
  fs.copyFileSync(srcPath, path.join(publicDir, 'favicon.ico'));
  console.log('Logo e icone aggiornati con successo da iconalogo.png!');
} else {
  console.error('File iconalogo.png non trovato a path:', srcPath);
}
