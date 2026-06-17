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
- préserver la **confidentialité** (embeddings et recherche vectorielle en local, possibilité de LLM local).

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

- **Vue 3** (`<script setup>` + Composition API) + **Vue Router** + **Pinia**
- **Vite 7** (+ `vite-plugin-vercel`) — déploiement **Vercel**
- **Tailwind CSS 4** (via `@tailwindcss/vite`) + **daisyUI 5** + icônes Iconify
- **Tiptap 3** (ProseMirror) pour l'éditeur
- **LangChain** (`@langchain/*`) pour l'orchestration LLM + embeddings + RAG
- **pnpm**, TypeScript, ESLint 9 (flat config via `@vue/eslint-config-*`), Prettier

## Architecture

### Flux d'écriture (cœur du produit)
1. L'utilisateur ajoute des **sources** (PDF via drag&drop, texte manuel, ou recherche AskNews).
2. Chaque source est découpée (`RecursiveCharacterTextSplitter`) et **vectorisée** dans un
   `MemoryVectorStore` LangChain (`src/plugins/langchain/vectorStore.ts`).
3. Dans l'éditeur, **Tab** déclenche `autocompletion` : recherche des passages pertinents
   (similarité MMR, k=4) puis génère une complétion **par source** ; ↑/↓ naviguent entre
   les propositions, **Tab** insère, **Échap** annule.
4. La complétion insérée est un `<mark class="completion" data-id=… title=…>` qui conserve
   le lien vers la source (extension `Completion`).
5. **shorten** / **alternative** agissent sur la sélection courante (bubble menu).

### Couche LLM/RAG — `src/plugins/langchain/`
- `index.ts` : point d'entrée. Expose `searchContext`, `autocompleteText`, `shortenText`,
  `alternativeText` (chaînes LangChain Runnable + prompts en **anglais**). Choisit le
  provider LLM et embeddings via `localStorage` (clés `ai-composer-llm-selection` /
  `ai-composer-embeddings-selection`), avec **top-level await** sur l'import dynamique du
  provider. ⚠️ Les providers locaux (`transformers`, `webLLM`, `taskgenai`, `ollama`,
  `huggingface`) sont **commentés** dans `aiProviders` — seuls `openai`, `mistralai`,
  `google` sont actifs.
- Un fichier par provider : `openai.ts`, `mistralai.ts`, `google.ts`, `ollama.ts`,
  `huggingface.ts`, `taskgenai.ts` (MediaPipe), `transformers/` (Transformers.js en Web
  Worker), `webLLM/` (WebLLM en Web Worker + embeddings maison). Chacun exporte
  `getLLM(model?)` et `getEmbeddings(model?)`. La clé d'API est lue dans `localStorage`
  (`ai-composer-api-keys`) avec repli sur `import.meta.env.VITE_*`.
- `vectorStore.ts` : `MemoryVectorStore` **en mémoire** (non persisté) + retriever MMR.

### Sources de contexte externe — AskNews
- `src/plugins/asknews.ts` : appelle `/api/asknews` (POST).
- `api/asknews.ts` : **fonction serverless Vercel** qui proxy le SDK AskNews
  (`@emergentmethods/asknews-typescript-sdk`), filtré sur `domainUrl: ['afp.com']`.
  Les `clientId`/`clientSecret` viennent des réglages utilisateur (envoyés dans le body).

### Éditeur Tiptap — `src/plugins/` (hors langchain)
- `Autocompletion.ts` : extension principale (décorations ProseMirror, raccourcis
  clavier Tab/↑/↓/Échap, commandes `shorten`/`alternative`). C'est le fichier le plus
  dense, à lire en premier pour toute évolution de l'UX d'écriture.
- `Headline.ts` (h1, titre), `Lead.ts` (chapô), `Completion.ts` (mark de complétion liée
  à une source), `Recognition.ts` (mark, entités), `Limit.ts` (compteur de signes/mots
  avec dépassement signalé en rouge). Schéma de doc : `headline lead (paragraph|heading)*`.

### État — `src/stores/`
- `editor.ts` : document Tiptap courant, persisté dans `localStorage` (clé `article`).
- `sources.ts` : liste des sources + vectorisation. ⚠️ La persistance IndexedDB est
  **commentée** (l'ancienne lib maison `src/plugins/VectorStorage/` n'est plus branchée) ;
  les sources sont donc perdues au rechargement.
- `settings.ts` : sélection providers/modèles + clés d'API + identifiants AskNews,
  persistés via `useStorage` (`@vueuse/core`).

### UI — `src/components/` & `src/views/`
- `HomeView.vue` : layout 3 colonnes (sources | panneau contextuel | éditeur).
- `TiptapEditor.vue` : montage de l'éditeur + bubble menu + jauge de longueur.
- `SourcesDragDrop.vue` (PDF via `pdfjs-dist` + `vue3-dropzone`), `SourcesManualAdd.vue`,
  `SourcesAskNews.vue`, `SourcesList.vue`, `SourceEditor.vue`.
- `ModelSelector.vue` / `SettingsComponent.vue` : réglages providers/clés.
- `SigninHF.vue` : OAuth Hugging Face (token stocké pour les modèles HF).

### Config modèles — `src/config/models.ts`
Table déclarative `{ provider: { local, llm[], embeddings[], auth } }` où `auth` ∈
`false | 'apiKey' | 'oauthToken' | 'clientCredentials'`. Pilote l'UI de `ModelSelector`
et la logique d'authentification de `settings.ts`. **Garder cette table synchronisée**
avec les providers réellement activés dans `langchain/index.ts`.

## Conventions

- **pnpm** uniquement.
- Commits en **français**, style Conventional Commits (`feat:`, `fix:`, `refactor:`).
- Composants Vue en `<script setup lang="ts">`, Composition API.
- Prompts LLM rédigés en **anglais** (le modèle répond dans la langue de l'article).
- Le code et l'UI sont en **anglais** ; les commentaires/commits sont en **français**.
- Styles : classes Tailwind/daisyUI ; CSS scopé ou `@reference "../assets/main.css"`.

## Pièges connus / dette

- Providers locaux désactivés dans `langchain/index.ts` (imports commentés).
- Ancien code mort supprimé (juin 2026) : `src/plugins/transformers.ts` (importait
  `@xenova/transformers`) et `src/plugins/VectorStorage/` (lib maison IndexedDB débranchée).
  L'implémentation active vit dans `langchain/transformers/` et `langchain/vectorStore.ts`.
- Sources **non persistées** (vector store en mémoire ; IndexedDB commentée).
- `langchain/index.ts` utilise un **top-level await** : un provider mal configuré casse le
  chargement initial de l'app.
- `@langchain/community` est marqué **deprecated** en amont.
- Routes `get-started` / `GetStarted.vue` présentes mais le lien est commenté dans `HomeView`.
- CORS de `/api/*` codé en dur sur `https://ai-composer.vercel.app` (`vite.config.ts`).
- Variables d'env : `VITE_*` (client) + `ASKNEWS_*`, `OAUTH_*` (serveur). Voir `.env`.

## Branches

`dev` = branche principale (PR vers `dev`). Nombreuses branches de fonctionnalités
historiques (`tiptap`, `supabase`, `slides`, `legacy`, `no-server`, etc.).
