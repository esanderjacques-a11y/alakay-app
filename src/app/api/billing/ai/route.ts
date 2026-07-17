export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  cancelAiOnServer,
  subscribeAiOnServer,
} from "@/lib/billing/server";

type Body = {
  userId?: string;
  action?: "subscribe" | "cancel" | "resume";
  planId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const userId = body.userId?.trim();
    const action = body.action;
    if (!userId || !action) {
      return Response.json({ error: "Missing userId or action." }, { status: 400 });
    }

    if (action === "cancel") {
      return Response.json(cancelAiOnServer(userId));
    }

    const planId = body.planId?.trim() || "standard";
    return Response.json(subscribeAiOnServer(userId, planId));
  } catch {
    return Response.json({ error: "Could not update AI subscription." }, { status: 500 });
  }
}
