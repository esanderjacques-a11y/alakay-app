import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const distDir = ".next-dev";
const lockPath = join(process.cwd(), distDir, "dev", "lock");

function cleanDuplicatePath(env) {
  const nextEnv = {};

  for (const [key, value] of Object.entries(env)) {
    if (key.toLowerCase() !== "path") {
      nextEnv[key] = value;
    }
  }

  nextEnv.Path = env.Path || env.PATH || "";
  return nextEnv;
}

function removeStaleLock() {
  if (!existsSync(lockPath)) return;

  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const pid = Number(lock?.pid);

    if (Number.isFinite(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        console.error(
          `Dev server already running (PID ${pid}) at ${
            lock.appUrl ?? "http://localhost:3000"
          }.`
        );
        console.error("Stop that process before starting another dev server.");
        process.exit(1);
      } catch {
        // Process is gone; remove stale lock.
      }
    }
  } catch {
    // Invalid lock; remove it below.
  }

  unlinkSync(lockPath);
  console.log(`Removed stale ${distDir} dev lock.`);
}

removeStaleLock();

const env = {
  ...cleanDuplicatePath(process.env),
  NEXT_DIST_DIR: distDir,
};

const command =
  process.platform === "win32"
    ? "cmd.exe"
    : join(process.cwd(), "node_modules", ".bin", "next");

const args =
  process.platform === "win32"
    ? [
        "/d",
        "/c",
        `node_modules\\.bin\\next.cmd dev --webpack ${process.argv
          .slice(2)
          .join(" ")}`.trim(),
      ]
    : ["dev", "--webpack", ...process.argv.slice(2)];

const child = spawn(command, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  windowsHide: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
