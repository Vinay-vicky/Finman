import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
})
