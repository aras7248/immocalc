"use client";

import { GuidedPremiumAnalysis, AnalysisText } from "./GuidedPremiumAnalysis";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowUp,
  IconCalculator,
  IconFileSearch,
  IconLoader2,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import type {
  PremiumChatContext,
  PremiumChatMessage,
} from "@/lib/premiumChat";

type ChatEntry = PremiumChatMessage & {
  source?: "ai" | "calculation";
};

const INITIAL_MESSAGES: ChatEntry[] = [{
  role: "assistant",
  text: "Willkommen im objektbezogenen Premium-KI-Chat. Ich behalte den Gesprächsverlauf, die aktive Rechnung und die verfügbaren Exposé-Fakten im Blick. Ergänze jederzeit neue Angaben - ich kennzeichne sie als Nutzerangabe und beziehe sie bei den nächsten Fragen ein.",
}];

const MAX_STORED_MESSAGES = 80;

const suggestedQuestions = [
  "Erstelle eine strukturierte Vollanalyse.",
  "Welche Daten fehlen im Exposé?",
  "Wie hoch ist die Rate an die Bank?",
  "Wie hoch ist die Break-even-Miete?",
  "Welche Förderungen und Zinsoptionen passen?",
  "Rechne mit 10 €/m².",
];


function isChatEntry(value: unknown): value is ChatEntry {
  return Boolean(value)
    && typeof value === "object"
    && ((value as { role?: unknown }).role === "user" || (value as { role?: unknown }).role === "assistant")
    && typeof (value as { text?: unknown }).text === "string"
    && ((value as { source?: unknown }).source == null
      || (value as { source?: unknown }).source === "ai"
      || (value as { source?: unknown }).source === "calculation");
}

type StoredChat = {
  messages: ChatEntry[];
  needsInput: boolean;
  skipUnverifiedPhases: boolean;
};

function readStoredChat(storageKey: string): StoredChat {
  if (typeof window === "undefined") {
    return { messages: INITIAL_MESSAGES, needsInput: false, skipUnverifiedPhases: false };
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return { messages: INITIAL_MESSAGES, needsInput: false, skipUnverifiedPhases: false };
    const parsed = JSON.parse(stored) as {
      messages?: unknown;
      needsInput?: unknown;
      skipUnverifiedPhases?: unknown;
    };
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(isChatEntry).slice(-MAX_STORED_MESSAGES)
      : [];
    return {
      messages: messages.length ? messages : INITIAL_MESSAGES,
      needsInput: parsed.needsInput === true,
      skipUnverifiedPhases: parsed.skipUnverifiedPhases === true,
    };
  } catch {
    return { messages: INITIAL_MESSAGES, needsInput: false, skipUnverifiedPhases: false };
  }
}

