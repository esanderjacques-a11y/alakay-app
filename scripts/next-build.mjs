import { existsSync, readFileSync, openSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const devDistDir = ".next-dev";
const devLockPath = join(process.cwd(), devDistDir, "dev", "lock");

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

function readDevPid() {
  if (!existsSync(devLockPath)) return null;

  try {
    const lock = JSON.parse(readFileSync(devLockPath, "utf8"));
    const pid = Number(lock?.pid);

    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilStopped(pid) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!isRunning(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: cleanDuplicatePath(process.env),
      stdio: "inherit",
      windowsHide: false,
      ...options,
    });

    child.on("exit", (code) => resolve(code ?? 0));
  });
}

function startDevServer() {
  const out = openSync("dev-server.log", "w");
  const child = spawn("cmd.exe", ["/d", "/c", "node scripts\\next-dev.mjs"], {
    cwd: process.cwd(),
    env: cleanDuplicatePath(process.env),
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });

  child.unref();
  console.log("Restarted localhost dev server.");
}

async function waitForDevServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://localhost:3000");

      if (response.ok) {
        console.log("Localhost dev server is ready.");
        return;
      }
    } catch {
      // Keep waiting.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.warn("Build finished, but localhost did not respond before timeout.");
}

const devPid = readDevPid();
const shouldRestartDev = devPid !== null && isRunning(devPid);

if (shouldRestartDev) {
  console.log(`Stopping localhost dev server before build (PID ${devPid}).`);
  try {
    process.kill(devPid, "SIGTERM");
  } catch {
    // It may already be gone.
  }
  await waitUntilStopped(devPid);
}

const nextCommand = process.platform === "win32" ? "cmd.exe" : "node_modules/.bin/next";
const nextArgs =
  process.platform === "win32"
    ? ["/d", "/c", "node_modules\\.bin\\next.cmd build"]
    : ["build"];

const buildCode = await run(nextCommand, nextArgs);

if (shouldRestartDev) {
  startDevServer();
  await waitForDevServer();
}

process.exit(buildCode);
