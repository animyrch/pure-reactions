#!/usr/bin/env node

// Usage:
//   npm run admin:reassign-reaction -- --reactionId "<docId>" --newUserId "<uid>"
//
// Options:
//   --target emulator|prod   (default: emulator)
//   --allowProd              Required when --target prod
//   --dry                    Print what would change without writing
//   --projectId <id>
//   --reactionsCollection <name>
//
// Example (prod):
//   npm run admin:reassign-reaction -- --reactionId "abc123" --newUserId "uid456" --target prod --allowProd

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

// ─── Arg parsing ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    reactionId: undefined,
    newUserId: undefined,
    target: undefined,
    allowProd: false,
    dry: false,
    projectId: undefined,
    reactionsCollection: undefined,
    emulatorHost: undefined,
    emulatorPort: undefined
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--reactionId' && next) { args.reactionId = next; i += 1; continue; }
    if (token === '--newUserId' && next) { args.newUserId = next; i += 1; continue; }
    if (token === '--target' && next) { args.target = next; i += 1; continue; }
    if (token === '--projectId' && next) { args.projectId = next; i += 1; continue; }
    if (token === '--reactionsCollection' && next) { args.reactionsCollection = next; i += 1; continue; }
    if (token === '--emulatorHost' && next) { args.emulatorHost = next; i += 1; continue; }
    if (token === '--emulatorPort' && next) { args.emulatorPort = Number(next); i += 1; continue; }
    if (token === '--allowProd') { args.allowProd = true; continue; }
    if (token === '--dry') { args.dry = true; continue; }
  }

  return args;
}

// ─── Env helpers ────────────────────────────────────────────────────────────

function loadDotEnvIfPresent(envPath = '.env') {
  const abs = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// ─── Firebase init ───────────────────────────────────────────────────────────

function ensureAdminApp({ projectId, target }) {
  if (admin.apps.length) return admin.app();

  if (target === 'emulator') {
    return admin.initializeApp({ projectId });
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountPath) {
    const abs = path.resolve(process.cwd(), serviceAccountPath);
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id
    });
  }

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id
    });
  }

  return admin.initializeApp({ projectId });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function reassignReaction() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  const target =
    args.target ||
    (process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'emulator');

  const projectId =
    args.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.PUBLIC_FIREBASE_PROJECT_ID ||
    'pure-reactions';

  const localCollection =
    process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions-local';
  const prodCollection = localCollection.replace(/[-_]local$/, (m) => m[0] + 'prod');

  const reactionsCollection =
    args.reactionsCollection ||
    (target === 'prod' ? prodCollection : localCollection);

  // ── Validate required args ────────────────────────────────────────────────

  if (!args.reactionId) {
    throw new Error('Missing required argument: --reactionId');
  }
  if (!args.newUserId) {
    throw new Error('Missing required argument: --newUserId');
  }

  if (target !== 'emulator' && target !== 'prod') {
    throw new Error(`Unknown --target: ${target}. Must be "emulator" or "prod".`);
  }

  if (target === 'prod') {
    const allow =
      args.allowProd ||
      process.env.ALLOW_PROD_REASSIGN === '1' ||
      process.env.ALLOW_PROD_REASSIGN === 'true';
    if (!allow) {
      throw new Error(
        'Refusing to write to prod: pass --allowProd or set ALLOW_PROD_REASSIGN=1'
      );
    }
    if (
      !process.env.FIREBASE_SERVICE_ACCOUNT &&
      !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ) {
      throw new Error(
        'Missing prod credentials: set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON'
      );
    }
  }

  // ── Emulator host ─────────────────────────────────────────────────────────

  if (target === 'emulator') {
    const host =
      args.emulatorHost ||
      process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] ||
      '127.0.0.1';
    const port =
      Number(args.emulatorPort) ||
      Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1]) ||
      8080;
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  }

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();
  const auth = admin.auth();

  // ── Fetch current reaction ────────────────────────────────────────────────

  const reactionRef = db.collection(reactionsCollection).doc(args.reactionId);
  const reactionSnap = await reactionRef.get();

  if (!reactionSnap.exists) {
    throw new Error(
      `Reaction not found: ${reactionsCollection}/${args.reactionId}`
    );
  }

  const current = reactionSnap.data();
  const oldReactorId = current.reactorId ?? '(none)';
  const oldDisplayName = current.reactorDisplayName ?? '(none)';

  // ── Fetch new user from Auth ──────────────────────────────────────────────

  let newDisplayName = null;

  if (target !== 'emulator') {
    try {
      const userRecord = await auth.getUser(args.newUserId);
      newDisplayName = userRecord.displayName || userRecord.email || args.newUserId;
    } catch {
      // Non-fatal: proceed without display name update
      console.warn(
        `Warning: could not look up user ${args.newUserId} in Firebase Auth. reactorDisplayName will not be updated.`
      );
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  console.log('\nReaction:', `${reactionsCollection}/${args.reactionId}`);
  console.log('  reactionVideoTitle :', current.reactionVideoTitle ?? '(no title)');
  console.log('  Current reactorId  :', oldReactorId);
  console.log('  Current displayName:', oldDisplayName);
  console.log('  → New reactorId    :', args.newUserId);
  if (newDisplayName !== null) {
    console.log('  → New displayName  :', newDisplayName);
  }

  if (args.dry) {
    console.log('\n[dry-run] No changes written.');
    return;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  const update = {
    reactorId: args.newUserId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (newDisplayName !== null) {
    update.reactorDisplayName = newDisplayName;
  }

  await reactionRef.update(update);

  console.log('\nDone. Reaction reassigned successfully.');
  if (newDisplayName === null) {
    console.log(
      'Note: reactorDisplayName was not updated (emulator mode or Auth lookup failed). Update it manually if needed.'
    );
  }
}

reassignReaction().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('\nError:', error?.message || error);
  process.exitCode = 1;
});
