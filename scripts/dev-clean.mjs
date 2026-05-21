import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const lockPath = join(process.cwd(), ".next", "dev", "lock");

if (!existsSync(lockPath)) {
  process.exit(0);
}

try {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const pid = Number(lock?.pid);

  if (Number.isFinite(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      console.error(
        `Dev server already running (PID ${pid}) at ${lock.appUrl ?? "http://localhost:3000"}.`
      );
      console.error("Stop that process before starting another dev server.");
      process.exit(1);
    } catch {
      // Process is gone; remove stale lock.
    }
  }

  unlinkSync(lockPath);
  console.log("Removed stale Next.js dev lock.");
} catch {
  unlinkSync(lockPath);
  console.log("Removed invalid Next.js dev lock.");
}
