# Feature: Export Firestore prod collections to JSON for emulator seeding

## Problem
- Current migration script only copies data between cloud collections or emulator collections, not from cloud to emulator.
- There is no way to export prod data to a JSON fixture for local emulator seeding without overwriting or mixing with test fixtures.
- Test fixtures must remain untouched for CI and local test reliability.

## Solution
- Add an `--export-json <path>` flag to `scripts/migrate-prod-to-local.mjs`.
- When this flag is set, instead of writing to Firestore, the script should export the selected prod collections to a JSON file in the same format as `seed-firestore-fixtures.mjs` expects (object with `docs` array).
- The export file should be placed in a dedicated location (e.g., `tests/fixtures/reactions/prod-export.json`) to avoid confusion with test seeds.
- Document that emulator seeding should be done by running the seed script for both the test fixture and the prod export file, e.g.:
  ```sh
  node scripts/seed-firestore-fixtures.mjs --fixture tests/fixtures/reactions/local-dev-seed.json
  node scripts/seed-firestore-fixtures.mjs --fixture tests/fixtures/reactions/prod-export.json
  ```
- Ensure the export format is compatible with the seeding script and does not overwrite existing test data.

## Acceptance Criteria
- [ ] `migrate-prod-to-local.mjs --export-json <path>` exports prod collections to a JSON file in the correct format.
- [ ] Exported file does not overwrite or mix with test fixtures.
- [ ] Emulator can be seeded with both test and prod-exported data, cumulatively.
- [ ] Documentation updated to describe the workflow.

---

**Priority:** High for local development parity and safe test data management.
**Labels:** migration, emulator, fixtures, DX
