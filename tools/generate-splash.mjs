// =====================================================================
// GENERATE iOS SPLASH SCREEN PNGs
// =====================================================================
// Convierte el SVG maestro splash-design.svg a los 11 tamaños
// necesarios para apple-touch-startup-image en iOS.
//
// Uso: node tools/generate-splash.mjs
// Requiere: npm install sharp

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SPLASH_SVG = resolve(root, 'splash', 'splash-design.svg');
const OUTPUT_DIR = resolve(root, 'splash');

// iOS device sizes (portrait) for apple-touch-startup-image
const SIZES = [
  { width: 640,   height: 1136,  name: 'splash-640x1136'   },  // iPhone 5/5S/5C
  { width: 750,   height: 1334,  name: 'splash-750x1334'   },  // iPhone 6/6S/7/8
  { width: 828,   height: 1792,  name: 'splash-828x1792'   },  // iPhone XR/11
  { width: 1125,  height: 2436,  name: 'splash-1125x2436'  },  // iPhone X/XS/11 Pro
  { width: 1170,  height: 2532,  name: 'splash-1170x2532'  },  // iPhone 12/13/14
  { width: 1242,  height: 2208,  name: 'splash-1242x2208'  },  // iPhone 6+/6S+/7+/8+
  { width: 1242,  height: 2688,  name: 'splash-1242x2688'  },  // iPhone XS Max/11 Pro Max
  { width: 1284,  height: 2778,  name: 'splash-1284x2778'  },  // iPhone 12 Pro Max/13 Pro Max/14 Plus
  { width: 1536,  height: 2048,  name: 'splash-1536x2048'  },  // iPad mini/Air 9.7"
  { width: 1668,  height: 2388,  name: 'splash-1668x2388'  },  // iPad Pro 10.5"/11"
  { width: 2048,  height: 2732,  name: 'splash-2048x2732'  },  // iPad Pro 12.9"
];

async function generate() {
  console.log('📐 Generating iOS splash screen PNGs from SVG...\n');

  const svgContent = readFileSync(SPLASH_SVG, 'utf-8');

  for (const { width, height, name } of SIZES) {
    const outputPath = resolve(OUTPUT_DIR, `${name}.png`);

    try {
      await sharp(Buffer.from(svgContent))
        .resize(width, height, {
          fit: 'fill',
          background: { r: 239, g: 246, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log(`  ✅ ${name}.png  (${width}x${height})`);
    } catch (err) {
      console.error(`  ❌ ${name}.png  failed: ${err.message}`);
    }
  }

  console.log('\n✨ Done!');
}

generate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
