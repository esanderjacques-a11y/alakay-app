import path from "node:path";
import type { NextConfig } from "next";

const appRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Parent folder has another package-lock.json; pin the app root so dev/build
  // do not scan the wrong tree.
  outputFileTracingRoot: appRoot,

  allowedDevOrigins: [
    "localhost:3000",
    "http://localhost:3000",
    "127.0.0.1:3000",
    "http://127.0.0.1:3000",
    "10.0.8.159",
    "10.0.8.159:3000",
    "http://10.0.8.159:3000",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.loca.lt",
    "http://192.168.1.10:3000",
  ],
};

export default nextConfig;
