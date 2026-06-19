# CLAUDE.md

Guide de travail pour ce dépôt. Lis-le avant toute modification.

## Concept

**AI Composer** est un assistant rédactionnel pour journalistes (SPA Vue 3). Il ne génère
pas l'article à la place du rédacteur : il **complète les phrases au fil de l'écriture**
(à la manière de GitHub Copilot) à partir de **sources fournies par l'utilisateur**, en
gardant le lien entre chaque suggestion et sa source. Il sait aussi **raccourcir** une
sélection et proposer une **alternative** (synonyme / reformulation).

Objectifs de conception (cf. `src/slides.md`, le « deck ») :
- garder l'**intention éditoriale** au journaliste (pas de génération autonome) ;
- rester **dans l'éditeur** (pas d'aller-retour vers un chatbot) ;
- faciliter la **vérification** (chaque complétion cite sa source) ;
- préserver la **confidentialité** (embeddings et recherche vectorielle **en local par défaut** —
  embeddings distants disponibles en option ; possibilité de LLM local).

Démo : https://ai-composer.vercel.app — Slides : https://julesbonnard.github.io/ai-composer/

## Commandes

```sh
pnpm install          # gestionnaire = pnpm (voir pnpm-lock.yaml), PAS npm
pnpm dev              # serveur de dev Vite
pnpm build            # build de production (vite build)
pnpm preview          # prévisualisation du build
pnpm type-check       # vue-tsc --noEmit (doit rester vert)
pnpm lint             # eslint --fix (ESLint 10, flat config eslint.config.ts)
pnpm format           # prettier sur src/
```

Pas de tests automatisés dans le dépôt. Avant un commit : `pnpm type-check` (vert) et
`pnpm build` (vert). `pnpm lint` remonte de la dette préexistante (≈37 findings :
`no-explicit-any` dans la glue LangChain, variables `catch` inutilisées) — à traiter
volontairement, pas en masse.

## Stack

- **Vue 3** (`<script setup>` + Composition API) + **Vue Router 5** + **Pinia**
- **Vite 8** — déploiement **Vercel** (build SPA standard ; `api/` + rewrites natifs Vercel)
- **Tailwind CSS 4** (via `@tailwindcss/vite`) + **daisyUI 5** + icônes Iconify
- **Tiptap 3** (ProseMirror) pour l'éditeur
- **Vercel AI SDK v6** (`ai`) pour l'orchestration LLM + embeddings + RAG via Gateway
  (a remplacé LangChain.js, **`@langchain/*` retirés**) ; modèles locaux via
  `@huggingface/transformers`, `@mlc-ai/web-llm`, `@mediapipe/tasks-genai`
- **pnpm**, TypeScript 6, ESLint 10 (flat config via `@vue/eslint-config-*`), Prettier

## Architecture

### Flux d'écriture (cœur du produit)
1. L'utilisateur ajoute des **sources** (PDF via drag&drop, texte manuel, ou recherche AskNews).
2. Chaque source est découpée **par paragraphe** et **vectorisée** dans le vector store maison
   persisté (`src/plugins/ai/vectorStore.ts`).
3. Dans l'éditeur, **Tab** déclenche `autocompletion` : recherche des passages pertinents
   (**cosinus**, requête = **contexte local** près du curseur — pas tout le document —, dédup
   1 chunk/source, k=4) puis génère une complétion **par source**, affichée en **ghost text
   progressif** (streaming token-par-token, cf. `OnChunk` dans `ai/engine.ts`) ; ↑/↓ naviguent
   entre les propositions, **Tab** insère, **Échap** annule (et coupe la génération).
4. La complétion insérée est un `<mark class="completion" data-id=… title=…>` qui conserve
   le lien vers la source (extension `Completion`).
5. **shorten** / **alternative** agissent sur la sélection courante (bubble menu).

