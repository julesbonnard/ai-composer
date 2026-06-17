# AI Composer

AI Composer is a concept for a writing assistant designed for journalists to help them write articles faster. It uses AI-powered writing assistance to complete sentences with information from sources previously added by the writer. It can also shorten sentences and suggest alternatives.

To learn more about the concept, you can [read the slides](https://julesbonnard.github.io/ai-composer/) (in French).

## Demo

A live demo of the tool is available at [https://ai-composer.vercel.app](https://ai-composer.vercel.app).

The application does not require authentication and does not store user data. However, you will need to add a Mistral AI API key to generate suggestions. You can get one for free at [https://mistral.ai](https://mistral.ai).

The tool also uses a basic audience analysis tool provided by Vercel.

## Features

*   **AI-Powered Autocompletion**: Get sentence completions based on your added sources.
*   **Text Shortening**: Shorten sentences to be more concise.
*   **Alternative Phrasing**: Get alternative phrasings for your sentences.
*   **Source Management**: Add your own sources (PDFs, text files) to be used by the AI.
*   **Local-First**: Your data is stored in your browser. No cloud storage is used for your documents.

## Tech Stack

*   **Frontend**: [Vue.js](https://vuejs.org/) with [Vite](https://vitejs.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Editor**: [Tiptap](https://tiptap.dev/)
*   **AI**:
    *   [Mistral AI](https://mistral.ai/) for text generation.
    *   [Transformers.js](https://github.com/xenova/transformers.js) for local embeddings.
*   **State Management**: [Pinia](https://pinia.vuejs.org/)
*   **Styling**: [Sass](https://sass-lang.com/)

## Project Setup

This project uses [pnpm](https://pnpm.io/) as the package manager.

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/julesbonnard/ai-composer.git
    cd ai-composer
    ```

2.  **Install dependencies:**
    ```sh
    pnpm install
    ```

3.  **Set up your environment variables:**
    Create a `.env.local` file in the root of the project and add your Mistral AI API key:
    ```
    VITE_MISTRAL_API_KEY=your_mistral_api_key
    ```
    You can get a free API key from [https://mistral.ai](https://mistral.ai).

4.  **Run the development server:**
    ```sh
    pnpm dev
    ```
    The application will be available at `http://localhost:5173`.

### Other Scripts

*   **Type-Check, Compile and Minify for Production:**
    ```sh
    pnpm build
    ```

*   **Linting and Formatting:**
    ```sh
    pnpm lint
    pnpm format
    ```

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## License

This project is not licensed.
