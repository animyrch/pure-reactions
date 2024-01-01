<!-- <script>
    export let data;
</script> -->

<!-- <div>
  <div class="account-status">
    {#if data.isLoggedIn}
      <div>
        <p>Hello {data?.displayName || data?.userEmail}</p>
        <div>
          <button on:click={() => data.handleUserAction('logout')}>Log Out</button>
        </div>
      </div>
    {:else}
      <div>
        <p>You are not logged in.</p>
        <div>
          <button on:click={() => data.handleUserAction('login')}>Log In</button>
          <button>Login</button>
          <button on:click={() => data.handleUserAction('signup')}>Sign up</button>
          <button>Signup</button>
        </div>
      </div>
    {/if}
  </div>
</div> -->
<script>
  import { onMount } from 'svelte';

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
      <button type="button" class="w-full bg-blue-500 text-white p-3 rounded" on:click={handleLogin}>Login</button>
    </form>
    <p class="mt-4 text-center">Don't have an account? <span class="text-blue-500 cursor-pointer" on:click={toggleForm}>Sign up</span></p>
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
      <button type="button" class="w-full bg-green-500 text-white p-3 rounded" on:click={handleSignUp}>Sign Up</button>
    </form>
    <p class="mt-4 text-center">Already have an account? <span class="text-blue-500 cursor-pointer" on:click={toggleForm}>Login</span></p>
  {/if}
</div>
