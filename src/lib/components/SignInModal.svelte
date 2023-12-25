<!-- SignupModal.svelte -->
<style>
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
    }
  
    .modal-content {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
    }
  </style>
  
  <script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let showSignInModal;
    let email = '';
    let password = '';
    
  
    function handleSignIn() {
      // Implement your signup logic here using Nuxt.js composition API and GCP servers
      // For simplicity, let's just log the user input for now
        const signInData = { email, password };
        // Emit a custom event to send data to the parent component
        dispatch('signin', signInData);
  
      // Close the modal after signup
      showSignInModal = false;
    }
  </script>
  
{#if showSignInModal}
<div class="modal">
    <div class="modal-content">
    <h2>Login</h2>
    <label for="email">Email:</label>
    <input type="email" id="email" bind:value={email} />

    <label for="password">Password:</label>
    <input type="password" id="password" bind:value={password} />
    <button on:click={handleSignIn}>Login</button>
    </div>
</div>
{/if}
