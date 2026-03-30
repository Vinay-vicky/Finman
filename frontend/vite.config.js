import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(() => {
  const hmrHost = process.env.VITE_HMR_HOST
  const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
    ? Number(process.env.VITE_HMR_CLIENT_PORT)
    : undefined

  return {
    plugins: [react()],
    // Expose the dev server to phones/tablets on the same network.
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      ...(hmrHost || hmrClientPort
        ? {
            hmr: {
              ...(hmrHost ? { host: hmrHost } : {}),
              ...(hmrClientPort ? { clientPort: hmrClientPort } : {}),
            },
          }
        : {}),
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
    build: {
      chunkSizeWarningLimit: 750,
      modulePreload: {
        polyfill: true,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/src/components/Analytics')) return 'route-analytics';
            if (id.includes('/src/components/Budgets')) return 'route-budgets';
            if (id.includes('/src/components/Reports')) return 'route-reports';
            if (id.includes('/src/components/Calculators')) return 'route-calculators';
            if (id.includes('/src/components/Settings')) return 'route-settings';
            if (id.includes('/src/components/NextLevel')) return 'route-next-level';
            if (id.includes('/src/components/Dashboard')) return 'route-dashboard';

            if (id.includes('node_modules')) {
              if (id.includes('/three/')) return 'three-core';
              if (id.includes('@react-three/fiber') || id.includes('@react-three/drei')) return 'three-react';
              if (id.includes('/gsap/') || id.includes('@gsap/react')) return 'motion';
              if (id.includes('recharts')) return 'charts';
              if (id.includes('@react-oauth/google')) return 'auth';
              if (id.includes('lucide-react')) return 'icons';
              return 'vendor';
            }
          },
        },
      },
    },
  }
})
