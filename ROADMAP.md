# Roadmap AI Composer

État au 17 juin 2026. Voir le concept dans `src/slides.md` et l'architecture dans `CLAUDE.md`.

Le fil directeur : **aligner ai-composer sur les choix déjà éprouvés dans `afpnews-deck`**
(Vercel AI SDK v6, `@ai-sdk/vue`, intégration des outils AFP via `afpnews-mcp-server`),
et faire de l'AFP une source de contexte de première classe.

---

## Phase A — Migration LangChain.js → Vercel AI SDK v6  ⭐ priorité

**Pourquoi.** `@langchain/community` est déprécié en amont ; les chunks LangChain pèsent
~1,7 Mo (mistralai 1 Mo, openai 198 Ko, prompt_values 471 Ko) ; et `afpnews-deck` tourne
déjà sur le SDK AI (`ai`^6, `@ai-sdk/vue`^3). Unifier = moins de poids, du streaming, et un
savoir-faire commun.

**Cible.**
- Providers : convention `provider:model` + un `LanguageModelFactory`
  (cf. `afpnews-deck/src/lib/LanguageModelFactory.ts`).
- LLM : remplacer les `RunnableSequence`/`PromptTemplate` de
  `src/plugins/langchain/index.ts` par `generateText` (complétion/raccourci/alternative),
  puis `streamText` pour le ghost-text progressif.
- Embeddings : `embed` / `embedMany`.
- Côté Vue : `@ai-sdk/vue`.

**Étapes.**
1. Installer `ai`, `@ai-sdk/vue`, et les providers retenus (`@ai-sdk/openai`,
   `@ai-sdk/mistral`, `@ai-sdk/google`, `@ai-sdk/anthropic`).
2. Créer `src/plugins/ai/` : `factory.ts` (modèle depuis `provider:model`), `models.ts`
   (catalogue, remplace `src/config/models.ts`), `completion.ts` (autocomplete/shorten/
   alternative), `embeddings.ts`, `vectorStore.ts` (cosinus en mémoire, sans LangChain).
3. Garder la **même API publique** consommée par `HomeView.vue`
   (`searchContext`, `autocompleteText`, `shortenText`, `alternativeText`) pour limiter
   le blast radius.
4. Brancher, vérifier (`pnpm type-check` + `pnpm build`), puis retirer `@langchain/*`.
5. Passer la complétion en **streaming** (`streamText`) dans `Autocompletion.ts`.

**Décision ouverte.** Clés API : aujourd'hui en `localStorage` côté client (BYO-key). Soit
on garde le BYO-key (démo publique sans auth), soit on passe par un **proxy serveur**
(fonction Vercel) façon deck, soit par **Vercel AI Gateway** (`provider/model`,
observabilité + fallback). Recommandation : proxy/Gateway dès qu'il y a des clés AFP côté
serveur (cf. Phase B).

---

## Phase B — AFP comme source de contexte (`afpnews-mcp-server`)  ⭐ fort impact

**Le serveur s'importe comme bibliothèque** — pas besoin de parler MCP en HTTP depuis le
navigateur :
```ts
import { TOOL_DEFINITIONS } from 'afpnews-mcp-server/definitions'
// dans une fonction Vercel /api/afp (creds APICORE_* côté serveur) :
const result = await def.handler(apicore, args) // afp_search_articles, afp_get_article…
```
C'est le pattern de `afpnews-deck/src/config/ai/tools.ts`.

**Étapes.**
1. Fonction `api/afp.ts` (jumelle de `api/asknews.ts`) appelant `afp_search_articles` /
   `afp_get_article` via `afpnews-api` (ApiCore : `APICORE_API_KEY/USERNAME/PASSWORD`).
2. Ajouter `"afp"` à `contextSelection.provider` dans `src/stores/settings.ts`
   (déjà modélisé, figé sur `"asknews"` aujourd'hui).
3. Généraliser `SourcesAskNews.vue` en composant « chercher l'actualité → ajouter comme
   source → vectoriser », avec un sélecteur de provider (AskNews | AFP).
4. Outils AFP exposés utiles : `afp_search_articles`, `afp_get_article`,
   `afp_find_similar`, `afp_list_facets`, `afp_search_media`, `afp_get_media`.

---

## Phase C — Mode agentique AFP (dépend de A + B)

Une fois sur le SDK AI : wrapper les `TOOL_DEFINITIONS` en `tool()` + `jsonSchema()` et
laisser un `ToolLoopAgent` (cf. deck) chercher lui-même dans le fil AFP pendant la
rédaction (contexte, similaires, illustration via `afp_search_media`).

---

## Phase D — Persistance & confidentialité

- **Persister les sources** : le vector store est en mémoire (perdu au reload),
  l'IndexedDB est commentée dans `src/stores/sources.ts`. Rebrancher via `idb`
  (déjà installé) ou pgvector Supabase (comme deck).
- **Modèles locaux** : `transformers` / `webLLM` / `taskgenai` sont désactivés dans
  `langchain/index.ts`. La confidentialité (sources gardées en local) est un argument
  central du deck — Transformers.js v4 + WebGPU rendent ça viable. À réactiver proprement.

---

## Phase E — Qualité & robustesse

- Garde-fou CI : `pnpm type-check` + `pnpm build` (verts aujourd'hui).
- Résorber les ~37 findings ESLint (`no-explicit-any` dans la glue LLM, `catch` inutilisés).
- Quelques tests autour du RAG / de l'auto-complétion (aucun aujourd'hui).
- Durcir le CORS de `/api/*` (codé en dur sur le domaine prod dans `vite.config.ts`).
