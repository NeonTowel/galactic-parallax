<script lang="ts">
  import {
    isLoading,
    isAuthenticated,
    user,
    authError,
    login,
    logout,
  } from "$lib/auth.js";

  let searchQuery = "";
  let isSearching = false;

  async function handleSearch() {
    if (!searchQuery.trim()) return;

    isSearching = true;
    // TODO: Implement API call to your external REST backend
    console.log("Searching for:", searchQuery);

    // Simulate API call for now
    setTimeout(() => {
      isSearching = false;
    }, 1000);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }
</script>

<main
  class="min-h-screen bg-rose-pine-base text-rose-pine-text flex flex-col items-center justify-center px-6"
>
  {#if $isLoading}
    <!-- Loading State -->
    <div class="flex flex-col items-center space-y-4">
      <div
        class="animate-spin rounded-full h-12 w-12 border-4 border-rose-pine-iris border-t-transparent"
      ></div>
      <p class="text-rose-pine-muted">Initializing authentication...</p>
    </div>
  {:else if $authError}
    <!-- Error State -->
    <div class="flex flex-col items-center space-y-6 max-w-md text-center">
      <h1 class="text-4xl font-bold text-rose-pine-love">
        Authentication Error
      </h1>
      <p
        class="text-rose-pine-text bg-rose-pine-surface px-4 py-3 rounded-lg border border-rose-pine-overlay"
      >
        {$authError}
      </p>
      <button
        on:click={() => window.location.reload()}
        class="px-6 py-3 bg-rose-pine-iris text-rose-pine-base font-semibold rounded-lg
               hover:bg-rose-pine-iris/90 transition-colors duration-200"
      >
        Try Again
      </button>
    </div>
  {:else if !$isAuthenticated}
    <!-- Login State -->
    <div class="flex flex-col items-center space-y-8 max-w-md text-center">
      <!-- Header -->
      <header>
        <h1
          class="text-6xl md:text-7xl font-bold bg-gradient-to-r from-rose-pine-love via-rose-pine-iris to-rose-pine-foam bg-clip-text text-transparent mb-4"
        >
          Galactic Parallax
        </h1>
        <p class="text-rose-pine-subtle text-lg">
          Discover intergalactic-quality wallpapers
        </p>
      </header>

      <!-- Login Section -->
      <div
        class="bg-rose-pine-surface border border-rose-pine-overlay rounded-xl p-8 w-full"
      >
        <h2 class="text-2xl font-semibold mb-4 text-rose-pine-text">
          Welcome Back
        </h2>
        <p class="text-rose-pine-muted mb-6">
          Sign in to access your personalized wallpaper search experience
        </p>

        <button
          on:click={login}
          class="w-full px-6 py-4 bg-rose-pine-iris text-rose-pine-base font-semibold rounded-lg
                 hover:bg-rose-pine-iris/90 focus:outline-none focus:ring-2 focus:ring-rose-pine-iris/20
                 transition-all duration-200 text-lg"
        >
          Sign In with Auth0
        </button>
      </div>

      <!-- Footer -->
      <p class="text-rose-pine-muted text-sm">
        Secure authentication powered by Auth0
      </p>
    </div>
  {:else}
    <!-- Authenticated - Show Search UI -->
    <div class="w-full max-w-4xl">
      <!-- User Info & Logout -->
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center space-x-3">
          {#if $user?.picture}
            <img
              src={$user.picture}
              alt={$user.name || "User"}
              class="w-10 h-10 rounded-full border-2 border-rose-pine-overlay"
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

        <button
          on:click={logout}
          class="px-4 py-2 text-rose-pine-muted hover:text-rose-pine-text
                 border border-rose-pine-overlay hover:border-rose-pine-subtle
                 rounded-lg transition-colors duration-200"
        >
          Sign Out
        </button>
      </div>

      <!-- Header -->
      <header class="mb-8 text-center">
        <h1
          class="text-6xl md:text-7xl font-bold bg-gradient-to-r from-rose-pine-love via-rose-pine-iris to-rose-pine-foam bg-clip-text text-transparent"
        >
          Galactic Parallax
        </h1>
      </header>

      <!-- Search Input -->
      <div class="w-full max-w-2xl mx-auto relative">
        <input
          type="text"
          bind:value={searchQuery}
          on:keydown={handleKeydown}
          placeholder="Type in your search..."
          disabled={isSearching}
          class="w-full px-6 py-4 text-xl bg-rose-pine-surface border-2 border-rose-pine-overlay rounded-xl
                 focus:border-rose-pine-iris focus:outline-none focus:ring-2 focus:ring-rose-pine-iris/20
                 placeholder:text-rose-pine-muted text-rose-pine-text
                 transition-all duration-200 ease-in-out
                 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <!-- Loading indicator -->
        {#if isSearching}
          <div class="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div
              class="animate-spin rounded-full h-6 w-6 border-2 border-rose-pine-iris border-t-transparent"
            ></div>
          </div>
        {/if}
      </div>

      <!-- Subtle hint text -->
      <p class="mt-4 text-rose-pine-muted text-sm text-center">
        Press Enter to search for wallpapers
      </p>
    </div>
  {/if}
</main>

<style>
  /* Custom gradient animation for the title */
  h1 {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }

  @keyframes gradient {
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
