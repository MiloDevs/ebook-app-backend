import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Change the import to use your runtime specific build
import build from "@hono/vite-build/node";

export default defineConfig(({ mode }) => {
  if (mode === "client")
    return {
      esbuild: {
        jsxImportSource: "hono/jsx/dom", // Optimized for hono/jsx/dom
      },
      build: {
        rollupOptions: {
          input: "./src/template/book.template.tsx",
          output: {
            entryFileNames: "static/client.js",
          },
        },
      },
    };

  return {
    server: {
      port: 3001,
    },
    plugins: [
      tailwindcss(),
      build({
        entry: "src/index.tsx",
      }),
      devServer({
        entry: "src/index.tsx",
      }),
    ],
  };
});
