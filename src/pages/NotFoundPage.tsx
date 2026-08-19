import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-(--color-text)">
        Page introuvable
      </p>
      <Link to="/" className="text-(--color-plum) underline underline-offset-4">
        Retour aux recettes
      </Link>
    </div>
  );
}
