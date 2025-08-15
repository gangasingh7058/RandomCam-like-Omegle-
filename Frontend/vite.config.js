import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,          // bind to all network interfaces
    port: 5173,
    strictPort: true,
    cors: true,          // allow cross-origin requests
    allowedHosts: [
      '9702175382d2.ngrok-free.app', // replace with your current ngrok host
      'localhost',
    ],
  },
});
