<script lang="ts">
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
  <!-- Header -->
  <header class="mb-8">
    <h1
      class="text-6xl md:text-7xl font-bold text-center bg-gradient-to-r from-rose-pine-love via-rose-pine-iris to-rose-pine-foam bg-clip-text text-transparent"
    >
      Galactic Parallax
    </h1>
  </header>

  <!-- Search Input -->
  <div class="w-full max-w-2xl relative">
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
  <p class="mt-4 text-rose-pine-muted text-sm">
    Press Enter to search for wallpapers
  </p>
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
