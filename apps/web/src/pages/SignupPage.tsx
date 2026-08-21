import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../lib/auth-client";

export function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: signUpError } = await signUp.email({ name, email, password });
    setIsSubmitting(false);
    if (signUpError) {
      setError(signUpError.message ?? "Impossible de créer le compte.");
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="flex items-center gap-2.5">
        <img src="/mark.svg" alt="" width={32} height={32} className="rounded-[22%]" />
        <span className="font-display text-xl font-semibold text-(--color-text)">CookGrim</span>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <h1 className="font-display text-xl font-semibold text-(--color-text)">Créer un compte</h1>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--color-text)">Nom</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--color-text)">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--color-text)">Mot de passe</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-(--color-surface-line) bg-(--color-surface) px-3 py-2 text-(--color-text)"
          />
          <span className="text-xs text-(--color-text-muted)">8 caractères minimum.</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-(--color-plum) px-6 py-2.5 font-semibold text-(--color-tile-fg) transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Créer mon compte
        </button>

        <p className="text-sm text-(--color-text-muted)">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-(--color-plum) underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  );
}
