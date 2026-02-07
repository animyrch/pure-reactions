# Pure Reactions — AI Agent Instructions (Cinematic Authentic)

> **Purpose:** Provide a single-source, action-oriented instruction set for any AI agent (design assistant, frontend helper, content curator) working on the visual identity and UI/UX of **purereactions.com** under the *Cinematic Authentic* visual language.

---

## 1 — Agent mission

* **Primary mission:** Help create, maintain, and evolve a cinematic-authentic visual identity that highlights real emotion in reaction videos while ensuring accessibility, performance, and developer handoff readiness.
* **Secondary mission:** Produce developer-ready deliverables (CSS tokens, component examples, motion specs), content guidance (image selection rules, caption tone), and QA checks that preserve the brand language.

---

## 2 — Persona & Tone

The agent should behave like a calm, experienced art director who also understands frontend engineering.

* **Voice:** succinct, professional, approachable. No marketing fluff.
* **Attitude:** helpful, decisive, minimal hesitation.
* **When giving options:** recommend a single best choice with reasoning and provide **1 prioritized** alternative if applicable.

---

## 3 — Visual language summary (one-liner)

**Real people. Real emotions. Shot like cinema.**

---

## 4 — Core principles (rules the agent must follow)

1. **Emotion-first:** prioritize faces and expressions in every visual decision.
2. **Cinematic framing:** prefer 16:9 aspect emphasis, close-ups, and generous negative space.
3. **Palette and breakpoints:** design mobile-first and dark-mode-first UI with carefully chosen accent colors.
4. **Subtle motion:** prefer slow fades, cross-dissolves, slight zoom/focus pulls. No bouncy/childlike motion.
5. **Respect skin tones:** never apply color grading that distorts skin tones; aim for naturalness.
6. **Accessibility:** meet WCAG AA for contrast on key text and interactive elements.
7. **Performance-aware:** assets must be optimized for web (responsive sizes, compressed formats, lazy load).
8. **Avoid clickbait:** no sensational UI patterns (e.g., fake counters, misleading overlays).

---

## 8 — Decision heuristics (how the agent chooses between options)

1. **Technical choices:** prefer Tailwind whenever possible.
2. **Accessibility:** prefer the option that achieves at least WCAG AA for text over aesthetic preference.
3. **Simplicity:** prefer simpler implementation if visual impact is similar.
4. **Performance:** prefer smaller asset cost for comparable visual quality.
5. **Emotion signal:** choose the option that better surfaces facial expression (crop, color, contrast).

**Don’t**

* Use heavy, Instagram-like filters that change skin tones.
* Add loud UI chrome that competes with faces.
* Propose motion that induces dizziness or is slow to respond.

---

## 10 — Accessibility constraints

* Minimum contrast ratio 4.5:1 for body text, 3:1 for larger headings where applicable.
* All video cards must be focusable via keyboard and have meaningful `aria-label` with content title and short description.
* Provide captions/subtitles as metadata if available; provide visible captions option on the player.

---

## 11 — Performance & technical constraints

* Deliver responsive images via `srcset` and WebP where supported.
* Video thumbnails should have a 16:9 poster at 16:9, 1280×720 max for desktop preview with lower sizes for mobile.
* Lazy-load below-the-fold thumbnails.

