import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client";
import { SplashScreen } from "./SplashScreen";

export function RequireAuth() {
  const { data: session, isPending, isRefetching, refetch } = useSession();

  // Après signIn.email()/signUp.email(), better-auth met à jour la session
  // partagée en arrière-plan via un signal — mais retardé de 10ms de propos
  // délibéré côté lib (node_modules/better-auth/dist/client/proxy.mjs,
  // "To avoid race conditions we set the signal in a setTimeout"). Le
  // navigate("/", { replace: true }) de LoginPage/SignupPage arrive presque
  // toujours avant ces 10ms : ce composant se remonte alors avec encore
  // l'ancien état "pas de session" et renvoie vers /login, alors que la
  // connexion a bien réussi côté serveur — d'où le symptôme "il faut se
  // connecter deux fois" (le deuxième essai profite du signal du premier,
  // déjà arrivé entre-temps). On revérifie donc une fois avant de conclure
  // à une vraie absence de session, plutôt que de faire confiance à ce
  // premier état qui peut être obsolète de quelques millisecondes.
  const [hasRechecked, setHasRechecked] = useState(false);
  const hasTriggeredRecheck = useRef(false);

  useEffect(() => {
    if (!isPending && !session && !hasTriggeredRecheck.current) {
      hasTriggeredRecheck.current = true;
      refetch().finally(() => setHasRechecked(true));
    }
  }, [isPending, session, refetch]);

  if (isPending || (!session && (isRefetching || !hasRechecked))) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
