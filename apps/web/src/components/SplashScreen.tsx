// Écran de chargement plein écran affiché pendant la vérification de session
// au tout premier chargement de l'app (voir RequireAuth.tsx, useSession
// isPending). Le logo bat comme un cœur — deux pulsations rapprochées puis
// une pause, comme un vrai battement — pour habiller ce court instant sans
// donner l'impression d'un blocage.
export function SplashScreen() {
  return (
    <div className="grid min-h-svh place-items-center bg-(--color-bg)">
      <style>{`
        @keyframes cookgrim-heartbeat {
          0%, 40%, 100% { transform: scale(1); }
          15% { transform: scale(1.16); }
          30% { transform: scale(1.04); }
          45% { transform: scale(1.1); }
        }
        .cookgrim-splash-logo {
          animation: cookgrim-heartbeat 1.15s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cookgrim-splash-logo {
            animation: none;
          }
        }
      `}</style>
      <img
        src="/mark.svg"
        alt="CookGrim"
        width={140}
        height={140}
        className="cookgrim-splash-logo rounded-[22%] drop-shadow-lg"
      />
    </div>
  );
}
