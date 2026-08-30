// Illustration d'une recette dans les listes/cartes : la photo importée par
// l'utilisateur si elle existe (recipe.photoUrl), sinon une icône générée
// dans la palette CookGrim — choisie de façon stable à partir de l'id de la
// recette pour qu'une même recette garde toujours la même illustration.

type IconKey = "pot" | "salad" | "herb" | "sandwich" | "cake";

const ICONS: IconKey[] = ["pot", "salad", "herb", "sandwich", "cake"];

const TINTS = ["bg-(--color-plum)/10", "bg-(--color-mint)/15", "bg-(--color-saffron)/15"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function IconPot() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="var(--color-plum)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
    >
      <path d="M23 21c-2-3 1-6-1-9" stroke="var(--color-saffron)" />
      <path d="M33 21c-2-3 1-6-1-9" stroke="var(--color-saffron)" />
      <rect x="12" y="27" width="40" height="6" rx="3" />
      <path d="M14 33h36l-3 20a4 4 0 0 1-4 3.5H21a4 4 0 0 1-4-3.5z" />
      <line x1="8" y1="30" x2="12" y2="30" />
      <line x1="52" y1="30" x2="56" y2="30" />
    </svg>
  );
}

function IconSalad() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="var(--color-plum)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
    >
      <path d="M10 28c0 12 9.8 21 22 21s22-9 22-21z" />
      <ellipse cx="24" cy="26" rx="4.5" ry="3" stroke="var(--color-mint)" />
      <ellipse cx="34" cy="24" rx="4" ry="2.6" stroke="var(--color-mint)" />
      <ellipse cx="41" cy="28" rx="3.6" ry="2.4" stroke="var(--color-mint)" />
      <line x1="51" y1="16" x2="46" y2="28" />
      <line x1="55" y1="16" x2="50" y2="28" />
      <line x1="51" y1="16" x2="51" y2="10" />
    </svg>
  );
}

function IconHerb() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="var(--color-plum)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
    >
      <line x1="32" y1="54" x2="32" y2="12" />
      <ellipse cx="26" cy="20" rx="6" ry="3" transform="rotate(-30 26 20)" stroke="var(--color-mint)" />
      <ellipse cx="38" cy="20" rx="6" ry="3" transform="rotate(30 38 20)" stroke="var(--color-mint)" />
      <ellipse cx="24" cy="32" rx="6.5" ry="3.2" transform="rotate(-30 24 32)" stroke="var(--color-mint)" />
      <ellipse cx="40" cy="32" rx="6.5" ry="3.2" transform="rotate(30 40 32)" stroke="var(--color-mint)" />
      <ellipse cx="26" cy="44" rx="6" ry="3" transform="rotate(-30 26 44)" stroke="var(--color-mint)" />
      <ellipse cx="38" cy="44" rx="6" ry="3" transform="rotate(30 38 44)" stroke="var(--color-mint)" />
    </svg>
  );
}

function IconSandwich() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="var(--color-plum)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
    >
      <path d="M10 26c0-6 9.8-11 22-11s22 5 22 11z" />
      <path d="M9 26h46l-4 8H13z" />
      <path
        d="M13 34c3 3 5 3 7.5 0.5s5-2.5 7.5 0 5 2.5 7.5 0 5-2.5 7.5 0 4.5 2.5 7.5-0.5"
        stroke="var(--color-mint)"
      />
      <path d="M12 34l4 12h32l4-12z" />
      <circle cx="32" cy="41" r="2.2" stroke="var(--color-saffron)" fill="var(--color-saffron)" />
    </svg>
  );
}

function IconCake() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="var(--color-plum)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
    >
      <path d="M12 46 32 14 52 46Z" />
      <line x1="18" y1="46" x2="18" y2="36" stroke="var(--color-saffron)" />
      <line x1="32" y1="46" x2="32" y2="30" stroke="var(--color-saffron)" />
      <line x1="46" y1="46" x2="46" y2="36" stroke="var(--color-saffron)" />
      <circle cx="32" cy="10" r="3" fill="var(--color-mint)" stroke="var(--color-mint)" />
    </svg>
  );
}

const ICON_COMPONENTS: Record<IconKey, typeof IconPot> = {
  pot: IconPot,
  salad: IconSalad,
  herb: IconHerb,
  sandwich: IconSandwich,
  cake: IconCake,
};

type RecipeIllustrationProps = {
  recipeId: string;
  title: string;
  photoUrl: string | null;
  className?: string;
};

export function RecipeIllustration({ recipeId, title, photoUrl, className = "" }: RecipeIllustrationProps) {
  if (photoUrl) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <img src={photoUrl} alt="" className="size-full object-cover" />
      </div>
    );
  }

  const hash = hashString(recipeId || title);
  const Icon = ICON_COMPONENTS[ICONS[hash % ICONS.length]];
  const tint = TINTS[Math.floor(hash / ICONS.length) % TINTS.length];

  return (
    <div className={`flex items-center justify-center ${tint} ${className}`}>
      <div className="size-16">
        <Icon />
      </div>
    </div>
  );
}