export function PremiumAdvisorChat({
  context,
  hidden = false,
}: {
  context: PremiumChatContext;
  hidden?: boolean;
}) {
  const objectLabel = useMemo(
    () => context.object.name || "Aktive Immobilie",
    [context.object.name],
  );
  const storageKey = useMemo(
    () => `immocalc:premium-chat:v1:${encodeURIComponent(`${context.object.name}|${context.object.purchasePrice}|${context.object.livingArea}`)}`,
    [context.object.livingArea, context.object.name, context.object.purchasePrice],
  );
  const [messages, setMessages] = useState<ChatEntry[]>(INITIAL_MESSAGES);
  const [analysisEvidence, setAnalysisEvidence] = useState("");
  const [analysisStep, setAnalysisStep] = useState(1);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsInput, setNeedsInput] = useState(false);
  const [skipUnverifiedPhases, setSkipUnverifiedPhases] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const hasExposeFacts = Boolean(context.exposeFacts?.facts.length);

  useEffect(() => {
    const stored = readStoredChat(storageKey);
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setMessages(stored.messages);
      setNeedsInput(stored.needsInput);
      setSkipUnverifiedPhases(stored.skipUnverifiedPhases);
      setStorageReady(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        messages: messages.slice(-MAX_STORED_MESSAGES),
        needsInput,
        skipUnverifiedPhases,
      }));
    } catch {
      // The chat remains usable even if the browser blocks local storage.
    }
  }, [messages, needsInput, skipUnverifiedPhases, storageKey, storageReady]);

  useEffect(() => {
    const container = messageListRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [isLoading, messages]);

  const send = async (rawQuestion: string, options?: { skipOpenPhases?: boolean }) => {
    const question = rawQuestion.trim();
    if (!question || isLoading) return;

    const nextMessages: ChatEntry[] = [...messages, { role: "user", text: question }];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setIsLoading(true);
    const skipOpenPhases = options?.skipOpenPhases ?? skipUnverifiedPhases;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Bitte melde dich erneut an.");
      const response = await fetch("/api/premium-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: nextMessages,
          context: {
            ...context,
            analysisStep,
            analysisEvidence,
            analysisPreferences: { skipUnverifiedPhases: skipOpenPhases },
          },
        }),
      });
      const payload = await response.json() as {
        answer?: string;
        source?: "ai" | "calculation";
        needsInput?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? "Die Antwort konnte nicht erstellt werden.");
      }
      const answer = payload.answer;
      setNeedsInput(Boolean(payload.needsInput));
      setMessages((current) => [...current, {
        role: "assistant",
        text: answer,
        source: payload.source,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Die Antwort konnte nicht erstellt werden.");
    } finally {
      setIsLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const continueWithExistingData = () => {
    setSkipUnverifiedPhases(true);
    void send("Bitte mit den vorhandenen Daten fortfahren und nicht belegbare Phasen überspringen.", {
      skipOpenPhases: true,
    });
  };

  const startNewConversation = () => {
    if (isLoading) return;
    window.localStorage.removeItem(storageKey);
    setMessages(INITIAL_MESSAGES);
    setNeedsInput(false);
    setSkipUnverifiedPhases(false);
    setDraft("");
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="premium-analysis__content" hidden={hidden}>
      <GuidedPremiumAnalysis context={context} onStepChange={setAnalysisStep} onEvidenceChange={setAnalysisEvidence} />
      <section className="premium-chat" aria-labelledby="premium-chat-title">
        <header className="premium-chat__header">
          <div className="premium-chat__header-icon" aria-hidden="true">
            <IconSparkles size={19} />
          </div>
          <div className="premium-chat__header-content">
            <span>PREMIUM-KI-CHAT</span>
            <h3 id="premium-chat-title">Objektanalyse im Gespräch vertiefen</h3>
            <p>{objectLabel} · Objekt-, Exposé-, Rechen- und Gesprächsdaten werden bei jeder Frage zusammen berücksichtigt.</p>
          </div>
          <button className="premium-chat__reset" type="button" onClick={startNewConversation} disabled={isLoading}>
            <IconRefresh size={16} aria-hidden="true" />
            Neuer Chat
          </button>
        </header>

        <div className="premium-chat__status" role="note">
          {hasExposeFacts ? <IconFileSearch size={17} aria-hidden="true" /> : <IconCalculator size={17} aria-hidden="true" />}
          <span>
            {hasExposeFacts
              ? `${context.exposeFacts?.facts.length ?? 0} Exposé-Fakten und ${context.exposeFacts?.warnings.length ?? 0} Prüfhilfe(n) stehen dem Chat zur Verfügung.`
              : "Der Chat kennt die Rechendaten. Für Exposé-Fakten lade bitte das Dokument oder verknüpfe einen Exposé-Link."}
            {" Der Verlauf wird für dieses Objekt auf diesem Gerät weitergeführt."}
          </span>
        </div>

        <div ref={messageListRef} className="premium-chat__messages" aria-live="polite" aria-label="Unterhaltung mit ImmoCalc">
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}-${message.text.slice(0, 24)}`}
              className={`premium-chat__message premium-chat__message--${message.role}`}
            >
              <span className="premium-chat__message-label">
                {message.role === "user" ? "Du" : message.source === "calculation" ? "ImmoCalc Rechenassistenz" : "ImmoCalc KI"}
              </span>
              <div><AnalysisText text={message.text} /></div>
            </article>
          ))}
          {isLoading && (
            <article className="premium-chat__message premium-chat__message--assistant premium-chat__message--loading">
              <IconLoader2 className="is-spinning" size={17} aria-hidden="true" />
              <span>ImmoCalc prüft die Daten…</span>
            </article>
          )}
        </div>

        {needsInput && !skipUnverifiedPhases && (
          <div className="premium-chat__data-choice" role="note">
            <span>Einzelne Daten fehlen noch.</span>
            <button type="button" onClick={continueWithExistingData} disabled={isLoading}>
              Mit vorhandenen Daten fortfahren
            </button>
          </div>
        )}

        <div className="premium-chat__suggestions" aria-label="Fragevorschläge">
          {suggestedQuestions.map((question) => (
            <button key={question} type="button" onClick={() => void send(question)} disabled={isLoading}>
              {question}
            </button>
          ))}
        </div>

        <form
          className="premium-chat__composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <label className="sr-only" htmlFor="premium-chat-input">Frage an ImmoCalc</label>
          <textarea
            ref={inputRef}
            id="premium-chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Stelle eine Frage oder ergänze neue Objektangaben …"
            rows={2}
            maxLength={4_000}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !draft.trim()} aria-label="Frage senden">
            {isLoading ? <IconLoader2 className="is-spinning" size={18} aria-hidden="true" /> : <IconArrowUp size={18} aria-hidden="true" />}
          </button>
        </form>
        {error && <p className="premium-chat__error" role="alert">{error}</p>}
        <p className="premium-chat__disclaimer">
          Die Vollanalyse strukturiert Fakten, Annahmen, Risiken und nächste Schritte. Neue Angaben bleiben als Nutzerangaben gekennzeichnet, bis sie durch Unterlagen belegt oder in den Rechner übernommen werden.
        </p>
      </section>
    </div>
  );
}
