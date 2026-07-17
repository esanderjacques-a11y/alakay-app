export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAdminEmail } from "@/lib/admin";
import { mergeBillingConfig } from "@/lib/billing";
import {
  getServerBillingConfig,
  setServerBillingConfig,
} from "@/lib/billing/server";
import type { BillingConfig } from "@/lib/billing";

export async function GET() {
  return Response.json(getServerBillingConfig());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    config?: Partial<BillingConfig>;
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !isAdminEmail(email)) {
    return Response.json({ error: "Unauthorized." }, { status: 403 });
  }
  if (!body.config) {
    return Response.json({ error: "Missing config." }, { status: 400 });
  }
  const next = mergeBillingConfig({
    ...getServerBillingConfig(),
    ...body.config,
    softwarePricesCents: {
      ...getServerBillingConfig().softwarePricesCents,
      ...body.config.softwarePricesCents,
    },
    licenseIncludedAi: {
      ...getServerBillingConfig().licenseIncludedAi,
      ...body.config.licenseIncludedAi,
    },
  });
  setServerBillingConfig(next);
  return Response.json(next);
}
