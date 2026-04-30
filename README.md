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

### No-credentials contributor setup (recommended)

A fresh clone can be fully functional without any remote service credentials:

| Service | Required for local dev? | Behaviour when absent |
|---|---|---|
| Firebase (emulator) | Yes — install Firebase CLI | Local emulators replace the cloud project |
| Algolia | **No** | Local in-memory search is used automatically |
| YouTube Data API | **No** | Playlist and comment endpoints return empty results gracefully |

This means you can clone, install, seed, and run the app without signing up for Algolia or YouTube API access.

### Prerequisites

- **Node.js 20+** (see `.nvmrc`) - If you use `nvm`: `nvm install && nvm use`
- **Java 21** - required for the Firebase Emulator Suite
- Firebase account — only needed for **deployed** environments; local emulators handle everything for contributor work
- Algolia account — **optional**; local search works out-of-the-box without it
- YouTube Data API key — **optional**; playlist/comment endpoints degrade gracefully without it

### Development

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

   The default `.env.example` is already configured for local contributor mode:
   - `PUBLIC_FIREBASE_USE_EMULATORS=true` — app connects to local Firebase emulators.
   - Algolia variables are commented-out placeholders; leave them empty and local search activates automatically.
   - `YOUTUBE_API_KEY` is optional; if omitted, YouTube-dependent endpoints return empty results instead of errors.

   Real Firebase credentials are still needed for deployment and certain admin scripts.

4. Set up local Firebase emulators:
   - Install the Firebase CLI if you do not already have it:
     ```bash
     npm install -g firebase-tools
     ```
   - If you are only running the app locally, the default emulator settings in `.env.example` are enough.
   - If multiple JDKs are installed, make sure Java 21 is active before starting the emulators. On macOS:
     ```bash
     export JAVA_HOME=$(/usr/libexec/java_home -v 21)
     export PATH="$JAVA_HOME/bin:$PATH"
     ```
   - Start the local emulator suite in a separate terminal:
     ```bash
     npm run start-emulators
     ```
   - The app connects to the following local services by default when `PUBLIC_FIREBASE_USE_EMULATORS=true`:
     - Firestore at `127.0.0.1:8086`
     - Realtime Database at `127.0.0.1:9000`
     - Auth at `127.0.0.1:9099`
    - Local account creation works against the Auth emulator, but new accounts still need email verification before they can create reactions or use other protected actions.
    - After signing up locally, watch the terminal running `npm run start-emulators`: the Auth emulator prints the verification link there. Open that link in your browser, then refresh the app or use the verification page to continue.
   - If you need custom ports or hosts, update the corresponding `PUBLIC_*_EMULATOR_*` values in `.env`

5. Seed example data into the local emulators (with emulators already running):
   ```bash
   npm run seed:local-dev
   ```

   This populates the Firestore emulator with published sample reactions so the home page, search, and reaction pages are immediately usable — no remote data required.

6. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## Scripts

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run start-emulators` - Start the Firebase Emulator Suite for Firestore, Auth, and Realtime Database
- `npm run e2e` - Run end-to-end tests with Playwright

### Database Scripts

- `npm run seed:local-dev` - Seed the local Firestore emulator with sample reactions (requires emulators running; no credentials needed)
- `npm run seed:twin-fixtures` - Seed twin player test fixtures into the local emulator (requires emulators running)

The following scripts target a real Firebase project and require `FIREBASE_SERVICE_ACCOUNT` to be set:

- `npm run seed:firestore` - Seed Firestore with test data (prod)
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

### Firebase for Deployment

Local development defaults to Firebase emulators. For a deployed instance that talks to a real Firebase project:

1. Create a Firebase project and enable Authentication, Firestore, and Realtime Database.
2. Add your Firebase web app config to `PUBLIC_FIREBASE_CONFIG`.
3. Set `PUBLIC_FIREBASE_USE_EMULATORS=false` in your deployed environment.
4. Generate a Firebase Admin SDK key from Firebase Console → Project Settings → Service Accounts.
5. Store that key in `FIREBASE_SERVICE_ACCOUNT` as either a file path (local/private runtime) or an inline JSON string (Netlify/private hosting env var).

The Admin SDK key is private and must never be committed to git.

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
   - `FIREBASE_SERVICE_ACCOUNT` — Firebase Admin SDK JSON key material for server-side access
6. Push to your fork's default branch — Netlify will build and deploy automatically.

The platform is domain-agnostic: no hard-coded domain references exist in the application code. All external service callbacks (Firebase Auth, etc.) must be configured to allow your new domain in their respective consoles.

### Environment Variables for Production

Ensure these are set in your Netlify dashboard:
- All `PUBLIC_*` variables from `.env.example`
- `PUBLIC_FIREBASE_USE_EMULATORS=false`
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
