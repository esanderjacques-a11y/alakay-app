import { isAdminEmail } from "@/lib/admin";
import {
  formatJackoAboutForPrompt,
  formatJackoContextForPrompt,
  type JackoAppContext,
} from "@/lib/jackoContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type JackoRequest = {
  messages: ChatMessage[];
  language?: string;
  planTier?: string;
  email?: string | null;
  context?: JackoAppContext | null;
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ht: "Haitian Creole",
  pt: "Portuguese",
  sw: "Swahili",
};

function canAccessJacko(planTier: string | undefined, email: string | null | undefined) {
  if (isAdminEmail(email)) return true;
  return planTier === "pro" || planTier === "business";
}

function sanitizeContext(raw: unknown): JackoAppContext | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as JackoAppContext;
}

function buildSystemPrompt(language: string, context: JackoAppContext | null) {
  const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;
  const aboutBlock = formatJackoAboutForPrompt(language);
  const contextBlock = formatJackoContextForPrompt(context);
  return [
    "You are Jacko, Cultosol's agronomic assistant for soil and foliar analysis, fertilization planning, bodega/stock, calendar, and field workflow.",
    "Be concise, practical, and farmer-friendly. Prefer clear numbered steps and quick recommendations over long theory.",
    "You know Cultosol's About page (developer, mission, vision, contact). Answer those questions immediately from ABOUT CULTOSOL—do not claim you do not know.",
    "You are connected to the user's live Cultosol session. Prefer APP CONTEXT values, interpretations, and calculator outputs over asking them to retype.",
    "When they ask for a recommendation, start from current deficiencies/warnings and any fertilizer doses already calculated.",
    "Never invent lab values. If a needed value is genuinely missing from APP CONTEXT, ask one short clarifying question.",
    "When recommending fertilizers or rates, remind users to validate against local lab results and local regulations.",
    `Reply in ${languageName}.`,
    aboutBlock,
    contextBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function GET() {
  return Response.json({ ok: true, bot: "Jacko" });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as JackoRequest;
    const planTier = typeof body.planTier === "string" ? body.planTier : "free";
    const email = typeof body.email === "string" ? body.email : null;

    if (!canAccessJacko(planTier, email)) {
      return Response.json(
        { error: "Jacko is available on Pro plans and for admins." },
        { status: 403 }
      );
    }

    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const cleaned = incoming
      .filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .slice(-16)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 4000),
      }));

    if (cleaned.length === 0) {
      return Response.json({ error: "Message required." }, { status: 400 });
    }

    const language =
      typeof body.language === "string" && LANGUAGE_NAMES[body.language]
        ? body.language
        : "en";

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Jacko needs OPENAI_API_KEY in the server environment." },
        { status: 500 }
      );
    }

    const context = sanitizeContext(body.context);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENAI_JACKO_MODEL ||
          process.env.OPENAI_IMPORT_MODEL ||
          "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 1100,
        messages: [
          { role: "system", content: buildSystemPrompt(language, context) },
          ...cleaned,
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(
        payload.error?.message || `OpenAI request failed (${response.status})`
      );
    }

    const reply =
      payload.choices?.[0]?.message?.content?.trim() ||
      "I could not generate a reply right now.";

    return Response.json({ reply });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Jacko could not answer right now.",
      },
      { status: 500 }
    );
  }
}
