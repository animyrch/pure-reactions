
<script>
  import { env } from '$env/dynamic/public';
  export let data;

  let email = '';
  let password = '';
  let isSignUp = false;
  let passwordRulesWithStatus = [];
  let unmetPasswordRules = [];
  let isPasswordValid = false;
  let canSubmitSignUp = false;
  let backendMissingRequirements = [];
  let backendFallbackMessage = '';
  const isUsingFirebaseEmulators = env.PUBLIC_FIREBASE_USE_EMULATORS === 'true';

  const passwordRules = [
    {
      id: 'length',
      label: 'Password must contain at least 6 characters',
      test: (value) => value.length >= 6
    },
    {
      id: 'upper',
      label: 'Password must contain a upper case character',
      test: (value) => /[A-Z]/.test(value)
    },
    {
      id: 'numeric',
      label: 'Password must contain a numeric character',
      test: (value) => /[0-9]/.test(value)
    },
    {
      id: 'lower',
      label: 'Password must contain an lower case character',
      test: (value) => /[a-z]/.test(value)
    },
    {
      id: 'non-alphanumeric',
      label: 'Password must contain a symbol',
      test: (value) => /[^a-zA-Z0-9]/.test(value)
    }
  ];

  const resetBackendPasswordFeedback = () => {
    backendMissingRequirements = [];
    backendFallbackMessage = '';
  };

  const mapRequirementLabel = (requirement) => {
    const mapping = {
      'Password must contain a non-alphanumeric character': 'Password must contain a symbol'
    };
    return mapping[requirement] || requirement;
  };

  const parsePasswordRequirements = (message) => {
    if (typeof message !== 'string') {
      return null;
    }
    const match = message.match(/Missing password requirements:\s*\[(.*?)\]/i);
    if (!match || !match[1]) {
      return null;
    }
    return match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(mapRequirementLabel);
  };

  const extractErrorMessage = (errorDetails) => {
    if (!errorDetails) {
      return null;
    }
    if (typeof errorDetails === 'string') {
      return errorDetails;
    }
    if (typeof errorDetails?.message === 'string') {
      return errorDetails.message;
    }
    if (typeof errorDetails?.raw?.message === 'string') {
      return errorDetails.raw.message;
    }
    if (typeof errorDetails?.raw?.error?.message === 'string') {
      return errorDetails.raw.error.message;
    }
    if (typeof errorDetails?.raw?.data?.error?.message === 'string') {
      return errorDetails.raw.data.error.message;
    }
    return null;
  };

  const handleLogin = () => {
    resetBackendPasswordFeedback();
    data.handleUserAction('login', {email, password})
  };

  const handleSignUp = async () => {
    resetBackendPasswordFeedback();
    if (!canSubmitSignUp) {
      return;
    }
    const result = await data.handleUserAction('signup', {email, password});
    if (!result?.error) {
      return;
    }
    const message = extractErrorMessage(result.error);
    if (!message || !message.includes('PASSWORD_DOES_NOT_MEET_REQUIREMENTS')) {
      return;
    }
    const parsedRequirements = parsePasswordRequirements(message);
    if (parsedRequirements && parsedRequirements.length) {
      backendMissingRequirements = parsedRequirements;
      return;
    }
    backendFallbackMessage = 'Password does not meet requirements. Please review the checklist and try again.';
    console.error('Failed to parse password requirements', {
      message,
      error: result.error
    });
  };

  const toggleForm = () => {
    isSignUp = !isSignUp;
    resetBackendPasswordFeedback();
  };

  $: passwordRulesWithStatus = passwordRules.map((rule) => ({
    ...rule,
    satisfied: rule.test(password || '')
  }));
  $: unmetPasswordRules = passwordRulesWithStatus.filter((rule) => !rule.satisfied);
  $: isPasswordValid = unmetPasswordRules.length === 0;
  $: canSubmitSignUp = Boolean(email) && isPasswordValid;
</script>

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  {#if !isSignUp}
    <h2 class="text-2xl font-semibold text-center mb-4">Login</h2>
    <form>
      <div class="mb-4">
        <input type="email" placeholder="Email" class="w-full p-3 border border-gray-300 rounded" bind:value={email} />
      </div>
      <div class="mb-4">
        <input type="password" placeholder="Password" class="w-full p-3 border border-gray-300 rounded" bind:value={password} />
      </div>
      <button type="button" class="w-full bg-gray-900 text-white p-3 rounded" on:click={handleLogin}>Login</button>
    </form>
  <p class="mt-4 text-center">Don't have an account? <button type="button" class="text-blue-500 underline-offset-2 hover:underline bg-transparent p-0 border-0" on:click={toggleForm}>Sign up</button></p>
  {/if}

  {#if isSignUp}
    <h2 class="text-2xl font-semibold text-center mb-4">Sign Up</h2>
    <form>
      <div class="mb-4">
        <input type="email" placeholder="Email" class="w-full p-3 border border-gray-300 rounded" bind:value={email} />
      </div>
      <div class="mb-4">
        <input
          type="password"
          placeholder="Password"
          class="w-full p-3 border border-gray-300 rounded"
          bind:value={password}
          on:input={resetBackendPasswordFeedback}
        />
        <div class="mt-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Password requirements</p>
          <ul class="mt-2 space-y-1 text-sm" aria-live="polite">
            {#each passwordRulesWithStatus as rule}
              <li class={`flex items-start gap-2 ${rule.satisfied ? 'text-emerald-700' : 'text-gray-600'}`}>
                <span
                  class={`mt-2 h-2 w-2 shrink-0 rounded-full ${rule.satisfied ? 'bg-emerald-600' : 'bg-gray-400'}`}
                  aria-hidden="true"
                ></span>
                <span class={rule.satisfied ? 'line-through' : ''}>{rule.label}</span>
              </li>
            {/each}
          </ul>
          {#if backendMissingRequirements.length}
            <div class="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm" role="alert">
              <p class="font-medium">Backend validation failed. Please also check:</p>
              <ul class="mt-2 space-y-1">
                {#each backendMissingRequirements as requirement}
                  <li class="flex items-start gap-2">
                    <span class="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>
                    <span>{requirement}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {:else if backendFallbackMessage}
            <div class="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm" role="alert">
              {backendFallbackMessage}
            </div>
          {/if}
        </div>
      </div>
      <button
        type="button"
        class="w-full bg-pink-700 text-white p-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={handleSignUp}
        disabled={!canSubmitSignUp}
      >
        Sign Up
      </button>
      {#if isUsingFirebaseEmulators}
        <div class="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="note">
          <p class="font-medium">Local development note</p>
          <p class="mt-1">
            The Firebase Auth emulator lets you create accounts locally, but new accounts still need email verification before they can create reactions or use protected actions.
          </p>
          <p class="mt-1">
            After signing up, open the verification link printed in the terminal running the emulator.
          </p>
        </div>
      {/if}
    </form>
  <p class="mt-4 text-center">Already have an account? <button type="button" class="text-blue-500 underline-offset-2 hover:underline bg-transparent p-0 border-0" on:click={toggleForm}>Login</button></p>
  {/if}
</div>
