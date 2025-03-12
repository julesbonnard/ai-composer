---
theme: default
background: https://cover.sli.dev
title: AI Composer
info: |
  ## AI Composer
  A concept of writing assistant for journalists
class: text-center
drawings:
  persist: false
transition: slide-left
mdc: true
---

# AI Composer

Un concept d'assistant rédactionnel pour journalistes

<div @click="$slidev.nav.next" class="mt-12 py-1" hover:bg="white op-10">
  Continuer <carbon:arrow-right />
</div>

<div class="abs-br m-6 text-xl">
  <a href="https://github.com/julesbonnard/ai-composer" target="_blank" class="slidev-icon-btn">
    <carbon:logo-github />
  </a>
</div>

---

## Le problème de l'écriture automatique

- **Confisquation** : L'écriture par l'IA prive les journalistes de leur intention éditoriale

- **Déconcentration** : S'aider d'un chatbot implique de sortir de son espace de travail

- **Vérification** : Vérifier tout le contenu généré par l'IA est très chronophage

- **Confidentialité** : La plupart des outils ne permettent pas de garder les sources à l'abri



---

## Solution : l'auto-complétion

- Le fonctionnement sous-jacent des modèles de language (GPT-3)

- Déjà très utilisé par les développeurs (cf Github Copilot, Codestral, Continue, etc.)

- Permet de garder la maitrise de son récit

- Aide à retrouver rapidement des informations à travers de multiples sources

- Conserve le lien entre les phrases de l'article et les sources

---

## Fonctionnement

- L'utilisateur dépose ses documents sources (notes, communiqués, rapports, données, etc...) sous forme de texte ou PDF

- L'IA analyse le contenu de ces sources et les stocke dans une base de données vectorielle **locale**

- L'utilisateur peut alors écrire son article et lorsqu'il appuie sur Tab, l'IA lui propose des complétions

- Si la complétion convient, l'utilisateur peut l'accepter et continuer à écrire, ou la modifier

---

## Ca marche ?

- On gagne du temps, à condition de bien connaitre son sujet et ses sources

- Cas d'usage intéressant : la traduction

- Encore beaucoup d'hallucinations mais faciles à contrôler

- [Demo](https://ai-composer.vercel.app)

---

## Outils utilisés

- [Modèle gte/small](https://huggingface.co/Supabase/gte-small) pour l'embedding local (optimisé pour l'anglais)
- [Tiptap](https://tiptap.dev/) pour l'éditeur de texte, basé sur ProseMirror
- [Vector Storage](https://github.com/nitaiaharoni1/vector-storage/) pour le stockage des vecteurs dans l'IndexedDB du navigateur (modifié)
- [Mistral AI Small](https://mistral.ai/) pour l'IA de complétion de texte (peut être hébergé localement)
- [PDF.js](https://mozilla.github.io/pdf.js/) pour l'extraction de texte des PDF
- [Vercel](https://vercel.com/) pour l'hébergement

---

## La suite ?

- Publication du code -> https://github.com/julesbonnard/ai-composer

- Test avec un LLM local -> ollama ?

- Émergence d'alternatives
  - Tiptap Autocompletion (uniquement avec OpenAI et pas de contexte local)

