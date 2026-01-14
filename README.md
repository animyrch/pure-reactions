# create-svelte

Everything you need to build a Svelte project, powered by [`create-svelte`](https://github.com/sveltejs/kit/tree/master/packages/create-svelte).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npm create svelte@latest

# create a new project in my-app
npm create svelte@latest my-app
```

## Developing

### Node version

This repo expects **Node.js 20+** (see `.nvmrc`).
If you use `nvm`: `nvm install && nvm use`.

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Code Organization Guidelines

1. **Keep files focused** — prefer small, single-responsibility modules. Composables should orchestrate state, lifecycle hooks, and side effects while remaining thin.
2. **Extract pure helpers** — deterministic logic (e.g., rounding, map/array transforms, timeline normalization) belongs in `src/lib/helpers/` so it can be reused and tested independently.
3. **Name by role** — use folders like `helpers`, `composables`, `components` to signal intent and import behavior: helpers for stateless utilities, composables for orchestrators, components for UI.
4. **Document rationale** — when you split logic (like `useTwinPlayers` + `twinPlayersTimeline`), add a short comment or README entry explaining where related helpers live so future edits are easy to reason about.

## Test & Debug Features

See [TEST_FEATURES.md](TEST_FEATURES.md) for supported query params and test/debug toggles.
