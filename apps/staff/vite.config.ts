import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/staff/" : "/",
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
}));