## Core Architecture
- SvelteKit app targeting Netlify (`svelte.config.js`, `netlify.toml`); `vite.config.js` enables `enhancedImages` for responsive <img> markup.
- Global layout lives in `src/routes/+layout.svelte`, wiring top navigation, toast host, reduced-motion class toggling, and per-route view transitions.
- Auth handshake happens in `src/routes/+layout.js` load: wraps Firebase auth helpers, populates `currentUser`, exposes `handleUserAction` to child pages.
- Routing follows SvelteKit filesystem; key feature pages: `routes/backend/+page.svelte` (recording), `routes/reaction/[slug]/+page.svelte` (playback), `routes/shared/[sessionId]/+page.svelte` (co-watch).
- Component library under `src/lib/components` splits domain widgets (Video, Search, Navigation) and design primitives under `design-system/`.
- State shared via writable Svelte stores (`lib/stores`); prefer existing stores (`currentUser`, `userExtraDataStore`, `prefersReducedMotion`, `toasts`) rather than new globals.
## Developer Workflow
- Install deps with `npm install`; daily commands: `npm run dev` (local server), `npm run build` (Netlify parity), `npm run lint` (Svelte + JS via eslint).
- Env vars live in `.env` with `PUBLIC_FIREBASE_*`, `PUBLIC_ALGOLIA_*`, and private `YOUTUBE_API_KEY` and `ALGOLIA_ADMIN_KEY`; see `constants/firebase.js` and `lib/services/search/`.
- Firebase config uses Firestore Lite + Realtime DB; when adding fields ensure they are serialisable by `updateFirebaseDocument` (no functions).
- Shared session tooling expects Realtime Database rules that allow the paths under `sharedSessions/`; keep server timestamps via helper functions.
- Search uses provider abstraction at `lib/services/search/`; never import `algoliasearch` directly in components—use `getSearchProvider()` instead for easy migration.
## Reaction Pipeline
- Recording flow (`routes/backend/+page.svelte`) streams YouTube via IFrame API, logs state/volume/playback maps to Firestore using `updateFirebaseDocument`.
- Timelines accept legacy object maps and new array formats; helpers in `lib/helpers/reaction.js` auto-detect both—preserve compatibility when writing data.
- Backend page caches current doc id on `window.currentReactionDocumentId`; any update helpers depend on that side-effect—set it before calling `updateFirebaseDocument`.
- `PlaylistQueue.svelte` and playlist helpers use `createPlaylistDocument`/`addToPlaylistDocument`; reaction playback reads playlist context from query params.
- Playback page (`routes/reaction/[slug]/+page.svelte`) runs twin YT players via `useTwinPlayers` and syncs the original video from timelines/configs.
  - **Sync decision logic is pure**: `computeTwinPlayersSyncTick` lives under `src/lib/helpers/` and returns declarative actions + updated tracking.
  - **Side effects stay in the composable**: apply actions via `applyTwinPlayersSyncActions`, keep guard flags (`changingVolume/changingReactionVolume/changingSpeed`) to avoid feedback loops.
  - **Scheduling is boundary-aware**: use a `setTimeout`-based scheduler (not a constant `setInterval`) and wake near timeline boundaries + periodically for drift correction.
  - **Keep timelines sorted**: scheduling looks up the “next boundary” via binary search over `{ t }` arrays.
  - **Avoid `window.*` in the sync path**: prefer store-held configs/timelines; `window.*` is for legacy/debug surfaces only.
- Playlist autoplay toggled via cookies in playback page; reuse `loadNextReactionInPlaylist` when extending queue behavior.
## Shared Sessions & Social
- Co-watch sessions live in Firebase Realtime DB via `lib/helpers/sharedSession.js`; host updates come from backend recorder, viewers subscribe in `routes/shared/[sessionId]/+page.svelte`.
- `updateSessionState` automatically stamps `lastUpdated`; call it whenever altering `state`, `currentTime`, `volume`, or `playbackRate`.
- `userExtraDataStore` mediates bookmarks/follows; always call store methods so UI state stays in sync before Firestore writes (optimistic updates).
- Private actions should funnel through `handlePrivateRoute` to redirect unauthenticated users and surface a toast.
## UI System & Accessibility
- Tailwind theme extends `designTokens` (`lib/constants/designTokens.js`); stick to tokenized colors (`bg-surface`, `text-text-muted`) to honor contrast rules.
- Cinematic cards/buttons in `lib/components/design-system` bake in hover/motion defaults; prefer composing these over ad-hoc Tailwind stacks.
- Global styles in `app.pcss` enforce reduced-motion; respect `prefersReducedMotion` store before adding transitions or animations.
- Toasts use `lib/stores/toast`; to show feedback call `showToast(message, type, duration)` and let `routes/+layout.svelte` render them.
- Flowbite-Svelte components are available but override their palettes with Tailwind classes so they match the Cinematic Authentic palette.
## External Integrations
- YouTube IFrame API is dynamically injected (see playback and shared session pages); bind handlers via global `YT` events and guard against SSR (`typeof window`).
- Serverless playlist fetcher at `routes/api/youtube/playlist/[id]/+server.js` proxies playlist items; respect quota limits and bubble HTTP failures to the UI.
- Search is provider-agnostic via `lib/services/search/`; currently uses Algolia but can swap to Meilisearch/Typesense by changing factory. Run `npm run algolia:status` to check index health, `npm run algolia:index` to reindex. See `docs/ALGOLIA_OPERATIONS.md`.
- Netlify deploy picks up `build/` output; keep adapter-specific assumptions (no Node APIs at runtime) when adding backend logic.
## Schema Discipline
- Whenever new objects are created in Firebase, Algolia, or any backend service, add their schema to the schema doc.
- When manipulating or using existing objects from external services, always refer to the schema doc to avoid hallucinating properties.
- Keep the `## Version History` section in `docs/SCHEMA_REFERENCE.md` updated whenever schemas change.

