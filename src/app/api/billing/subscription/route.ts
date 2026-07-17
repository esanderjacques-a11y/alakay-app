export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fetchLicensingBundleFromServer } from "@/lib/billing/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; action?: string; planId?: string };
    const userId = body.userId?.trim();
    if (!userId) {
      return Response.json({ error: "Missing userId." }, { status: 400 });
    }
    // Legacy route — redirect clients to /api/billing/license or /api/billing/ai
    return Response.json(fetchLicensingBundleFromServer(userId));
  } catch {
    return Response.json({ error: "Could not update subscription." }, { status: 500 });
  }
}
