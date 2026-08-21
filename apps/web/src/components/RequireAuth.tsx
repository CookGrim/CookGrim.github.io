import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client";

export function RequireAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="grid min-h-svh place-items-center text-(--color-text-muted)">Chargement…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
