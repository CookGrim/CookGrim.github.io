// Limite de fréquence en mémoire, par clé arbitraire — fenêtre glissante
// simple (suffisant pour un seul process ; pas de déploiement multi-instance
// ici). Sert pour l'instant à limiter POST /api/recipes/:id/shares : c'est
// la seule route de l'app où un compte authentifié peut sonder l'existence
// d'un pseudo ("Pseudo introuvable." vs succès) en boucle — voir
// routes/recipes.ts.
type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  if (bucket.count >= max) return true;
  bucket.count += 1;
  return false;
}
