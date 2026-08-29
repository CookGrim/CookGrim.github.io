// better-auth exige un email unique en interne ; on ne le montre jamais à
// l'utilisateur, qui ne voit qu'un pseudo. Le pseudo sert d'identifiant de
// connexion : on lui fait correspondre un email interne dérivé, unique tant
// que le pseudo l'est (contrainte "email unique" du schéma).
export const PSEUDO_MAX_LENGTH = 12;

// Autorisé : lettres, chiffres, "_" et "-" — garantit un email interne valide
// et évite toute ambiguïté entre ce que l'utilisateur tape et son identifiant.
export function sanitizePseudo(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, PSEUDO_MAX_LENGTH);
}

export function pseudoToEmail(pseudo: string): string {
  return `${pseudo.toLowerCase()}@pseudo.cookgrim.local`;
}

// Le code numérique tient lieu de mot de passe (4 chiffres exactement).
export const PIN_LENGTH = 4;

export function sanitizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, PIN_LENGTH);
}
