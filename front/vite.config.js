import { defineConfig, loadEnv } from "vite";
import dotenv from "dotenv";
import path from "path";

export default defineConfig(({ command, mode, ssrBuild }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  const MODE = process.env.MODE;
  dotenv.config({
    path: path.join(path.resolve(), ".env"),
  });
  if (mode === "development") {
    dotenv.config({
      path: path.join(path.resolve(), `.env.${mode}.${MODE}`),
    });
  }

  return {
    // vite config
    define: {
      __APP_ENV__: env.APP_ENV,
    },
    server: {
      host: process.env.HOST,
      port: process.env.PORT,
      watch: {
        usePolling: true,
      },
      proxy: {
        "/query": {
          target: `http://${process.env.VITE_API_HOST}:${process.env.VITE_API_PORT}`,
          changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/query/, ""),
        },
        "/query/sse": {
          target: `http://${process.env.VITE_API_HOST}:${process.env.VITE_API_PORT}`,
          changeOrigin: true,
          secure: false,
          ws: false,
        },
      },
    },
  };
});
