export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAdminEmail } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  email?: string;
  action?: "list" | "approve" | "reject";
  id?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json({ error: "Admin storage is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as Body;
  const email = body.email?.trim().toLowerCase();
  if (!email || !isAdminEmail(email)) {
    return Response.json({ error: "Unauthorized." }, { status: 403 });
  }

  if (body.action === "list") {
    const { data, error } = await admin
      .from("verification_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ items: data || [] });
  }

  if ((body.action === "approve" || body.action === "reject") && body.id) {
    const status = body.action === "approve" ? "approved" : "rejected";
    const { data: application, error } = await admin
      .from("verification_applications")
      .update({
        status,
        admin_notes: body.notes?.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select("*")
      .single();

    if (error || !application) {
      return Response.json({ error: error?.message || "Not found." }, { status: 500 });
    }

    const badge =
      status === "approved" && application.program === "haiti_farmer"
        ? "Verified Haiti Farmer"
        : status === "approved" && application.program === "earth_university"
          ? "EARTH University Verified"
          : null;

    await admin
      .from("profiles")
      .update({
        verification_program: application.program,
        verification_status: status,
        verification_badge: badge,
      })
      .eq("user_id", application.user_id);

    return Response.json({ ok: true, application });
  }

  return Response.json({ error: "Invalid action." }, { status: 400 });
}
