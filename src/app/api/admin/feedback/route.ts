export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isAdminEmail } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type AdminBody = {
  email?: string;
  action?: "list" | "feature" | "approve" | "delete";
  id?: string;
  featured?: boolean;
  approved?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminBody;
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!isAdminEmail(email)) {
      return Response.json({ error: "Unauthorized." }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json(
        { error: "Server admin client not configured." },
        { status: 503 }
      );
    }

    if (body.action === "list" || !body.action) {
      const { data, error } = await admin
        .from("app_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return Response.json({ items: data || [] });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return Response.json({ error: "Missing id." }, { status: 400 });
    }

    if (body.action === "delete") {
      const { error } = await admin.from("app_feedback").delete().eq("id", id);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    if (body.action === "feature") {
      if (body.featured) {
        await admin
          .from("app_feedback")
          .update({ is_featured: false })
          .eq("is_featured", true);
      }
      const { error } = await admin
        .from("app_feedback")
        .update({ is_featured: Boolean(body.featured) })
        .eq("id", id);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    if (body.action === "approve") {
      const { error } = await admin
        .from("app_feedback")
        .update({ is_approved: Boolean(body.approved) })
        .eq("id", id);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Admin feedback error:", error);
    return Response.json({ error: "Admin request failed." }, { status: 500 });
  }
}
