import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const sourceImage = path.resolve('src/assets/images/android_app_icon_1790870444731.jpg');

const targets = [
  // Android Mipmap densities
  { dir: 'android/app/src/main/res/mipmap-mdpi', file: 'ic_launcher.png', size: 48 },
  { dir: 'android/app/src/main/res/mipmap-mdpi', file: 'ic_launcher_round.png', size: 48 },
  { dir: 'android/app/src/main/res/mipmap-mdpi', file: 'ic_launcher_foreground.png', size: 108 },

  { dir: 'android/app/src/main/res/mipmap-hdpi', file: 'ic_launcher.png', size: 72 },
  { dir: 'android/app/src/main/res/mipmap-hdpi', file: 'ic_launcher_round.png', size: 72 },
  { dir: 'android/app/src/main/res/mipmap-hdpi', file: 'ic_launcher_foreground.png', size: 162 },

  { dir: 'android/app/src/main/res/mipmap-xhdpi', file: 'ic_launcher.png', size: 96 },
  { dir: 'android/app/src/main/res/mipmap-xhdpi', file: 'ic_launcher_round.png', size: 96 },
  { dir: 'android/app/src/main/res/mipmap-xhdpi', file: 'ic_launcher_foreground.png', size: 216 },

  { dir: 'android/app/src/main/res/mipmap-xxhdpi', file: 'ic_launcher.png', size: 144 },
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', file: 'ic_launcher_round.png', size: 144 },
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', file: 'ic_launcher_foreground.png', size: 324 },

  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', file: 'ic_launcher.png', size: 192 },
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', file: 'ic_launcher_round.png', size: 192 },
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', file: 'ic_launcher_foreground.png', size: 432 },

  // Web & PWA icons
  { dir: 'public', file: 'pwa-192x192.png', size: 192 },
  { dir: 'public', file: 'pwa-512x512.png', size: 512 },
  { dir: 'public', file: 'apple-touch-icon.png', size: 180 },
  { dir: 'public', file: 'favicon.png', size: 64 }
];

async function generateIcons() {
  console.log('Loading source master image:', sourceImage);
  const image = await Jimp.read(sourceImage);

  for (const target of targets) {
    const targetDir = path.resolve(target.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, target.file);
    const cloned = image.clone();
    cloned.resize({ w: target.size, h: target.size });
    await cloned.write(targetPath);
    console.log(`Generated: ${target.dir}/${target.file} (${target.size}x${target.size})`);
  }

  console.log('All Android and Web icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
