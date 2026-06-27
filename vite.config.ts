import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'inline',
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'tailwind-cache',
                  expiration: {
                    maxEntries: 5,
                    maxAgeSeconds: 60 * 60 * 24 // 1 day
                  },
                  networkTimeoutSeconds: 3
                }
              }
            ]
          },
          manifest: {
            name: 'ProContractor',
            short_name: 'ProContractor',
            description: 'GPS-stamped time tracking for construction teams',
            theme_color: '#f97316',
            background_color: '#101726',
            display: 'standalone',
            orientation: 'portrait-primary',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: '/pwa-icon.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              },
              {
                src: '/pwa-icon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          },
          devOptions: {
            enabled: false // Disable in development for faster builds
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'esnext',
        minify: 'esbuild',
        cssMinify: 'esbuild',
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              lucide: ['lucide-react'],
              pdf: ['jspdf', 'jspdf-autotable'],
              ai: ['@google/genai'],
            },
            // Use content hash for better caching
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
            assetFileNames: 'assets/[name].[hash].[ext]',
          },
        },
        // Enable source maps for debugging
        sourcemap: !isProd,
        // Reduce chunk size warnings
        chunkSizeWarningLimit: 1000,
        // Optimize CSS extraction
        cssCodeSplit: true,
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'lucide-react', 'jspdf', 'jspdf-autotable'],
        exclude: ['@google/genai'],
      },
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
        legalComments: 'none',
      },
    };
});
