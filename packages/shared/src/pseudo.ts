// Dérivation pseudo → email interne : better-auth exige un email unique en
// interne, alors que l'utilisateur ne voit et ne saisit qu'un pseudo (voir
// apps/api/src/auth.ts). Partagé entre apps/api (lookup par pseudo, ex.
// POST /api/recipes/:id/shares) et apps/web (connexion/inscription) — évite
// que les deux copies dérivent silencieusement l'une de l'autre.
export function pseudoToEmail(pseudo: string): string {
  return `${pseudo.toLowerCase()}@pseudo.cookgrim.local`;
}
