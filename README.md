<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chat SDK</h1>
</a>

<p align="center">
    Chat SDK is a free, open-source template built with Next.js and the AI SDK that helps you quickly build powerful chatbot applications.
</p>

<p align="center">
  <a href="https://chat-sdk.dev"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://sdk.vercel.ai/docs)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports OpenAI (default) and Google model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template ships with [OpenAI](https://openai.com) `gpt-4.1` as the default chat model. The system supports both OpenAI and [Google](https://ai.google.dev) model providers, with the [AI SDK](https://sdk.vercel.ai/docs) allowing seamless switching between models with just a few lines of code.

## Deploy Your Own

This is a custom RAG chatbot implementation with advanced features including:

- LangSmith observability and feedback collection
- Multimodal embeddings with Cohere v2 API
- OpenAI responses API integration
- Comprehensive user feedback system

To deploy this application, you'll need to set up your own environment variables and database.

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

## Development

This project includes a robust development workflow with automated code quality checks:

### Available Scripts

- `pnpm lint` - Check code for linting issues (read-only)
- `pnpm lint:fix` - Fix auto-fixable linting issues
- `pnpm format` - Format code using Biome
- `pnpm type-check` - Run TypeScript type checking
- `pnpm test` - Run all tests (E2E with Playwright)
- `pnpm test:unit` - Run unit tests only (Vitest)

### Git Hooks

The project uses [Husky](https://typicode.github.io/husky/) to enforce code quality:

#### Pre-commit Hook

- Automatically runs on `git commit`
- Uses [lint-staged](https://github.com/okonet/lint-staged) to format and lint staged files
- Formats code with Biome and fixes linting issues where possible

#### Pre-push Hook

- Automatically runs on `git push`
- Executes TypeScript type checking
- Runs linting checks
- Runs unit tests
- Provides warnings for issues but doesn't block pushes (configurable)

### Skip Hooks During Development

When needed, you can skip the git hooks:

```bash
# Skip pre-commit hook
git commit --no-verify -m "your message"

# Skip pre-push hook
git push --no-verify

# Skip pre-push hook with environment variable
SKIP_PREPUSH=true git push
```

### Code Quality

The project maintains high code quality through:

- **ESLint** with Next.js and accessibility rules
- **Biome** for fast formatting and additional linting
- **TypeScript** for type safety
- **Automated testing** with Playwright and Vitest
- **Pre-commit formatting** to ensure consistent code style
- **Pre-push validation** to catch issues before they reach the repository
