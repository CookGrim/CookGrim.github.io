import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GroupSettingsSection } from "../components/GroupSettingsSection";
import { useThemePreference } from "../lib/hooks/use-theme";
import { PIN_LENGTH, sanitizePin } from "../lib/pseudo";
import { authClient, signOut, useSession } from "../lib/auth-client";
import type { ThemePreference } from "../lib/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
];

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (next.length !== PIN_LENGTH) {
      setMessage({ text: `Le code doit contenir exactement ${PIN_LENGTH} chiffres.`, isError: true });
      return;
    }
    if (next !== confirm) {
      setMessage({ text: "Les deux codes ne correspondent pas.", isError: true });
      return;
    }

    setIsSubmitting(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
    });
    setIsSubmitting(false);

    if (error) {
      setMessage({
        text: error.code === "INVALID_PASSWORD" ? "Code actuel incorrect." : (error.message ?? "Impossible de modifier le code, réessayez."),
        isError: true,
      });
      return;
    }

    setMessage({ text: "Code mis à jour.", isError: false });
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--color-text)">Code actuel</span>
        <input
          required
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d*"
          minLength={PIN_LENGTH}
          maxLength={PIN_LENGTH}
          value={current}
          onChange={(e) => setCurrent(sanitizePin(e.target.value))}
          className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--color-text)">Nouveau code</span>
        <input
          required
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d*"
          minLength={PIN_LENGTH}
          maxLength={PIN_LENGTH}
          value={next}
          onChange={(e) => setNext(sanitizePin(e.target.value))}
          className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--color-text)">Confirmer le nouveau code</span>
        <input
          required
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d*"
          minLength={PIN_LENGTH}
          maxLength={PIN_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(sanitizePin(e.target.value))}
          className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
        />
      </label>

      {message && (
        <p className={`text-sm ${message.isError ? "text-red-600" : "text-(--color-mint)"}`}>{message.text}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-full bg-(--color-plum) px-6 py-2.5 font-semibold text-(--color-tile-fg) transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        Mettre à jour mon code
      </button>
    </form>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useThemePreference();

  return (
    <div className="flex rounded-full bg-(--color-bg) p-1">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
            theme === option.value
              ? "bg-(--color-plum) text-(--color-tile-fg)"
              : "text-(--color-text-muted) hover:text-(--color-text)"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AccountSection() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const pseudo = session?.user.name;

  const onSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col gap-3">
      {pseudo && <p className="text-sm text-(--color-text-muted)">Connecté en tant que @{pseudo}</p>}
      <button
        type="button"
        onClick={onSignOut}
        className="self-start rounded-full border border-(--color-surface-line) px-5 py-2.5 text-sm font-medium text-(--color-text) transition-colors hover:border-red-600 hover:text-red-600"
      >
        Se déconnecter
      </button>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-(--color-surface-line) bg-(--color-surface) p-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">{title}</h2>
        {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Réglages</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Ton compte, ton foyer et l'apparence de l'application.
        </p>
      </div>

      <Section title="Foyer">
        <GroupSettingsSection />
      </Section>

      <Section title="Code de connexion" description="Le code doit contenir exactement 6 chiffres.">
        <PasswordSection />
      </Section>

      <Section title="Apparence" description="S'applique tout de suite à l'appli.">
        <AppearanceSection />
      </Section>

      <Section title="Compte">
        <AccountSection />
      </Section>
    </div>
  );
}