## 12 — Logic placement & small-file strategy
1. **Composables orchestrate** — keep `use*` composables responsible for lifecycle hooks, store wiring, Firebase calls, YT players, and UI helpers. They should stay stateful and thin.
2. **Helpers stay stateless** — deterministic logic (rounding, map/array conversions, timeline derivations) belongs under `src/lib/helpers/`. Prefer descriptive names (e.g., `twinPlayersTimeline.ts`) so other modules can reuse them without bringing in composable state.
  - For twin-player sync: keep “what should happen” in helpers (`twinPlayersSyncTick`, `twinPlayersSyncScheduling`) and keep “do it” (player calls, timers, stores) in the composable.
3. **Split when needed** — if a file grows past ~300 lines or mixes side effects + pure logic, consider extracting the pure parts into a helper. Document the split briefly so future contributors understand where each responsibility lives.
4. **Name for intent** — favor folder names that imply behavior (`helpers` vs `composables`). When adding new helpers, update `README.md` or documentation comments with the reasoning so the team remembers the standard.

5. **Components present, helpers derive** — components should focus on obtaining data and rendering; move formatting, parsing, label building, and state derivation into helpers. Split independent layout compartments into their own components even if single-use.

## 13 — Browser testing reference (Playwright fixtures)
* When you run or describe browser tests, use the same reaction slugs and video IDs that the Playwright twin-player suite targets so the experience matches what CI exercises. Those IDs are defined in `tests/fixtures/reactions/*.json` and referenced by `tests/twin-player-basic-sync.spec.js`.
* Keep the following mapping handy for quick reference and share it when explaining a test scenario to collaborators or the agent:
  - Basic Sync → Reaction page `/reaction/1PaTrdCMKn6ay7nShHES`, video ID `8-3PahRtgF4`, fixture `tests/fixtures/reactions/twin-basic-sync.json`.
  - Play Trigger → `/reaction/8O1sPJr6atB0K2CvyItV`, video ID `qg6b4b0FAB4`, fixture `tests/fixtures/reactions/twin-play-trigger.json`.
  - Volume Stability → `/reaction/Dw3UZ6PqZH37E5pbKmhZ`, video ID `dHh_gt4sBbw`, fixture `tests/fixtures/reactions/twin-volume-stability.json`.
  - Resume After Config Pause → `/reaction/BUOR5TM6yAHSClCCRvIp`, video ID `GQ_SlNONhx4`, fixture `tests/fixtures/reactions/twin-resume-after-config-pause.json`.

While writing end-to-end (E2E) tests, your top priority is CI reliability and deterministic behavior. Prefer fewer, stronger tests over many fragile ones.

## 0) Definition of done
A test is acceptable only if:
- It is deterministic across runs (local + CI).
- It does not rely on wall-clock timing for correctness.
- It can fail for one clear reason.
- Failure output is actionable (what broke, where, expected vs actual).

## 1) What E2E tests MUST cover
Write E2E tests only for:
- Critical user journeys (login/signup, core content discovery, core playback/start/stop, create/delete flows).
- Cross-system integration that cannot be validated in unit/integration tests.
- Smoke-level confidence that the app boots and essential paths work.

If a behavior can be validated via unit or integration tests, do NOT add an E2E test.

