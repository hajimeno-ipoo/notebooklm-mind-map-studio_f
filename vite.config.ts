import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Plugin to copy manifest.json and assets to dist/
const copyAssets = () => {
  return {
    name: 'copy-assets',
    writeBundle() {
      // Ensure dist directory exists
      if (!fs.existsSync(resolve(__dirname, 'dist'))) {
        fs.mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
      }
      
      // Copy manifest.json
      if (fs.existsSync(resolve(__dirname, 'manifest.json'))) {
        fs.copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));
        console.log('Copied manifest.json to dist/');
      }

      // Copy アイコン.png
      if (fs.existsSync(resolve(__dirname, 'アイコン.png'))) {
        fs.copyFileSync(resolve(__dirname, 'アイコン.png'), resolve(__dirname, 'dist/アイコン.png'));
        console.log('Copied アイコン.png to dist/');
      }
      
      // Copy other icons (16.png etc) if they exist in root
      ['16.png', '32.png', '48.png', '128.png'].forEach(file => {
         if (fs.existsSync(resolve(__dirname, file))) {
             fs.copyFileSync(resolve(__dirname, file), resolve(__dirname, `dist/${file}`));
         }
      });
    }
  };
};

// Plugin to remove <script type="importmap"> from index.html during build
const removeImportMap = () => {
  return {
    name: 'remove-import-map',
    transformIndexHtml(html: string) {
      return html.replace(/<script type="importmap">[\s\S]*?<\/script>/gi, '');
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyAssets(), removeImportMap()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'background.ts'),
        content: resolve(__dirname, 'content.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});