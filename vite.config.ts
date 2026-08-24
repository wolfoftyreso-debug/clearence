import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Huvudchunken under 400 kB (Excellence-krav 11): ramverket och
        // datalagret bor i egna, långlivat cachade chunkar. Diagrammen
        // (recharts) splittras redan via ChartSlots lazy-import.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
          return undefined;
        },
      },
    },
  },
}));
