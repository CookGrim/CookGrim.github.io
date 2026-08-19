-- Schéma CookGrim — à exécuter dans l'éditeur SQL du projet Supabase
-- (ou via `supabase db push` une fois la CLI configurée).
--
-- Couvre les phases 1-5 du plan (recettes, liste de courses, partage par
-- lien public). Le partage ciblé compte-à-compte (recipe_shares) est en v2,
-- volontairement absent d'ici — voir ARCHITECTURE.md.

create extension if not exists "pgcrypto"; -- pour gen_random_uuid()

-- ---------------------------------------------------------------------------
-- recettes
-- ---------------------------------------------------------------------------
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  servings integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  photo_url text,
  notes text, -- zone libre, privée par défaut (voir share_recipe_notes plus bas)
  share_token uuid unique, -- non-null = lien public actif ; régénérable pour révoquer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  position integer not null default 0
);

create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  position integer not null default 0,
  text text not null
);

create index if not exists ingredients_recipe_id_idx on ingredients (recipe_id);
create index if not exists steps_recipe_id_idx on steps (recipe_id);

-- ---------------------------------------------------------------------------
-- liste de courses
-- ---------------------------------------------------------------------------
create table if not exists shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Liste de courses',
  created_at timestamptz not null default now()
);

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references shopping_lists (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text,
  checked boolean not null default false,
  position integer not null default 0,
  source_recipe_ids uuid[] not null default '{}'
);

create index if not exists shopping_list_items_list_id_idx on shopping_list_items (shopping_list_id);

-- ---------------------------------------------------------------------------
-- row level security — chacun ne voit et ne modifie que ses propres données
-- ---------------------------------------------------------------------------
alter table recipes enable row level security;
alter table ingredients enable row level security;
alter table steps enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;

create policy "recipes: owner full access" on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "ingredients: owner full access" on ingredients
  for all using (
    exists (select 1 from recipes r where r.id = ingredients.recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = ingredients.recipe_id and r.user_id = auth.uid())
  );

create policy "steps: owner full access" on steps
  for all using (
    exists (select 1 from recipes r where r.id = steps.recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = steps.recipe_id and r.user_id = auth.uid())
  );

create policy "shopping_lists: owner full access" on shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "shopping_list_items: owner full access" on shopping_list_items
  for all using (
    exists (select 1 from shopping_lists l where l.id = shopping_list_items.shopping_list_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from shopping_lists l where l.id = shopping_list_items.shopping_list_id and l.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- partage par lien public
--
-- Pas de policy RLS "select where share_token is not null" : ça exposerait
-- la liste de TOUTES les recettes publiques à qui interroge la table. On
-- passe par une fonction security definer qui n'accepte qu'une recherche par
-- token exact, connu du visiteur via l'URL /r/<token>.
-- ---------------------------------------------------------------------------
create or replace function get_recipe_by_share_token(token uuid, include_notes boolean default false)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'servings', r.servings,
    'prepTimeMinutes', r.prep_time_minutes,
    'cookTimeMinutes', r.cook_time_minutes,
    'photoUrl', r.photo_url,
    'notes', case when include_notes then r.notes else null end,
    'ingredients', coalesce(
      (select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit) order by i.position)
       from ingredients i where i.recipe_id = r.id), '[]'::jsonb
    ),
    'steps', coalesce(
      (select jsonb_agg(jsonb_build_object('position', s.position, 'text', s.text) order by s.position)
       from steps s where s.recipe_id = r.id), '[]'::jsonb
    )
  )
  from recipes r
  where r.share_token = token;
$$;

grant execute on function get_recipe_by_share_token(uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on recipes;
create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function set_updated_at();
