// Petit client REST pour apps/api. En dev, Vite proxifie /api vers le
// serveur Hono local (voir vite.config.ts) ; en prod, VITE_API_URL pointe
// vers le Web Service Render.
const API_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include", // envoie le cookie de session Better Auth
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Vrai rejet (le serveur a compris la requête et l'a refusée : validation,
// auth, 404…) vs. échec transitoire qu'il vaut la peine de rejouer plus
// tard : pas de réseau (fetch rejette sans réponse), ou 5xx — y compris le
// 502 que le proxy Vite renvoie en dev quand apps/api est injoignable, qui
// n'est pas une exception réseau classique mais doit être traité pareil.
export function isRetryableError(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status >= 500;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
