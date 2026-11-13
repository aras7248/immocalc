import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF- und DOCX-Parser laufen nur im Node-Backend. Als externe Pakete
  // vermeiden wir, dass Webpack deren Worker-Code in die Route bündelt.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/expose-file-import": [
      "./node_modules/.pnpm/@napi-rs+canvas-linux-x64-gnu@*/node_modules/@napi-rs/canvas-linux-x64-gnu/*.node",
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/*.mjs",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
