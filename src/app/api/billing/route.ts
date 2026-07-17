export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  fetchLicensingBundleFromServer,
  getServerBillingConfig,
  syncServerUserState,
} from "@/lib/billing/server";
import type { PersistedUserState } from "@/lib/billing/mockService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) {
    return Response.json({ error: "Missing userId." }, { status: 400 });
  }
  const bundle = fetchLicensingBundleFromServer(userId);
  return Response.json({ ...bundle, config: getServerBillingConfig() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      state?: PersistedUserState;
    };
    const userId = body.userId?.trim();
    if (!userId || !body.state) {
      return Response.json({ error: "Missing userId or state." }, { status: 400 });
    }
    syncServerUserState(userId, body.state);
    return Response.json(fetchLicensingBundleFromServer(userId));
  } catch {
    return Response.json({ error: "Could not sync billing state." }, { status: 500 });
  }
}
