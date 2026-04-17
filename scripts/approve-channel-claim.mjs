#!/usr/bin/env node

// Usage:
//   npm run approve:claim -- --claimId "<channelId>__<userId>" [--status approved|rejected] [--reviewNotes "notes"]
//   npm run approve:claim -- --channelId "@handle" --userId "<uid>" [--status approved|rejected]
//
// Options:
//   --target emulator|prod (default: emulator)
//   --allowProd (required when --target prod)
//   --projectId <id>
//   --claimsCollection <name>
//   --verificationsCollection <name>
//   --emulatorHost <host> --emulatorPort <port>

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import admin from 'firebase-admin';

function parseArgs(argv) {
  const args = {
    claimId: undefined,
    channelId: undefined,
    userId: undefined,
    status: 'approved',
    reviewNotes: undefined,
    target: undefined, // emulator | prod
    emulatorHost: undefined,
    emulatorPort: undefined,
    projectId: undefined,
    claimsCollection: undefined,
    verificationsCollection: undefined,
    allowProd: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--claimId' && next) {
      args.claimId = next;
      i += 1;
      continue;
    }

    if (token === '--channelId' && next) {
      args.channelId = next;
      i += 1;
      continue;
    }

    if (token === '--userId' && next) {
      args.userId = next;
      i += 1;
      continue;
    }

    if (token === '--status' && next) {
      args.status = next;
      i += 1;
      continue;
    }

    if (token === '--reviewNotes' && next) {
      args.reviewNotes = next;
      i += 1;
      continue;
    }

    if (token === '--target' && next) {
      args.target = next;
      i += 1;
      continue;
    }

    if (token === '--emulatorHost' && next) {
      args.emulatorHost = next;
      i += 1;
      continue;
    }

    if (token === '--emulatorPort' && next) {
      args.emulatorPort = Number(next);
      i += 1;
      continue;
    }

    if (token === '--projectId' && next) {
      args.projectId = next;
      i += 1;
      continue;
    }

    if (token === '--claimsCollection' && next) {
      args.claimsCollection = next;
      i += 1;
      continue;
    }

    if (token === '--verificationsCollection' && next) {
      args.verificationsCollection = next;
      i += 1;
      continue;
    }

    if (token === '--allowProd') {
      args.allowProd = true;
      continue;
    }
  }

  return args;
}

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

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function ensureAdminApp({ projectId, target }) {
  if (admin.apps.length) {
    return admin.app();
  }

  if (target === 'emulator') {
    return admin.initializeApp({ projectId });
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (serviceAccount?.startsWith('{')) {
    const parsed = JSON.parse(serviceAccount);
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: projectId || parsed.project_id
    });
  }

  return admin.initializeApp({ projectId });
}

function extractChannelId(claimId) {
  const separator = '__';
  const sepIndex = claimId.lastIndexOf(separator);
  if (sepIndex <= 0 || sepIndex === claimId.length - separator.length) {
    return '';
  }
  return claimId.slice(0, sepIndex);
}

async function approveClaim() {
  const args = parseArgs(process.argv);
  loadDotEnvIfPresent('.env');

  const target =
    args.target || process.env.FIREBASE_APPROVE_TARGET || (process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'emulator');
  const projectId = args.projectId || process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || 'pure-reactions';
  const claimsCollection =
    args.claimsCollection || process.env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_CLAIMS || 'youtubeChannelClaims_local';
  const verificationsCollection =
    args.verificationsCollection ||
    process.env.PUBLIC_FIREBASE_COLLECTION_YOUTUBE_CHANNEL_VERIFICATIONS ||
    'youtubeChannelVerifications_local';

  if (target !== 'emulator' && target !== 'prod') {
    throw new Error(`Unknown target: ${target}`);
  }

  if (target === 'prod') {
    const allow = args.allowProd || process.env.ALLOW_PROD_APPROVE === '1' || process.env.ALLOW_PROD_APPROVE === 'true';
    if (!allow) {
      throw new Error('Refusing to approve on prod: set ALLOW_PROD_APPROVE=1 or pass --allowProd');
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('Missing prod credentials: set FIREBASE_SERVICE_ACCOUNT');
    }
  }

  if (target === 'emulator') {
    const host = args.emulatorHost || process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || process.env.PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port =
      Number(args.emulatorPort) ||
      Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1]) ||
      Number(process.env.PUBLIC_FIRESTORE_EMULATOR_PORT) ||
      8080;
    process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  }

  const claimId = args.claimId || (args.channelId && args.userId ? `${args.channelId}__${args.userId}` : '');
  if (!claimId) {
    throw new Error('Provide --claimId or both --channelId and --userId');
  }

  const channelId = args.channelId || extractChannelId(claimId);
  if (!channelId) {
    throw new Error('Unable to determine channelId from claimId; use --channelId');
  }

  const status = (args.status || 'approved').toLowerCase();
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('Status must be "approved" or "rejected"');
  }

  ensureAdminApp({ projectId, target });
  const db = admin.firestore();

  const claimRef = db.collection(claimsCollection).doc(claimId);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) {
    throw new Error(`Claim not found: ${claimsCollection}/${claimId}`);
  }

  const batch = db.batch();
  const claimUpdate = { status };
  if (args.reviewNotes) {
    claimUpdate.reviewNotes = args.reviewNotes;
  }
  batch.update(claimRef, claimUpdate);

  if (status === 'approved') {
    const verificationRef = db.collection(verificationsCollection).doc(channelId);
    const claimUserId = claimSnap.data()?.userId || '';
    batch.set(
      verificationRef,
      {
        status: 'approved',
        claimId,
        userId: claimUserId,
        approvedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();

  // eslint-disable-next-line no-console
  console.log(
    `Claim ${claimId} marked ${status}.${status === 'approved' ? ` Verification doc written to ${verificationsCollection}/${channelId}.` : ''}`
  );
}

approveClaim().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error?.message || error);
  process.exitCode = 1;
});
