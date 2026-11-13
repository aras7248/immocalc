import { createClient } from "@supabase/supabase-js";
import { generateText, type ModelMessage } from "ai";
import {
  createCalculationAssistantAnswer,
  createPremiumChatSystemPrompt,
  type PremiumChatContext,
  type PremiumChatMessage,
} from "@/lib/premiumChat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 60;
const MAX_MESSAGE_LENGTH = 4_000;

const isPremiumChatMessage = (value: unknown): value is PremiumChatMessage => (
  Boolean(value)
  && typeof value === "object"
  && ((value as { role?: unknown }).role === "user" || (value as { role?: unknown }).role === "assistant")
  && typeof (value as { text?: unknown }).text === "string"
);

const isPremiumChatContext = (value: unknown): value is PremiumChatContext => (
  Boolean(value)
  && typeof value === "object"
  && Boolean((value as { object?: unknown }).object)
  && Boolean((value as { calculation?: unknown }).calculation)
);

const sanitizeMessages = (messages: PremiumChatMessage[]) => messages
  .slice(-MAX_MESSAGES)
  .map((message) => ({
    role: message.role,
    text: message.text.trim().slice(0, MAX_MESSAGE_LENGTH),
  }))
  .filter((message) => message.text.length > 0);

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return Response.json({ error: "Bitte melde dich an." }, { status: 401 });
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return Response.json({ error: "Bitte melde dich erneut an." }, { status: 401 });
    const body: unknown = await request.json();
    const raw = body as { messages?: unknown; context?: unknown };
    if (!Array.isArray(raw.messages) || !raw.messages.every(isPremiumChatMessage) || !isPremiumChatContext(raw.context)) {
      return Response.json({ error: "Die Chat-Anfrage enthält keine gültigen Objekt- und Rechendaten." }, { status: 400 });
    }

    if (raw.context.analysisStep !== undefined && (!Number.isInteger(raw.context.analysisStep) || raw.context.analysisStep < 1 || raw.context.analysisStep > 6)) {
      return Response.json({ error: "Ungültiger Analyseschritt." }, { status: 400 });
    }
    if (raw.context.analysisEvidence !== undefined && (typeof raw.context.analysisEvidence !== "string" || raw.context.analysisEvidence.length > 120000)) {
      return Response.json({ error: "Die Quellenangaben sind zu lang oder ungültig." }, { status: 400 });
    }
    const messages = sanitizeMessages(raw.messages);
    const lastUserQuestion = [...messages].reverse().find((message) => message.role === "user")?.text;
    if (!lastUserQuestion) {
      return Response.json({ error: "Bitte stelle eine Frage zur Immobilie." }, { status: 400 });
    }

    const calculationReply = createCalculationAssistantAnswer(raw.context, lastUserQuestion, messages);
    // Lokal liefert ImmoCalc belastbare Antworten zu den hinterlegten Zahlen.
    // Auf Vercel wird OIDC unterstützt; lokal benötigt die freie Textanalyse
    // einen AI_GATEWAY_API_KEY. Das Modell erhält nur den begrenzten Kontext.
    const canUseGateway = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
    if (!canUseGateway) {
      return Response.json(calculationReply, { headers: { "Cache-Control": "no-store" } });
    }

    const modelMessages: ModelMessage[] = messages.map((message) => ({
      role: message.role,
      content: message.text,
    }));
    const result = await generateText({
      model: process.env.IMMOCALC_AI_MODEL ?? "openai/gpt-5.6-terra-fast",
      system: createPremiumChatSystemPrompt(raw.context),
      messages: modelMessages,
      maxOutputTokens: raw.context.analysisStep === 6 ? 8_000 : 4_000,
      abortSignal: AbortSignal.timeout(45_000),
    });

    const answer = result.text.trim();
    return Response.json({
      answer: answer || calculationReply.answer,
      source: answer ? "ai" : "calculation",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error("Premium-Chat fehlgeschlagen:", message);
    if (/valid credit card|customer_verification_required/i.test(message)) {
      return Response.json({
        error: "Die KI ist noch nicht freigeschaltet. Die Kontoverifizierung beim KI-Anbieter fehlt.",
      }, { status: 503 });
    }
    return Response.json({
      error: "Die KI-Antwort konnte gerade nicht erstellt werden. Prüfe die hinterlegten Rechendaten oder versuche es erneut.",
    }, { status: 502 });
  }
}
