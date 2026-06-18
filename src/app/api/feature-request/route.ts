export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL =
  process.env.FEATURE_REQUEST_TO_EMAIL?.trim() || "esanderjacques@gmail.com";

type FeatureRequestBody = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  language?: string;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeatureRequestBody;
    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 160);
    const subject = cleanText(body.subject, 160);
    const message = cleanText(body.message, 4000);
    const language = cleanText(body.language, 12);

    if (!subject || !message) {
      return Response.json(
        { error: "Subject and message are required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (!resendKey) {
      return Response.json(
        {
          error:
            "Email delivery is not configured. Set RESEND_API_KEY on the server.",
        },
        { status: 503 }
      );
    }

    const fromEmail =
      process.env.FEATURE_REQUEST_FROM_EMAIL?.trim() ||
      "Alakay App <onboarding@resend.dev>";

    const text = [
      "New feature request from Alakay App",
      "",
      `Subject: ${subject}`,
      name ? `Name: ${name}` : null,
      email ? `Reply-to: ${email}` : null,
      language ? `Language: ${language}` : null,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ADMIN_EMAIL],
        subject: `[Alakay Feature] ${subject}`,
        text,
        ...(email ? { reply_to: email } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Resend error:", detail);
      return Response.json(
        { error: "Failed to send email." },
        { status: 502 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Feature request error:", error);
    return Response.json(
      { error: "Unexpected error while sending request." },
      { status: 500 }
    );
  }
}
