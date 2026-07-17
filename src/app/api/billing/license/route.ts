export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { normalizeLicenseType } from "@/lib/billing";
import { purchaseLicenseOnServer } from "@/lib/billing/server";

type Body = {
  userId?: string;
  licenseType?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const userId = body.userId?.trim();
    const licenseType = normalizeLicenseType(body.licenseType);
    if (!userId) {
      return Response.json({ error: "Missing userId." }, { status: 400 });
    }
    if (licenseType === "free") {
      return Response.json({ error: "Cannot purchase Free tier." }, { status: 400 });
    }
    const bundle = purchaseLicenseOnServer(userId, licenseType);
    return Response.json(bundle);
  } catch {
    return Response.json({ error: "Could not complete license purchase." }, { status: 500 });
  }
}
