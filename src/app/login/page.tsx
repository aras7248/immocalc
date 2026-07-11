"use client";

import Image from "next/image";
import { useState } from "react";
import { ThemeToggle } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

function getFriendlyLoginError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return "E-Mail-Adresse oder Passwort ist falsch. Bitte prüfe deine Eingaben.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }

  if (normalized.includes("too many") || normalized.includes("rate limit")) {
    return "Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es erneut.";
  }

  return "Die Anmeldung ist gerade nicht möglich. Prüfe deine Verbindung und versuche es erneut.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        throw new Error("offline");
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) throw loginError;
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "unknown";
      setError(
        message === "offline"
          ? "Keine Internetverbindung. Bitte prüfe dein Netzwerk."
          : getFriendlyLoginError(message),
      );
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb--blue" aria-hidden="true" />
      <div className="auth-orb auth-orb--green" aria-hidden="true" />

      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card__accent" aria-hidden="true" />

        <div className="auth-card__topline">
          <span className="auth-badge">Sicherer Login</span>
          <ThemeToggle compact />
        </div>

        <div className="auth-brand" aria-label="ImmoCalc">
          <Image
            className="brand-logo brand-logo--light"
            src="/brand/logo-icon.png"
            alt="ImmoCalc"
            width={112}
            height={112}
            priority
          />
          <Image
            className="brand-logo brand-logo--dark"
            src="/brand/logo-icon-white.png"
            alt=""
            width={112}
            height={112}
            priority
          />
          <span className="auth-product-name">ImmoCalc</span>
        </div>

        <header className="auth-heading">
          <h1 id="login-title">Willkommen zurück</h1>
          <p>Analysiere Immobilien, vergleiche Szenarien und sichere deine Kalkulationen in ImmoCalc.</p>
          <p className="auth-account-hint">Dein bestehender ImmoCow-Zugang funktioniert auch hier.</p>
        </header>

        <form className="auth-form" onSubmit={handleLogin} aria-busy={loading} noValidate>
          <div className="auth-field">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Dein Passwort"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="auth-message auth-message--error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading && <span className="spinner-small" aria-hidden="true" />}
            <span>{loading ? "Anmeldung läuft …" : "Anmelden"}</span>
          </button>
        </form>

        <div className="auth-trust" aria-label="Sicherheitsmerkmale">
          <span>DSGVO-Fokus</span>
          <span>Sichere Cloud-Daten</span>
          <span>Gemeinsames Kundenkonto</span>
        </div>
      </section>
    </main>
  );
}
