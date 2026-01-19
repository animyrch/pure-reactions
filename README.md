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
     export GOOGLE_APPLICATION_CREDENTIALS="./pure-reactions-firebase-adminsdk-[key-id].json"
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

Before running these scripts, ensure `GOOGLE_APPLICATION_CREDENTIALS` is set:

- `npm run seed:firestore` - Seed Firestore with test data
- `npm run seed:twin-fixtures` - Seed twin player test fixtures
- `npm run migrate:delete-legacy-timelines` - Clean up legacy timeline data

### Database Scripts

Before running these scripts, ensure `GOOGLE_APPLICATION_CREDENTIALS` is set:

- `npm run seed:firestore` - Seed Firestore with test data
- `npm run seed:twin-fixtures` - Seed twin player test fixtures
- `npm run migrate:delete-legacy-timelines` - Clean up legacy timeline data

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
- **Search**: Algolia-powered search with instant results

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

This project is configured for Netlify deployment (see `netlify.toml` and `svelte.config.js`).

### Environment Variables for Production

Ensure these are set in your Netlify dashboard:
- All `PUBLIC_*` variables from `.env.example`
- `YOUTUBE_API_KEY` (server-side only)
- Firebase Admin SDK credentials (if needed for server functions)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Test & Debug Features

See [TEST_FEATURES.md](TEST_FEATURES.md) for supported query params and test/debug toggles.
