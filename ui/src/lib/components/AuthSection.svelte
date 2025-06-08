<script lang="ts">
  import {
    isLoading,
    isAuthenticated,
    user,
    authError,
    login,
    logout,
  } from "$lib/auth";
  import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
  import ErrorMessage from "$lib/components/ErrorMessage.svelte";
</script>

{#if $isLoading}
  <div class="flex flex-col items-center justify-center min-h-screen space-y-4">
    <LoadingSpinner>Initializing authentication...</LoadingSpinner>
  </div>
{:else if $authError}
  <div
    class="flex flex-col items-center justify-center min-h-screen space-y-6 max-w-md mx-auto text-center px-6"
  >
    <h1 class="text-4xl font-bold text-rose-pine-love">Authentication Error</h1>
    <ErrorMessage message={$authError} />
    <button
      on:click={() => window.location.reload()}
      class="px-6 py-3 bg-rose-pine-iris text-rose-pine-base font-semibold rounded-lg hover:bg-rose-pine-iris/90 transition-colors duration-200"
    >
      Try Again
    </button>
  </div>
{:else if $isAuthenticated}
  <div class="w-full border-b border-rose-pine-overlay/30">
    <div
      class="max-w-6xl mx-auto flex justify-between items-center py-3 px-4 md:px-0"
    >
      <div class="flex items-center space-x-3">
        {#if $user?.picture}
          <img
            src={$user.picture}
            alt={$user.name || "User"}
            class="w-10 h-10 rounded-full border-2 border-rose-pine-highlight-med"
          />
        {/if}
        <div>
          <p class="text-rose-pine-text font-medium">
            Welcome, {$user?.name || $user?.email || "User"}!
          </p>
          <p class="text-rose-pine-muted text-sm">
            Ready to explore the galaxy?
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-2 md:space-x-3">
        <slot name="actions"></slot>
        <button
          on:click={logout}
          class="px-3 md:px-4 py-2 text-sm bg-rose-pine-surface text-rose-pine-subtle hover:text-rose-pine-text hover:border-rose-pine-iris border border-rose-pine-overlay rounded-lg transition-colors duration-200"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
{:else}
  <div
    class="flex flex-col items-center justify-center min-h-screen text-center px-6 py-8"
  >
    <header class="mb-10 md:mb-12">
      <h1
        class="text-6xl md:text-7xl font-bold bg-gradient-to-r from-rose-pine-love via-rose-pine-iris to-rose-pine-foam bg-clip-text text-transparent galactic-title-animation"
      >
        Galactic Parallax
      </h1>
      <p class="text-rose-pine-subtle text-lg md:text-xl mt-3 md:mt-4">
        Discover intergalactic-quality wallpapers
      </p>
    </header>
    <div
      class="bg-rose-pine-surface border border-rose-pine-overlay rounded-xl p-8 w-full max-w-md shadow-xl"
    >
      <h2 class="text-2xl font-semibold mb-4 text-rose-pine-text">
        Welcome Back
      </h2>
      <p class="text-rose-pine-muted mb-6">
        Sign in to access your personalized wallpaper search experience.
      </p>
      <button
        on:click={login}
        class="w-full px-6 py-3 bg-rose-pine-iris text-rose-pine-base font-semibold rounded-lg hover:bg-rose-pine-iris/90 focus:outline-none focus:ring-2 focus:ring-rose-pine-iris/50 transition-all duration-200 text-lg"
      >
        Sign In with Auth0
      </button>
    </div>
    <p class="text-rose-pine-muted text-sm mt-8">
      Secure authentication powered by Auth0
    </p>
  </div>
{/if}

<style>
  .galactic-title-animation {
    background-size: 200% 200%;
    animation: gp-gradient-animation 3s ease infinite;
  }

  @keyframes gp-gradient-animation {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
