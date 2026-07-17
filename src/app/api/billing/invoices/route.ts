export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fetchBillingBundle } from "@/lib/billing/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) {
    return Response.json({ error: "Missing userId." }, { status: 400 });
  }
  const bundle = await fetchBillingBundle(userId);
  return Response.json({ invoices: bundle.invoices });
}