### Couche LLM/RAG — `src/plugins/ai/` ⭐ ACTIF
Migré de LangChain.js (juin 2026). **Dispatch par provider** (génération ET embeddings) :
tout passe par `engine.ts`, qui route selon le **nom** du provider sélectionné
(`config/models.ts`). Le flag `local` ne sert plus qu'à l'affichage cloud/local du badge.
Changer de moteur = changer de provider dans les réglages.
- `index.ts` : API publique (consommée par `HomeView.vue` / `stores/sources.ts`) —
  `searchContext`, `autocompleteText`, `shortenText`, `alternativeText`, `addDocuments`,
  `similaritySearch`, `presentSourceIds`, `removeDocuments`, `clearChunks`, type `Doc`.
  **Pas de top-level await**.
- `engine.ts` : dispatcher. `dispatchComplete`/`dispatchEmbed` routent par provider :
  `gateway` → `engines/remote.ts` (serveur) ; `transformers` → `engines/local.ts` ;
  `webLLM` → `engines/webllm.ts` ; `taskgenai` → `engines/taskgenai.ts` (génération seule,
  **pas d'embeddings**). Enveloppe chaque appel d'`startActivity`/`endActivity` (badge) et
  traduit les erreurs en toasts lisibles (`reportAiError`). `complete()` accepte un
  **`onChunk?(delta)`** (type `OnChunk`) propagé à chaque moteur → **streaming** : les 4
  moteurs émettent les deltas au fil de l'eau (remote NDJSON, transformers `TextStreamer`,
  WebLLM `stream:true`, MediaPipe progress listener). Sélection LLM **relue à chaque appel**
  (`getLlmSelection()`) ; embeddings figée au chargement.
- `activity.ts` : état réactif `aiActivity` (mode cloud/local, modèle, tokens in/out)
  consommé par `AiActivityBadge.vue`. Tokens **exacts** des deux côtés (Gateway renvoie
  `usage` ; les moteurs locaux comptent via leur tokenizer).
- `prompts.ts` : `buildPrompt(task, …)` — **module pur partagé** entre `api/llm.ts`
  (serveur) et les moteurs locaux → prompts non dupliqués.
- `engines/remote.ts` : `remoteComplete` → `/api/llm`, `remoteEmbed` → `/api/embed`. Tourne
  **côté serveur** via le **Vercel AI Gateway** (slugs `provider/model`), auth OIDC
  (`VERCEL_OIDC_TOKEN`) jamais exposée. **Le Gateway route AUSSI les embeddings.**
  `remoteComplete` lit un **flux NDJSON** (`{"delta"}…` puis `{"usage"}` ; `{"error"}` si
  échec en cours de flux) renvoyé par `api/llm.ts` (`streamText`).
- `engines/local.ts` + `local.worker.ts` : transformers.js (ONNX, WebGPU/WASM), génération +
  embeddings. `engines/webllm.ts` : WebLLM/MLC (WebGPU only, gros téléchargements), génération
  + embeddings. `engines/taskgenai.ts` : MediaPipe (Gemma `.task`), génération seule. Les
  sources ne quittent pas le poste en local.
- `engines/loading.ts` : état réactif **partagé** de progression de téléchargement des
  modèles locaux (`localModelState`, consommé par `LocalModelLoader.vue`), alimenté par les
  trois moteurs navigateur (`reportFileProgress` / `reportOverallProgress`).
- `selection.ts` : lit `ai-composer-llm-selection` / `ai-composer-embeddings-selection`.
  **LLM/génération** relue à chaque appel (`getLlmSelection()`) → changer de modèle prend
  effet immédiatement. **Embeddings** figée au chargement (`embeddingsSelection`, doit rester
  cohérente avec le vector store hydraté/réconcilié de la session) → changer de modèle
  d'embeddings nécessite un reload (ModelSelector affiche une invite « Reload »).