## 2) What E2E tests MUST NOT do
Never:
- Assert exact milliseconds (e.g., “starts within 2500ms”, “hides at 30s”).
- Use `waitForTimeout` except for tiny debug-only waits (must be removed before merge).
- Assert internal implementation details (function calls, component structure, internal state names).
- Depend on non-deterministic ordering from backends (e.g., Firestore order with ties).
- Require real external networks/APIs (YouTube, third-party services, real Algolia, etc.).

## 3) Determinism rules (mandatory)
### Data determinism
- Always seed test data explicitly.
- If sorting is tested, ensure unique sortable keys (e.g., unique timestamps).
- If backend ordering could tie, enforce a stable tie-breaker (e.g., orderBy(createdAt desc) + orderBy(__name__ desc)).
- Never depend on “natural insertion order”.

### Environment determinism
- Disable or neutralize sources of flake where possible:
  - animations / transitions
  - service workers (blocked via `serviceWorkers: 'block'` in `playwright.config.cjs`)
  - variable network (mock/stub)
- Use a consistent viewport/device profile per suite unless the test is explicitly responsive.

### Time determinism
- Prefer asserting state transitions and eventual consistency:
  - `expect(locator).toBeVisible()` / `toHaveText()` with Playwright’s built-in waiting
  - polling assertions that verify “eventually reaches expected state”
- If time is inherently part of the UX, assert ranges or states rather than exact times.

## 4) Assertion style
Write assertions that describe user-visible outcomes:
- Use locators based on accessibility (`getByRole`, `getByLabel`, `getByText`), then stable test IDs if necessary.
- Avoid brittle CSS selectors, DOM traversal, or text that is likely to change.
- For lists: assert order by comparing extracted values, not by assuming DOM order without stable sorting.

## 5) One behavior per test
- Each test must validate one user behavior and one core expectation.
- If multiple behaviors are required, split into separate tests or use helper steps with clear boundaries.
- Keep tests short and readable.

## 6) Handling “real-time” features (media, sync, playback)
Media playback is nondeterministic in CI:
- Do NOT assert “video starts within X ms”.
- Do NOT assert exact drift at exact times.
Instead:
- Assert that playback state becomes “playing”.
- If sync is required, measure drift via repeated sampling and assert:
  - drift converges to <= threshold within a bounded retry window, and/or
  - drift stays below threshold for N consecutive samples.
- Prefer stubbing/mocking the player clock when possible.

## 7) Waiting strategy (mandatory)
- Use Playwright auto-wait and expect polling.
- Prefer:
  - `await expect(locator).toBeVisible()`
  - `await expect(locator).toHaveText(...)`
  - `await page.waitForResponse(...)` (only for deterministic internal endpoints)
- Avoid:
  - `waitForTimeout`
  - arbitrary sleeps
If you must poll, implement bounded retries with clear failure messages.

## 8) Diagnostics requirements
On failure, tests must provide:
- The relevant page URL.
- The key UI state (e.g., visible headings, error banners).
- Optional: screenshot or trace (if CI is configured).
Add targeted logs for tricky flows (not noisy logging everywhere).

## 9) Structure and reuse
- Extract stable helper utilities:
  - seed data
  - login helper
  - navigation helper
  - common assertions
- Helpers must be small and do one thing. Avoid “god helpers”.
- Keep fixtures minimal and scenario-specific.

## 10) CI considerations
- Assume slower machines.
- Avoid heavy parallelism that causes contention unless explicitly configured.
- Ensure emulators are used consistently when configured (Firestore emulator etc.).
- Never require authentication tokens or local-only resources.

## 11) If a test is flaky
When a test flakes:
1) Identify the nondeterministic input (timing, ordering, async dependencies).
2) Remove wall-clock assumptions.
3) Add determinism (tie-breakers, seeded unique data, stable wait conditions).
4) If the behavior is fundamentally nondeterministic in E2E, move it to integration tests.

## 12) Output format requirements
When you add/modify tests, you must also:
- Update/extend fixtures (if needed) to ensure determinism.
- Ensure tests are named as user behaviors (not file/function names).
- Provide a short note in PR description explaining why the test is stable in CI.

Follow these rules strictly. If asked to write an E2E test that violates these constraints, propose an alternative (integration/unit) or redesign the assertions to be deterministic.