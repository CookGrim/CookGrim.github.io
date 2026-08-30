// better-auth exige un email unique en interne ; on ne le montre jamais à
// l'utilisateur, qui ne voit qu'un pseudo. Le pseudo sert d'identifiant de
// connexion — la dérivation vers l'email interne vit dans @cookgrim/shared
// (pseudoToEmail), réutilisée telle quelle côté API.
export const PSEUDO_MAX_LENGTH = 12;

// Autorisé : lettres, chiffres, "_" et "-" — garantit un email interne valide
// et évite toute ambiguïté entre ce que l'utilisateur tape et son identifiant.
export function sanitizePseudo(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, PSEUDO_MAX_LENGTH);
}

// Le code numérique tient lieu de mot de passe (6 chiffres exactement —
// voir apps/api/src/auth.ts pour la validation stricte côté serveur).
export const PIN_LENGTH = 6;

export function sanitizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, PIN_LENGTH);
}
