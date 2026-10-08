import admin from 'firebase-admin';
import { YT_PLAYER_STATE, clickPlayerSurface } from './twin-player-helpers.js';

export const REMIX_OWNER_EMAIL = 'remix-owner@example.com';
export const REMIX_OWNER_PASSWORD = 'Remix1!';

const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const REMIX_DOCUMENT_IDS = [
  'remixPlaythrough0001',
  'remixPauseAtCue0001',
  'remixJumpCue000001',
  'remixWatchReaction01',
  'remixEditor00000001',
  'remixEditorOn000001',
  'remixFineTuneCue0001',
  'remixFineTunePause01',
  'remixFineTuneJump001',
  'remixFineTunePlays01',
];

function remixFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-pure-reactions' });
  }
  return admin.firestore();
}

async function remixOwnerId() {
  const signUp = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: REMIX_OWNER_EMAIL,
        password: REMIX_OWNER_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  if (signUp.ok) {
    const body = await signUp.json();
    return body.localId;
  }

  const errorBody = await signUp.json().catch(() => ({}));
  const message = errorBody?.error?.message || '';
  if (!message.includes('EMAIL_EXISTS')) {
    throw new Error(`Could not create the remix owner (${signUp.status} ${message})`);
  }

  const signIn = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: REMIX_OWNER_EMAIL,
        password: REMIX_OWNER_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  if (!signIn.ok) {
    const signInError = await signIn.json().catch(() => ({}));
    throw new Error(`Remix owner exists but could not sign in (${signIn.status} ${signInError?.error?.message || ''})`);
  }
  const signedIn = await signIn.json();
  return signedIn.localId;
}

export async function ensureRemixOwner() {
  const localId = await remixOwnerId();
  const collection = process.env.PUBLIC_FIREBASE_COLLECTION_REACTION_BINOMES || 'reactions-local';
  const db = remixFirestore();
  await Promise.all(REMIX_DOCUMENT_IDS.map((id) => {
    const patch = { reactorId: localId };
    if (id === 'remixEditor00000001') {
      patch.remixMode = false;
    }
    if (id === 'remixFineTunePause01' || id === 'remixFineTuneJump001' || id === 'remixFineTunePlays01') {
      patch.remixMode = true;
      patch.reactionVideoId = '';
      patch.stateTimeline = [];
    }
    return db.collection(collection).doc(id).update(patch);
  }));
}

export async function loginAsRemixOwner(page) {
  await page.goto('/login');
  await page.getByRole('heading', { name: 'Login' }).waitFor();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    // The first click can land before Svelte hydrates and submit the form as a GET.
    if (attempt > 0) {
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
    }
    await page.getByPlaceholder('Email').fill(REMIX_OWNER_EMAIL);
    await page.getByPlaceholder('Password').fill(REMIX_OWNER_PASSWORD);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8000 });
      return;
    } catch (error) {
      const stillOnLogin = new URL(page.url()).pathname.startsWith('/login');
      if (!stillOnLogin || attempt === 2) {
        throw error;
      }
    }
  }
}

export async function waitForOriginalPlayer(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const player = window.__players?.original;
    return typeof player?.getPlayerState === 'function' && typeof player.getPlayerState() === 'number';
  }, null, { timeout });
}

export async function readPlayback(page) {
  return page.evaluate(() => {
    const players = window.__players;
    const read = (player) => {
      if (!player || typeof player.getPlayerState !== 'function') return null;
      return {
        state: player.getPlayerState(),
        time: typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : null,
        duration: typeof player.getDuration === 'function' ? player.getDuration() : null,
      };
    };
    return {
      bothVideosStarted: Boolean(players?.bothVideosStarted),
      original: read(players?.original),
      reaction: read(players?.reaction),
    };
  });
}

export async function startOriginalOnly(page) {
  await clickPlayerSurface(page, 'original');
}

export function isActive(state) {
  return state === YT_PLAYER_STATE.PLAYING || state === YT_PLAYER_STATE.BUFFERING;
}

export async function cueSecondsAt(page, trackId, ratio) {
  const track = page.locator(`[data-track-id="${trackId}"]`);
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  if (!box) {
    throw new Error(`Track ${trackId} has no box`);
  }
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
  await page.getByRole('dialog', { name: 'New playback configuration' }).waitFor();
  const minutes = Number(await page.locator('#pending-reaction-minutes').inputValue());
  const seconds = Number(await page.locator('#pending-reaction-seconds').inputValue());
  return minutes * 60 + seconds;
}
