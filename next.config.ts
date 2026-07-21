import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'playwright', '@axe-core/playwright', 'axe-core', 'pdf-parse',
    // Prevent Turbopack from bundling these — they ship CJS and cause "CJS module can't be async" errors
    'uuid', 'docx', 'pptxgenjs', 'jspdf', 'jspdf-autotable', 'pdf-lib',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
