import type { auth } from "./auth.js";

// Dérivé directement du type de retour réel de getSession plutôt que d'un
// helper $Infer, pour rester correct quelle que soit la version installée.
type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type AppEnv = {
  Variables: {
    user: Session["user"];
    session: Session["session"];
    // Groupe (foyer) de l'utilisateur courant — résolu par requireAuth, voir
    // middleware/require-auth.ts et lib/groups.ts. Toutes les routes
    // filtrent par ce groupId plutôt que par user.id : c'est ce qui donne
    // l'accès partagé aux recettes/stock/listes entre membres d'un même
    // groupe.
    groupId: string;
  };
};
