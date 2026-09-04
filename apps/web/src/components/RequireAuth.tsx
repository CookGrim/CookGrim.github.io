import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client";
import { SplashScreen } from "./SplashScreen";

export function RequireAuth() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
