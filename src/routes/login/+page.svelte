
<script>
  export let data;

  let email = '';
  let password = '';
  let isSignUp = false;

  const handleLogin = () => {
    data.handleUserAction('login', {email, password})
  };

  const handleSignUp = () => {
    data.handleUserAction('signup', {email, password})
  };

  const toggleForm = () => {
    isSignUp = !isSignUp;
  };
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
        <input type="password" placeholder="Password" class="w-full p-3 border border-gray-300 rounded" bind:value={password} />
      </div>
      <button type="button" class="w-full bg-pink-700 text-white p-3 rounded" on:click={handleSignUp}>Sign Up</button>
    </form>
  <p class="mt-4 text-center">Already have an account? <button type="button" class="text-blue-500 underline-offset-2 hover:underline bg-transparent p-0 border-0" on:click={toggleForm}>Login</button></p>
  {/if}
</div>
