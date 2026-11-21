import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ command, isPreview, mode }) => {
  const { API_PORT = "3000" } = loadEnv(mode, "../..", "API_PORT");

  return {
    base: command === "build" || isPreview ? "/staff/" : "/",
    plugins: [vue()],
    server: {
      proxy: {
        "/api": `http://127.0.0.1:${API_PORT}`,
      },
    },
  };
});
