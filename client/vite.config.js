import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    /*
     *  In development, API calls to /api/* are proxied to the Express
     *  server running on port 8000.
     *
     *  This avoids CORS issues during local development.
     *  In production (Vercel), the VITE_API_BASE_URL env var points
     *  to the deployed server URL instead.
     */
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
