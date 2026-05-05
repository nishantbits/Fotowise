import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Generate dummy icon
const generateIcons = async () => {
  const iconPath = path.join(__dirname, '..', '..', 'client', 'public', 'icons');
  if (!fs.existsSync(iconPath)) {
    fs.mkdirSync(iconPath, { recursive: true });
  }

  // Create an SVG string for generating the base icon
  const svgBuffer = Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#22c55e" />
      <circle cx="256" cy="256" r="180" fill="#ffffff" />
      <text x="256" y="320" font-family="sans-serif" font-size="200" text-anchor="middle" font-weight="bold" fill="#22c55e">F</text>
    </svg>
  `);

  try {
    console.log('Generating 192x192 icon...');
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(iconPath, 'icon-192x192.png'));

    console.log('Generating 512x512 icon...');
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(iconPath, 'icon-512x512.png'));
      
    // Create Apple Touch Icon as well for better compatibility
    console.log('Generating 180x180 apple touch icon...');
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(iconPath, 'apple-touch-icon.png'));

    // Create favicon
    console.log('Generating 64x64 favicon...');
    await sharp(svgBuffer)
      .resize(64, 64)
      .png()
      .toFile(path.join(iconPath, 'favicon.png'));

    console.log('Icons generated successfully ✅');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
};

generateIcons();
