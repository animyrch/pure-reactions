# Pure Reactions

A platform for creating and sharing authentic reaction videos with synchronized playback.

## Features

- Record video reactions synchronized with original content
- Twin player system with synchronized playback
- Shared viewing sessions for real-time co-watching
- Search and discover reactions
- Progressive Web App (PWA) support
- Dark mode with cinematic design

## Getting Started

### Prerequisites

- **Node.js 20+** (see `.nvmrc`) - If you use `nvm`: `nvm install && nvm use`
- Firebase account for backend services
- Algolia account for search functionality
- YouTube Data API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/animyrch/pure-reactions.git
   cd pure-reactions
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your configuration:
   - Firebase configuration (collections, emulator settings)
   - Algolia credentials (app ID, search API key, index name)
   - YouTube API key

4. Set up Firebase Admin SDK:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file in the root directory as `pure-reactions-firebase-adminsdk-[key-id].json`
   - Set the path in your environment:
     ```bash
     export FIREBASE_SERVICE_ACCOUNT="./pure-reactions-firebase-adminsdk-[key-id].json"
     ```
   - **Never commit this file to git** (it's automatically ignored)

5. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run e2e` - Run end-to-end tests with Playwright

### Database Scripts

Before running these scripts, ensure `FIREBASE_SERVICE_ACCOUNT` is set:

- `npm run seed:firestore` - Seed Firestore with test data
- `npm run seed:twin-fixtures` - Seed twin player test fixtures
- `npm run migrate:delete-legacy-timelines` - Clean up legacy timeline data

### Database Scripts

Before running these scripts, ensure `FIREBASE_SERVICE_ACCOUNT` is set:

- `npm run seed:firestore` - Seed Firestore with test data
- `npm run seed:twin-fixtures` - Seed twin player test fixtures
- `npm run migrate:delete-legacy-timelines` - Clean up legacy timeline data

### Algolia Search Scripts

Manage search indices and configuration:

- `npm run algolia:status` - Check Algolia app and index status
- `npm run algolia:index` - Dry-run index sync from Firestore (safe, no changes)
- `npm run algolia:index:apply` - Apply index sync to Algolia

See [docs/ALGOLIA_OPERATIONS.md](docs/ALGOLIA_OPERATIONS.md) for detailed search operations guide.

### Sitemap Generation

The sitemap (`static/sitemap.xml`) is **automatically regenerated on every Netlify build** before the Vite build runs. No manual intervention is needed after a deploy.

Required Netlify environment variables:

| Variable | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (string or file path) |
| `PUBLIC_BASE_URL` | Canonical base URL, e.g. `https://purereactions.com` |

To regenerate the sitemap locally:

```bash
export FIREBASE_SERVICE_ACCOUNT="./path/to/serviceAccount.json"
export PUBLIC_BASE_URL="https://yourdomain.com"
npm run generate-sitemap
```

The script reads published reactions and uses stored `youtube.meta` fields (no YouTube API calls during generation).

## Architecture

### Core Technologies

- **SvelteKit** - Application framework
- **Firebase** - Authentication, Firestore, and Realtime Database
- **Algolia** - Search functionality
- **YouTube IFrame API** - Video playback
- **Tailwind CSS** - Styling with cinematic design tokens
- **Playwright** - End-to-end testing

### Key Features

- **Twin Player System**: Synchronized playback of original and reaction videos with timeline-based control
- **Shared Sessions**: Real-time co-watching using Firebase Realtime Database
- **Reaction Recording**: Backend flow for creating reaction videos with state tracking
- **Search**: Provider-agnostic search with Algolia backend, optimized for cost and easy migration

## Code Organization Guidelines

1. **Keep files focused** — prefer small, single-responsibility modules. Composables should orchestrate state, lifecycle hooks, and side effects while remaining thin.
2. **Extract pure helpers** — deterministic logic (e.g., rounding, map/array transforms, timeline normalization) belongs in `src/lib/helpers/` so it can be reused and tested independently.
3. **Name by role** — use folders like `helpers`, `composables`, `components` to signal intent and import behavior: helpers for stateless utilities, composables for orchestrators, components for UI.
4. **Document rationale** — when you split logic (like `useTwinPlayers` + `twinPlayersTimeline`), add a short comment or README entry explaining where related helpers live so future edits are easy to reason about.

## Security

- See [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting
- **Never commit credentials**: All sensitive keys should be in `.env` (which is gitignored)
- Firebase client API keys in source code are safe (they identify your project, not authenticate)
- Firebase Admin SDK credentials must always be kept secure and never committed

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Testing

### End-to-End Tests

Run Playwright tests:
```bash
npm run e2e
```

See [TEST_FEATURES.md](TEST_FEATURES.md) for supported query params and test/debug toggles.

### Browser Testing Reference

Key test fixtures for twin-player synchronization are in `tests/fixtures/reactions/`:
- Basic Sync: `/reaction/1PaTrdCMKn6ay7nShHES`
- Play Trigger: `/reaction/8O1sPJr6atB0K2CvyItV`
- Volume Stability: `/reaction/Dw3UZ6PqZH37E5pbKmhZ`
- Resume After Config Pause: `/reaction/BUOR5TM6yAHSClCCRvIp`

## Deployment

This project is configured for Netlify deployment (see `netlify.toml` and `svelte.config.js`). You may redeploy the platform under your own domain for **personal or community (non-commercial) use** by following the steps below.

### Steps to Deploy Your Own Instance

1. Fork or clone this repository.
2. Create a free [Netlify](https://netlify.com) account and link it to your fork.
3. Create the required third-party accounts and obtain credentials:
   - [Firebase](https://console.firebase.google.com/) — Authentication, Firestore, and Realtime Database.
   - [Algolia](https://www.algolia.com/) — Search index.
   - [YouTube Data API](https://console.cloud.google.com/) — Video metadata.
4. Copy `.env.example` to `.env` and fill in all values.
5. In your Netlify project settings, add all environment variables listed in `.env.example` plus:
   - `YOUTUBE_API_KEY` (server-side only)
   - `FIREBASE_SERVICE_ACCOUNT` — path to your Firebase Admin SDK JSON key file (if using server functions); see the Installation section above for how to generate this key.
6. Push to your fork's default branch — Netlify will build and deploy automatically.

The platform is domain-agnostic: no hard-coded domain references exist in the application code. All external service callbacks (Firebase Auth, etc.) must be configured to allow your new domain in their respective consoles.

### Environment Variables for Production

Ensure these are set in your Netlify dashboard:
- All `PUBLIC_*` variables from `.env.example`
- `YOUTUBE_API_KEY` (server-side only)
- Firebase Admin SDK credentials (if needed for server functions)

## License

**This project is non-commercial.** You may run it for personal or community use, but not for commercial purposes.

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** license — see the [LICENSE](LICENSE) file for details.

[![CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc/4.0/)

### What this means

| Permitted | Restricted |
|-----------|------------|
| Copy, fork, and self-host the platform | Selling access or subscriptions |
| Adapt and build upon the code | Running it as part of a paid product/service |
| Use it for personal or community projects | Monetizing it through advertising without permission |
| Redistribute with attribution | Any other commercial exploitation |

### Attribution requirements

When redistributing or adapting this project, you must:
1. Credit the original project: **Pure Reactions** (<https://github.com/animyrch/pure-reactions>).
2. Link to this license.
3. Indicate if you made changes.
4. Not imply that the original authors endorse your deployment.

### Branding

The name **Pure Reactions** and any associated logos or marks are not licensed for use in derivative deployments. If you redeploy this platform under a different domain, you must use a different name and remove or replace all Pure Reactions branding (site title, meta tags, footer credits, favicon) before going live.

## Test & Debug Features

See [TEST_FEATURES.md](TEST_FEATURES.md) for supported query params and test/debug toggles.
