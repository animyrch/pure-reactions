<script>
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import { sendEmailVerification } from 'firebase/auth';
  import { onMount } from 'svelte';
  import { auth } from '$lib/helpers/firebase';
  import { TOASTS } from '$lib/constants/toasts';
  import { goToRoute } from '$lib/helpers/routing';
  import { currentUser } from '$lib/stores/user';
  import { showToast } from '$lib/stores/toast';

  export let data;

  let isCheckingVerification = false;
  let isResendingVerification = false;
  let verificationEmail = '';
  let statusMessage = '';
  let statusTone = 'neutral';

  const isUsingFirebaseEmulators = env.PUBLIC_FIREBASE_USE_EMULATORS === 'true';

  const getRedirectTarget = () => {
    const redirect = $page.url.searchParams.get('redirect') || '/';
    if (!redirect.startsWith('/') || redirect === '/account/verify') {
      return '/';
    }
    return redirect;
  };

  $: redirectTarget = getRedirectTarget();

  const syncCurrentUser = async () => {
    if (!auth?.currentUser) {
      currentUser.set({});
      await goToRoute('/login');
      return null;
    }

    currentUser.set(auth.currentUser);
    verificationEmail = auth.currentUser.email || '';
    await invalidate('app:auth');
    return auth.currentUser;
  };

  const refreshVerificationStatus = async () => {
    if (!auth?.currentUser) {
      await goToRoute('/login');
      showToast('You need to login to continue.', TOASTS.ERROR);
      return;
    }

    isCheckingVerification = true;
    statusMessage = '';
    statusTone = 'neutral';

    try {
      await auth.currentUser.reload();
      const user = await syncCurrentUser();
      if (user?.emailVerified) {
        showToast('Account verified. You can continue.', TOASTS.SUCCESS);
        await goToRoute(redirectTarget);
        return;
      }

      statusMessage = 'Your account is still unverified. Open the verification link, then try again.';
      statusTone = 'warning';
    } catch (error) {
      console.error('Failed to refresh verification state:', error);
      statusMessage = 'Could not refresh your verification status. Please try again.';
      statusTone = 'error';
    } finally {
      isCheckingVerification = false;
    }
  };

  const resendVerificationLink = async () => {
    if (!auth?.currentUser) {
      await goToRoute('/login');
      showToast('You need to login to continue.', TOASTS.ERROR);
      return;
    }

    isResendingVerification = true;
    statusMessage = '';
    statusTone = 'neutral';

    try {
      const verificationUrl = browser
        ? new URL('/account/verify', window.location.origin)
        : null;

      if (verificationUrl && redirectTarget !== '/') {
        verificationUrl.searchParams.set('redirect', redirectTarget);
      }

      await sendEmailVerification(
        auth.currentUser,
        verificationUrl
          ? {
              url: verificationUrl.toString()
            }
          : undefined
      );

      statusMessage = isUsingFirebaseEmulators
        ? 'Verification link sent. Open the link printed by the Firebase Auth emulator, then come back here and refresh your status.'
        : 'Verification email sent. Open it, then come back here and refresh your status.';
      statusTone = 'success';
      showToast('Verification link sent.', TOASTS.SUCCESS);
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      statusMessage = 'Could not send a new verification link. Please try again.';
      statusTone = 'error';
    } finally {
      isResendingVerification = false;
    }
  };

  onMount(async () => {
    const user = await syncCurrentUser();
    if (!user) {
      showToast('You need to login to continue.', TOASTS.ERROR);
      return;
    }

    if (user.emailVerified) {
      await goToRoute(redirectTarget);
      return;
    }

    statusMessage = isUsingFirebaseEmulators
      ? 'When you sign up locally, the Firebase Auth emulator prints the verification link in its terminal output.'
      : 'Check your inbox for the verification email, then return here.';
  });
</script>

<div class="min-h-screen bg-slate-950 px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-3xl">
    <div class="overflow-hidden rounded-[2rem] border border-slate-800/70 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-[0_35px_120px_-60px_rgba(15,23,42,1)]">
      <div class="border-b border-slate-800/80 px-6 py-5 sm:px-10 sm:py-8">
        <p class="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">Verification Required</p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Verify your account before creating reactions</h1>
        <p class="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          Your account is signed in, but it still needs email verification before you can create reactions or use protected actions.
        </p>
      </div>

      <div class="grid gap-6 px-6 py-6 sm:px-10 sm:py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section class="space-y-6">
          <div class="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Account</p>
            <p class="mt-3 text-lg font-medium text-white">{verificationEmail || 'Signed-in account'}</p>
            <p class="mt-2 text-sm leading-6 text-slate-400">
              Once verification is complete, this account can continue to {redirectTarget === '/' ? 'the app' : 'the action you were trying to access'}.
            </p>
          </div>

          <div class="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">What To Do</p>
            <ol class="mt-4 space-y-4 text-sm leading-6 text-slate-300">
              <li class="flex gap-3">
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-200">1</span>
                <span>Open the verification link for this account.</span>
              </li>
              <li class="flex gap-3">
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-200">2</span>
                <span>Return here and click <strong class="font-semibold text-white">I’ve verified my account</strong>.</span>
              </li>
              <li class="flex gap-3">
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-200">3</span>
                <span>The app will refresh your auth state and continue.</span>
              </li>
            </ol>
          </div>

          {#if statusMessage}
            <div
              class={`rounded-3xl border p-4 text-sm leading-6 ${
                statusTone === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : statusTone === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                    : statusTone === 'error'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                      : 'border-slate-800/80 bg-slate-900/40 text-slate-300'
              }`}
              role="status"
            >
              {statusMessage}
            </div>
          {/if}

          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              class="inline-flex min-h-[3rem] items-center justify-center rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/70 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              on:click={refreshVerificationStatus}
              disabled={isCheckingVerification}
            >
              {isCheckingVerification ? 'Checking verification…' : 'I’ve verified my account'}
            </button>
            <button
              type="button"
              class="inline-flex min-h-[3rem] items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
              on:click={resendVerificationLink}
              disabled={isResendingVerification}
            >
              {isResendingVerification ? 'Sending link…' : 'Send verification link again'}
            </button>
            <button
              type="button"
              class="inline-flex min-h-[3rem] items-center justify-center rounded-full border border-transparent px-5 py-3 text-sm font-semibold text-slate-400 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              on:click={() => data.handleUserAction('logout')}
            >
              Logout
            </button>
          </div>
        </section>

        <aside class="space-y-4">
          {#if isUsingFirebaseEmulators}
            <div class="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-5 text-sm leading-6 text-blue-100">
              <p class="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200/80">Local Development</p>
              <p class="mt-3">
                When the Firebase Auth emulator is running, it prints the verification link in the same terminal where you started the emulator.
              </p>
              <p class="mt-3">
                Click that link in your browser. Creating the account alone is not enough to unlock reaction creation.
              </p>
            </div>
          {/if}

          <div class="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-5 text-sm leading-6 text-slate-400">
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Need A Different Account?</p>
            <p class="mt-3">
              If you signed up with the wrong email address, log out and create or verify the correct account instead.
            </p>
          </div>
        </aside>
      </div>
    </div>
  </div>
</div>