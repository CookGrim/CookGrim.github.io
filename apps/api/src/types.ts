import type { auth } from "./auth.js";

// Dérivé directement du type de retour réel de getSession plutôt que d'un
// helper $Infer, pour rester correct quelle que soit la version installée.
type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type AppEnv = {
  Variables: {
    user: Session["user"];
    session: Session["session"];
  };
};
