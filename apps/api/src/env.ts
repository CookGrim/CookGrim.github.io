// Charge apps/api/.env avant tout le reste. Doit être importé en tout
// premier dans index.ts (import "./env.js"), jamais scindé en
// `import { config } from "dotenv"` + appel séparé : en ESM, les imports
// sont hissés et évalués avant le corps du module qui les déclare, donc un
// appel `config()` écrit comme simple instruction s'exécuterait après les
// imports suivants (auth.js → db/client.js, qui lit TURSO_DATABASE_URL dès
// son évaluation) — trop tard. En important ce fichier, le chargement de
// l'env fait partie de l'évaluation du module lui-même, donc il s'exécute
// dans l'ordre, avant les imports suivants.
//
// override: true — le `.env` local doit gagner même si une variable du même
// nom traîne déjà dans l'environnement du process parent (ex. le port du
// serveur web injecté par l'outil de preview, hérité via `concurrently`
// puisque PORT est réutilisé par les deux services). Sans effet en
// production : `.env` n'est pas déployé (gitignored), Render fournit son
// propre PORT.
import { config } from "dotenv";

config({ override: true });
