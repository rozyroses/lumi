import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/lumi/",
  build: {
    rollupOptions: {
      input: "source.html",
      output: {
        entryFileNames: "assets/lumi-app.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) =>
          assetInfo.names?.some((name) => /\.css$/.test(name))
            ? "assets/lumi-app.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
