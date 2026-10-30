import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    ...(command === "serve"
      ? [
          {
            name: "local-react-refresh-csp",
            transformIndexHtml: (html: string) =>
              html.replace(
                "script-src 'self'",
                "script-src 'self' 'unsafe-inline'",
              ),
          },
        ]
      : []),
  ],
}));
