import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// پیکربندی دو پنجره مجزا برای بیلد نهایی در Tauri
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        widget: resolve(__dirname, "widget.html"),
      },
    },
  },
});