import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../lib/auth-client";
import { useOfflineQueueCount } from "../lib/hooks/use-offline-queue-count";

const navItems = [
  { to: "/", label: "Recettes", end: true },
  { to: "/courses", label: "Liste de courses" },
  { to: "/stock", label: "Mon stock" },
];

export function Layout() {
  const { data: session } = useSession();
  const pendingCount = useOfflineQueueCount();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-(--color-surface-line)">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2.5">
              <img src="/mark.svg" alt="" width={32} height={32} className="rounded-[22%]" />
              <span className="font-display text-xl font-semibold text-(--color-text)">
                CookGrim
              </span>
            </NavLink>
            {session && (
              <NavLink
                to="/reglages"
                className={({ isActive }) =>
                  `rounded-full p-2 transition-colors ${
                    isActive
                      ? "bg-(--color-plum) text-(--color-tile-fg)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`
                }
                title="Réglages"
                aria-label="Réglages"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </NavLink>
            )}
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-(--color-plum) text-(--color-tile-fg)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {pendingCount > 0 && (
        <div className="bg-(--color-saffron) px-6 py-2 text-center text-sm font-medium text-(--color-plum)">
          Hors-ligne — {pendingCount} modification{pendingCount > 1 ? "s" : ""} en attente de
          synchronisation
        </div>
      )}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
