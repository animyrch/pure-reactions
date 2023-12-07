<script>
	/** @type {import('./$types').PageData} */
	export let data;
</script>

{#if data.isLoggedIn}
  <div class="center">
    <p>Hello {data.username}</p>
    <div>
      <button on:click={() => data.handleUserAction('logout')}>Log Out</button>
    </div>
  </div>
{:else}
  <div class="center">
    <p>You are not logged in.</p>
    <div>
      <button on:click={() => data.handleUserAction('login')}>Log In</button>
    </div>
  </div>
{/if}

<header>
  <h1><a href="/">Pure Reactions</a></h1>
</header>

<nav>
	<a href="/">Home</a>
	<a href="/backend">Create a reaction</a>
</nav>

<slot></slot>

<footer>
  <p>&copy; 2023 Pure Reactions</p>
</footer>