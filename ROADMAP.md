# Roadmap AI Composer

État au 18 juin 2026. Voir le concept dans `src/slides.md` et l'architecture dans `CLAUDE.md`.

Le fil directeur : **aligner ai-composer sur les choix déjà éprouvés dans `afpnews-deck`**
(Vercel AI SDK v6, `@ai-sdk/vue`, intégration des outils AFP via `afpnews-mcp-server`),
et faire de l'AFP une source de contexte de première classe.

---

## ✅ Fait (juin 2026)

- Migration LangChain → Vercel AI SDK v6, **`@langchain/*` retirés** (deps + dossier
  `src/plugins/langchain/` orphelin supprimés).
- **Dispatch multi-moteurs local ↔ distant** (`ai/engine.ts`) : route par provider
  (`gateway` / `transformers` / `webLLM` / `taskgenai`), prompts partagés (`ai/prompts.ts`)
  entre serveur et moteurs navigateur.
- **Distant via Vercel AI Gateway côté serveur** (`api/llm.ts` + `api/embed.ts`, slugs
  `provider/model`, auth OIDC) — aucune clé côté client. Le Gateway route LLM **et** embeddings.
- **Moteurs locaux câblés** : transformers.js (génération + embeddings), WebLLM (génération +
  embeddings), MediaPipe/taskgenai (génération). Les sources ne quittent pas le poste.
- **Streaming de la complétion** (`streamText` côté serveur → NDJSON ; `TextStreamer`
  transformers, `stream:true` WebLLM, progress listener MediaPipe) → ghost text progressif.
- **Persistance IndexedDB** des sources et des vecteurs (`ai/persistence.ts`).

Reste : valider la génération **locale** en runtime (téléchargement modèle, WebGPU), UI de
gestion des modèles locaux, rate-limiting Gateway (Phase E).

## Phase A — Migration LangChain.js → Vercel AI SDK v6  ✅ TERMINÉE

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

## Phase D — Persistance & confidentialité  ✅ TERMINÉE (code)

- **Sources persistées** ✅ : vecteurs et liste de sources dans IndexedDB
  (`ai/persistence.ts` — clés `chunks:<modèle>` / `sources`). Au chargement,
  `loadSources()` réconcilie et ré-embedde toute source absente du store.
- **Modèles locaux câblés** ✅ : `transformers` / `webLLM` / `taskgenai` réécrits en moteurs
  natifs sous `ai/engines/` (sans LangChain). Les sources restent sur le poste.
- **Reste** : validation **runtime** des moteurs locaux (téléchargement de modèle + WebGPU,
  non éprouvé headless) et UI de gestion/téléchargement des modèles locaux.

---

## Phase E — Qualité & robustesse

- Garde-fou CI : `pnpm type-check` + `pnpm build` (verts aujourd'hui).
- Résorber les ~37 findings ESLint (`no-explicit-any` dans la glue LLM, `catch` inutilisés).
- Quelques tests autour du RAG / de l'auto-complétion (aucun aujourd'hui).
- Durcir le CORS de `/api/*` (codé en dur sur le domaine prod dans `vite.config.ts`).

---

## Phase F — Retrieval & pertinence  ⭐ CŒUR PRODUIT

**Le retrieval est le cœur de la pertinence d'ai-composer** et doit être revu en détail.

**État actuel** (`src/plugins/ai/vectorStore.ts`).
- `similaritySearch(query, k=4)` : **cosinus pur** sur tous les chunks (scan linéaire O(n)),
  tri décroissant, puis **dédoublonnage à 1 chunk par source** (`seen` sur `metadata.id`).
- Puis **une complétion générée par source** (N appels LLM séparés, navigables ↑/↓).
- ⚠️ La mention « similarité MMR » (doc historique) était **fausse** : aucun MMR implémenté.

**✅ Correctifs de base appliqués (juin 2026)** — la recherche fonctionne nettement mieux :
- Requête = **contexte local près du curseur** (paragraphe en cours), plus tout le document
  (qui diluait le vecteur). Cf. `HomeView.autocompletion`.
- **Préfixes E5** `query: ` / `passage: ` appliqués pour les modèles E5 (défaut
  `multilingual-e5-small`) — obligatoires, sinon recherche fortement dégradée.
- Découpage **par paragraphe** (chunks sémantiques) au lieu de fenêtres 1000/200.

**Cible à explorer.**
1. **Corriger la doc** (rapide) : décrire l'algo réel (cosinus + dédup par source), retirer
   « MMR ».
2. **Plusieurs chunks par source** : « 1 chunk/source » n'est pas forcément idéal. Pouvoir
   renvoyer plusieurs chunks (y compris plusieurs d'une même source) au LLM dans **une seule
   requête**.
3. **Attribution par le LLM** : faire indiquer au modèle **de quel chunk** vient la complétion
   → sortie structurée `{ completion, chunkId }`. Le `chunkId` doit remapper vers
   `{ data-id, data-offset, data-len }` pour le resurlignage du segment d'origine.
   ⚠️ Risque d'**attribution hallucinée** (citer une source plausible mais fausse) → id court
   par chunk dans le prompt + fallback si id invalide.
4. **MMR (re)devient pertinent** dès qu'on renvoie plusieurs chunks : pénaliser la redondance
   inter-résultats (sinon 4 chunks quasi identiques, aggravé par le chevauchement de 200).
5. **Latence/coût/UX** : 1 appel groupé vs N appels parallèles. Le groupé est plus cohérent
   (le modèle voit tout le contexte) mais change l'UX « une proposition par source / ↑↓ » —
   à repenser.
6. **Indexation** : le scan O(n) suffit pour quelques sources ; envisager un ANN seulement si
   le corpus grossit beaucoup.

**Suggestion d'attaque.** Corriger la doc (1) → prototyper la sortie structurée
`{ completion, chunkId }` sur le **seul moteur Gateway** (le plus testable) → généraliser aux
moteurs locaux → réintroduire un vrai MMR si la diversité le justifie.
