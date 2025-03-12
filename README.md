# AI Composer

Un concept d'assistant rédactionnel pour journalistes

## Concept

AI Composer est un logiciel d'écriture dédié aux journalistes, leur permettant de rédiger plus rapidement leurs articles. Il utilise l'écriture assistée par intelligence artificielle pour compléter les phrases grâce à des informations issues de sources ajoutées préalablement par le rédacteur. Il est également capable de raccourcir les phrases et de proposer des alternatives.

Pour en savoir plus sur le concept, [lisez les slides](https://julesbonnard.github.io/ai-composer/).

## Demo

L'outil est disponible en ligne à l'adresse suivante : [https://ai-composer.vercel.app](https://ai-composer.vercel.app).

Il ne nécessite pas d'authentification et ne stocke pas les données des utilisateurs. En revanche, vous aurez besoin d'ajouter une clé d'API Mistral AI pour générer des suggestions. Vous pouvez en obtenir une gratuitement sur [https://mistral.ai](https://mistral.ai).

L'outil utilise également un outil basique d'analyse d'audience fourni par Vercel.

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```