- `vectorStore.ts` : vector store maison (cosinus + découpage **par paragraphe**, repli en
  fenêtres maxSize/overlap pour les paragraphes très longs + dédoublonnage par source),
  **persisté dans IndexedDB** via `persistence.ts`, clé `chunks:v2:<modèle>` (changer de modèle
  d'embeddings = dimensions différentes → store vide → ré-embedding). ⚠️ **Préfixes E5** : si
  le modèle d'embeddings contient « e5 » (défaut `multilingual-e5-small`), l'entrée d'embedding
  est préfixée `query: ` / `passage: ` (obligatoire pour E5, sinon recherche dégradée) ; le
  `pageContent` stocké reste brut.
- `persistence.ts` : helpers IndexedDB génériques (`idb`) — un object store `kv`.
- `api/llm.ts` / `api/embed.ts` : fonctions serverless Vercel → `generateText` / `embedMany`
  via Gateway. Endpoints à tâches figées (pas un proxy ouvert), garde d'origine + allowlist
  de modèles (`config/models.ts`) + identifiant utilisateur haché.

⚠️ **Tester** : le distant (Gateway, LLM **et** embeddings) nécessite `/api/*` → lancer
**`vercel dev`** (pas `pnpm dev`) ou déployer. Les moteurs locaux tournent sous `pnpm dev`.

### Couche LLM legacy — supprimée ✅
Le dossier `src/plugins/langchain/` (orphelin) et les dépendances `@langchain/*` ont été
**retirés** (juin 2026). Tout passe désormais par `ai/`. Ne pas réintroduire `@langchain/*`.

### Sources de contexte externe — AskNews
- `src/plugins/asknews.ts` : appelle `/api/asknews` (POST).
- `api/asknews.ts` : **fonction serverless Vercel** qui proxy le SDK AskNews
  (`@emergentmethods/asknews-typescript-sdk`), filtré sur `domainUrl: ['afp.com']`.
  Les `clientId`/`clientSecret` viennent des réglages utilisateur (envoyés dans le body).

### Éditeur Tiptap — `src/plugins/`
- `Autocompletion.ts` : extension principale (décorations ProseMirror, raccourcis
  clavier Tab/↑/↓/Échap, commandes `shorten`/`alternative`). C'est le fichier le plus
  dense, à lire en premier pour toute évolution de l'UX d'écriture. `shorten`/`alternative`
  enveloppent désormais leur résultat dans la mark `completion` (donc signalés comme IA).
  Le **ghost text est progressif** : le thunk de complétion (`CompletionThunk`) reçoit un
  `onChunk` qui re-pose la décoration à chaque incrément ; l'action `add` du plugin **remplace**
  la décoration courante (une seule active à la fois — placeholder « … » puis chaque delta).
- `Headline.ts` (h1, titre), `Lead.ts` (chapô), `Completion.ts` (mark de complétion liée
  à une source), `Recognition.ts` (mark, entités), `Limit.ts` (compteur de signes/mots
  avec dépassement signalé en rouge). Schéma de doc : `headline lead (paragraph|heading)*`.
- **Mark `completion` (passages générés par l'IA)** : attributs `data-source` (nom de
  source ; repli sur l'ancien `title` au parsing HTML), `data-id`, `data-kind` ∈
  `source | shorten | alternative` (pilote le libellé de provenance). Au survol/clic d'un
  passage, un `BubbleMenu` dédié (`plugin-key="completionReview"`, `should-show` =
  `editor.isActive('completion')`) affiche la provenance + un bouton **Reviewed** qui
  retire la mark sur **toute son étendue** (`extendMarkRange('completion').unsetMark(...)`).
  Le menu de sélection Shorten/Alternative est un second `BubbleMenu` séparé.
  ⚠️ `BubbleMenu` v3 (`@tiptap/vue-3/menus`) : props `pluginKey` / `shouldShow` / `options`
  (Floating UI), **pas** `tippyOptions` (silencieusement ignoré).
- **Styles d'éditeur scopés** : les styles éditoriaux (serif, mesure 68ch) sont sous
  `.article-editor` (`TiptapEditor.vue`) ; l'éditeur de sources a ses propres styles sous
  `.source-editor` (sans-serif compact, `SourceEditor.vue`). Ne pas remettre de règle
  `.ProseMirror` globale (elle fuiterait entre les deux éditeurs).

### État — `src/stores/`
- `editor.ts` : document Tiptap courant, persisté dans `localStorage` (clé `article`).
- `sources.ts` : liste des sources + vectorisation, **persistées dans IndexedDB**
  (`persistence.ts`, clé `sources`). Au chargement, `loadSources()` réconcilie : toute source
  absente du vector store (premier chargement ou changement de modèle d'embeddings) est
  ré-embeddée. Suppression/reset purgent vecteurs (`removeDocuments`/`clearChunks`) et liste.
- `settings.ts` : sélection providers/modèles + clés d'API + identifiants AskNews,
  persistés via `useStorage` (`@vueuse/core`).

### UI — `src/components/` & `src/views/`
- `HomeView.vue` : layout 3 colonnes (sources | panneau contextuel | éditeur).
- `TiptapEditor.vue` : montage de l'éditeur + bubble menus + jauge de longueur + `AiActivityBadge.vue`.
- `AiActivityBadge.vue` : retour visuel discret de l'usage IA (cloud/local, modèle, tokens
  in/out), piloté par `ai/activity.ts`. `ToastHost.vue` (monté dans `App.vue`) : notifications
  d'erreur, piloté par `composables/useToasts.ts`.
- `SourcesDragDrop.vue` (PDF via `pdfjs-dist` + `vue3-dropzone`), `SourcesManualAdd.vue`,
  `SourcesAskNews.vue`, `SourcesList.vue`, `SourceEditor.vue`.
- `ModelSelector.vue` / `SettingsComponent.vue` : réglages providers/clés.
- `ThemeToggle.vue` : bascule auto/clair/sombre (en-tête de la barre latérale).
- `SigninHF.vue` : OAuth Hugging Face (token stocké pour les modèles HF).

### Thème & typographie — `src/assets/main.css` + `src/composables/useTheme.ts`
- Direction visuelle **éditorial « papier »** : canvas chaud, encre sombre, **magenta =
  couleur signature de l'IA**. Tokens daisyUI en OKLCH.
- **Deux thèmes daisyUI** déclarés via `@plugin "daisyui/theme"` : `aicomposer` (clair,
  `default`) et `aicomposer-dark` (`prefersdark: true` → suit `prefers-color-scheme`).
  Exprimer les couleurs custom via les variables de thème (`var(--color-*)`, `color-mix`)
  pour qu'elles s'adaptent automatiquement clair/sombre — éviter les couleurs codées en dur.
- `useTheme.ts` : préférence `auto | light | dark` persistée (`@vueuse/core`), appliquée via
  un `effectScope` détaché qui pose/retire `data-theme` sur `<html>` (`auto` = pas
  d'attribut, daisyUI gère). Importé une fois dans `App.vue`.
- **Polices auto-hébergées** (`@fontsource-variable/*`, importées dans `main.ts` — pas de
  CDN tiers, cohérent avec l'objectif confidentialité) : **Inter** (`--font-sans`, UI) et
  **Newsreader** (`--font-serif`, corps de l'article). Tokens dans `@theme`.

### Config modèles — `src/config/models.ts`
Table déclarative `{ provider: { local, llm[], embeddings[], auth } }` où `auth` ∈
`false | 'apiKey' | 'oauthToken' | 'clientCredentials'`. Pilote l'UI de `ModelSelector`
et la logique d'authentification de `settings.ts`. **Garder cette table synchronisée**
avec les moteurs réellement câblés dans `ai/engine.ts`. `local: true` = navigateur,
`local: false` = Gateway (serveur). Providers câblés : `gateway` (LLM + embeddings),
`transformers` (LLM + embeddings), `webLLM` (LLM + embeddings), `taskgenai` (LLM seul).
Ollama retiré (faute de moteur câblé).

## Conventions

- **pnpm** uniquement.
- Commits en **français**, style Conventional Commits (`feat:`, `fix:`, `refactor:`).
- Composants Vue en `<script setup lang="ts">`, Composition API.
- Prompts LLM rédigés en **anglais** (le modèle répond dans la langue de l'article).
- Le code et l'UI sont en **anglais** ; les commentaires/commits sont en **français**.
- Styles : classes Tailwind/daisyUI ; CSS scopé ou `@reference "../assets/main.css"`.

## Pièges connus / dette

- Distant = **Vercel AI Gateway côté serveur** (`api/llm.ts` + `api/embed.ts`), pas de clé
  client. Le Gateway route LLM **et** embeddings (OIDC). Local = transformers.js / WebLLM /
  MediaPipe navigateur. Les `@ai-sdk/*` providers directs ont été retirés.
- `/api/llm` et `/api/embed` ont des tâches figées (pas un proxy ouvert) mais restent sans
  auth : **ajouter rate-limiting / budgets AI Gateway** avant un usage public (ROADMAP E).
- Moteurs locaux **non validés en runtime** (téléchargement modèle + WebGPU) — à tester.
  ⚠️ **WebLLM** exige WebGPU (pas de repli WASM). ⚠️ **MediaPipe** (`taskgenai`) a besoin que
  les fichiers `.task` soient hébergés et de **`VITE_TASKGENAI_BASE_URL`** (sinon erreur claire
  au runtime) ; sans embeddings côté MediaPipe. Pas encore d'UI de téléchargement des modèles.
- `@langchain/*` (deps) et le dossier orphelin `src/plugins/langchain/` ont été **supprimés**
  (juin 2026). Tout passe par `ai/engines/`. Après un pull, lancer `pnpm install` pour purger
  le lockfile.
- Rewrites SPA + headers CORS `/api/*` dans **`vercel.json`**. ⚠️ Sous `vercel dev`, la
  réécriture s'applique **devant** Vite : elle doit exclure les chemins d'assets/modules
  (`/@*`, extensions `.*\.`, `/assets/`) sinon Vite reçoit `index.html` pour une requête de
  module → erreur `vite:import-analysis`. Pour du dev front pur, `pnpm dev` suffit ;
  `vercel dev` est requis pour tester `/api/*` (Gateway).
- Ancien code mort supprimé (juin 2026) : `src/plugins/transformers.ts` (importait
  `@xenova/transformers`) et `src/plugins/VectorStorage/` (lib maison IndexedDB débranchée).
- Sources **persistées dans IndexedDB** (`ai/persistence.ts` ; vecteurs clé `chunks:<modèle>`,
  liste clé `sources`). Changer de modèle d'embeddings invalide les vecteurs → ré-embedding au
  prochain chargement.
- Provenance des complétions migrée de l'attribut `title` vers `data-source` (parsing HTML
  avec repli sur `title`). Les articles **déjà persistés** (clé `article`) chargés depuis
  le JSON `localStorage` perdent la provenance des complétions antérieures (le texte reste) ;
  impact faible vu que les sources ne sont de toute façon pas persistées.
- Routes `get-started` / `GetStarted.vue` présentes mais le lien est commenté dans `HomeView`.
- CORS de `/api/*` codé en dur sur `https://ai-composer.vercel.app` (`vercel.json`).
- Variables d'env : `VITE_*` (client, dont `VITE_*_API_KEY` et `VITE_TASKGENAI_BASE_URL`
  pour héberger les `.task` MediaPipe) + `ASKNEWS_*`, `OAUTH_*`, et `APICORE_*` (à venir
  pour l'AFP, serveur). Voir `.env`.

## Branches

`dev` = branche principale (PR vers `dev`). Nombreuses branches de fonctionnalités
historiques (`tiptap`, `supabase`, `slides`, `legacy`, `no-server`, etc.).
