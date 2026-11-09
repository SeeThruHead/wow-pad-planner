import { foldkit } from "@foldkit/vite-plugin"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "DEV_")
  const server = env["DEV_SERVER"] ?? "http://127.0.0.1:3000"
  return {
    plugins: [foldkit()],
    build: { outDir: "dist/client", emptyOutDir: true, target: "es2022" },
    server: {
      port: Number(env["DEV_PORT"] ?? "5180"),
      proxy: { "/rpc": server, "/auth": server, "/healthz": server }
    }
  }
})
