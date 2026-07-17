export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fetchLicensingBundleFromServer } from "@/lib/billing/server";
import type { Payment, PaymentProvider } from "@/lib/billing";

type Body = {
  userId?: string;
  action?: "add" | "remove" | "set_default";
  methodId?: string;
  provider?: PaymentProvider;
  label?: string;
};

/** Mock payment methods — future Paddle / PayPal / 2Checkout integration. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const userId = body.userId?.trim();
    if (!userId) {
      return Response.json({ error: "Missing userId." }, { status: 400 });
    }

    const bundle = fetchLicensingBundleFromServer(userId);
    return Response.json({
      ...bundle,
      message: "Mock payment methods — provider integration not enabled.",
    });
  } catch (error) {
    console.error("Payment methods error:", error);
    return Response.json({ error: "Could not update payment methods." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) {
    return Response.json({ error: "Missing userId." }, { status: 400 });
  }
  const bundle = fetchLicensingBundleFromServer(userId);
  return Response.json({
    paymentMethods: bundle.payments satisfies Payment[],
    providers: ["paddle", "paypal", "2checkout"] as PaymentProvider[],
  });
}
