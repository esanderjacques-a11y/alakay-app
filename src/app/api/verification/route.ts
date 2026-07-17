export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fetchBillingBundle, submitVerificationApplication } from "@/lib/billing/server";

type Body = {
  userId?: string;
  program?: "haiti_farmer" | "earth_university";
  fullName?: string;
  email?: string;
  country?: string;
  institution?: string;
  studentId?: string;
  message?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) {
    return Response.json({ error: "Missing userId." }, { status: 400 });
  }
  const bundle = await fetchBillingBundle(userId);
  return Response.json({ verification: bundle.verification });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const userId = body.userId?.trim();
    const program = body.program;
    const fullName = body.fullName?.trim();
    const email = body.email?.trim();
    const country = body.country?.trim();

    if (!userId || !program || !fullName || !email || !country) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    await submitVerificationApplication(userId, {
      program,
      fullName,
      email,
      country,
      institution: body.institution?.trim(),
      studentId: body.studentId?.trim(),
      message: body.message?.trim(),
    });

    const bundle = await fetchBillingBundle(userId);
    return Response.json({ verification: bundle.verification });
  } catch (error) {
    console.error("Verification apply error:", error);
    return Response.json({ error: "Could not submit application." }, { status: 500 });
  }
}
