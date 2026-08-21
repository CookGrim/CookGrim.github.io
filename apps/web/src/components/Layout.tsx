import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/auth-client";

const navItems = [
  { to: "/", label: "Recettes", end: true },
  { to: "/courses", label: "Liste de courses" },
];

export function Layout() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const onSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-(--color-surface-line)">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <img src="/mark.svg" alt="" width={32} height={32} className="rounded-[22%]" />
            <span className="font-display text-xl font-semibold text-(--color-text)">
              CookGrim
            </span>
          </NavLink>
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
            {session && (
              <button
                type="button"
                onClick={onSignOut}
                className="ml-2 rounded-full px-4 py-2 text-sm font-medium text-(--color-text-muted) hover:text-(--color-text)"
                title={session.user.email}
              >
                Se déconnecter
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
