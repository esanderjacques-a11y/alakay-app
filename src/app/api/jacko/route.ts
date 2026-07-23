import { isAdminEmail } from "@/lib/admin";
import { mockRecordAiQuestion } from "@/lib/billing/mockService";
import {
  fetchLicensingBundleFromServer,
  getServerBillingConfig,
} from "@/lib/billing/server";
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
  userId?: string;
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

function canAccessJacko(userId: string | undefined, email: string | null | undefined) {
  if (isAdminEmail(email)) return true;
  if (!userId || userId === "guest") return false;
  const bundle = fetchLicensingBundleFromServer(userId);
  return bundle.hasAiAccess;
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
    "STYLE (strict):",
    "- Be assertive and direct. Lead with the answer or action — no warm-ups, apologies, or filler.",
    "- Keep replies short: usually 2–5 short sentences, or up to 5 tight bullet lines. Never write essays.",
    "- Prefer concrete numbers, product names, and next steps from APP CONTEXT over generic agronomy advice.",
    "- Plain text only. No markdown (no **, #, `, code fences). No emojis. Use simple - bullets if needed.",
    "- Write normal letters for the reply language (correct accents). Never output escape codes like \\u00e1 or HTML entities.",
    "You know Cultosol's About page (developer, mission, vision, contact). Answer those immediately from ABOUT CULTOSOL—do not claim you do not know.",
    "You are connected to the user's live Cultosol session. Prefer APP CONTEXT values, interpretations, and calculator outputs over asking them to retype.",
    "When they ask for a recommendation, start from current deficiencies/warnings and any fertilizer doses already calculated.",
    "Never invent lab values. If a needed value is genuinely missing from APP CONTEXT, ask one short clarifying question.",
    "Skip long regulatory disclaimers unless rates could be unsafe; one short caution line is enough when relevant.",
    `Reply in ${languageName}.`,
    aboutBlock,
    contextBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Strip markdown / escapes so chat bubbles show clean readable text. */
function sanitizeJackoReply(raw: string) {
  let text = raw.replace(/\r\n/g, "\n").trim();

  // Decode literal \uXXXX / \xXX sequences models sometimes emit as text.
  text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  text = text.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );

  // Common HTML entities that should be real characters.
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");

  // Drop fenced code / leftover fences.
  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, "").trim()
  );

  // Strip common markdown chrome (bubbles are plain text).
  text = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "- ");

  // Soft-fix classic UTF-8 mojibake (e.g. "misiÃ³n" → "misión").
  if (/Ã[¡¿°£¢¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿À-ÿ]|â[€™œ]/.test(text)) {
    const decoded = Buffer.from(text, "latin1").toString("utf8");
    if (decoded && !decoded.includes("\uFFFD")) {
      text = decoded;
    }
  }

  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function GET() {
  return Response.json({ ok: true, bot: "Jacko" });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as JackoRequest;
    const userId = typeof body.userId === "string" ? body.userId : undefined;
    const email = typeof body.email === "string" ? body.email : null;

    if (!canAccessJacko(userId, email)) {
      return Response.json(
        {
          error:
            "AI access requires an active allowance or AI subscription. Visit Billing to upgrade or subscribe.",
        },
        { status: 403 }
      );
    }

    if (userId && userId !== "guest" && !isAdminEmail(email)) {
      const bundle = fetchLicensingBundleFromServer(userId);
      if (bundle.aiLimitReached) {
        return Response.json(
          { error: "You have reached your included AI usage for this month." },
          { status: 429 }
        );
      }
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
        temperature: 0.25,
        max_tokens: 520,
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

    const reply = sanitizeJackoReply(
      payload.choices?.[0]?.message?.content?.trim() ||
        "I could not generate a reply right now."
    );

    if (userId && userId !== "guest" && !isAdminEmail(email)) {
      mockRecordAiQuestion(userId, getServerBillingConfig());
    }

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
