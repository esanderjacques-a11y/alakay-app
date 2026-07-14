import path from "node:path";
import { execSync } from "node:child_process";
import type { NextConfig } from "next";

const appRoot = path.resolve(__dirname);

function resolveLastChangeDate(): string {
  try {
    const iso = execSync("git log -1 --format=%cI", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (iso) return iso;
  } catch {
    /* git unavailable during build */
  }

  return new Date().toISOString();
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    NEXT_PUBLIC_LAST_CHANGE_DATE: resolveLastChangeDate(),
  },

  // Parent folder has another package-lock.json; pin the app root so dev/build
  // do not scan the wrong tree.
  outputFileTracingRoot: appRoot,

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

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
