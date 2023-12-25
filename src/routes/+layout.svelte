<script>
	/** @type {import('./$types').PageData} */
  import { goto } from '$app/navigation';
  import SignupModal from '$lib/components/SignupModal.svelte';
  import SignInModal from '$lib/components/SignInModal.svelte';

  let showModal = false;
  let showSignInModal = false;

	export let data;
</script>

<header>
  <h1><a href="/">Pure Reactions</a></h1>
</header>

<div class="app-container">

  <div class="account-status">
    {#if data.isLoggedIn}
      <div>
        <p>Hello {data.displayName || data.userEmail}</p>
        <div>
          <button on:click={() => goto('/account')}>My Account</button>
          <button on:click={() => data.handleUserAction('logout')}>Log Out</button>
        </div>
      </div>
    {:else}
      <div>
        <p>You are not logged in.</p>
        <div>
          <!-- <button on:click={() => data.handleUserAction('login')}>Log In</button> -->
          <button on:click={() => showSignInModal = true}>Login</button>
          <!-- <button on:click={() => data.handleUserAction('signup')}>Sign up</button> -->
          <button on:click={() => showModal = true}>Signup</button>
        </div>
      </div>
    {/if}
  </div>
  
  <nav>
    <a href="/">Home</a>
    <a href="/backend">Create a reaction</a>
  </nav>
  
  <slot></slot>

</div>

<SignupModal {showModal} on:signup={(signupData => data.handleUserAction('signup', signupData))} />
<SignInModal {showSignInModal} on:signin={(signInData => data.handleUserAction('login', signInData))} />
<footer>
  <p>&copy; 2023 Pure Reactions</p>
</footer>

<style>
  .account-status {
    padding: 10px;
    width: 100%;
    text-align: right;
  }
</style>