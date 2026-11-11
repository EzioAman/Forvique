import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = path.resolve(import.meta.dirname, "./src");

export default defineConfig({
  // relative asset paths so Electron can load the build from file://
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // registry files import "@/components/assistant-ui/elements/x"; shadcn writes them flat into src/components
    alias: [
      { find: "@/components/assistant-ui/elements", replacement: `${src}/components` },
      { find: "@", replacement: src },
    ],
  },
});
