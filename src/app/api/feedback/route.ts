export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type FeedbackBody = {
  name?: string;
  email?: string;
  country?: string;
  message?: string;
  rating?: number;
  language?: string;
  userId?: string;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json({ comments: [], featured: null });
  }

  const { data: comments, error } = await admin
    .from("app_feedback")
    .select("id, name, country, message, rating, created_at")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Feedback list error:", error);
    return Response.json({ comments: [], featured: null });
  }

  const { data: featuredRows } = await admin
    .from("app_feedback")
    .select("id, name, country, message, rating, created_at")
    .eq("is_approved", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(1);

  return Response.json({
    comments: comments || [],
    featured: featuredRows?.[0] || null,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackBody;
    const message = cleanText(body.message, 2000);
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 160);
    const country = cleanText(body.country, 120);
    const language = cleanText(body.language, 12);
    const rating =
      typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
        ? Math.round(body.rating)
        : null;
    const userId = cleanText(body.userId, 64) || null;

    if (message.length < 3) {
      return Response.json({ error: "Message is too short." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json(
        {
          error:
            "Feedback storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY on the server and run the feedback migration.",
        },
        { status: 503 }
      );
    }

    const { error } = await admin.from("app_feedback").insert({
      user_id: userId || null,
      name: name || null,
      email: email || null,
      country: country || null,
      message,
      rating,
      language: language || null,
      is_approved: true,
      is_featured: false,
    });

    if (error) {
      console.error("Feedback insert error:", error);
      return Response.json({ error: "Could not save feedback." }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Feedback POST error:", error);
    return Response.json({ error: "Unexpected error." }, { status: 500 });
  }
}
