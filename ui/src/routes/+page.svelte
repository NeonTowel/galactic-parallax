<script lang="ts">
  import {
    isLoading,
    isAuthenticated,
    user,
    authError,
    login,
    logout,
  } from "$lib/auth.js";
  import { apiService } from "$lib/api.js";
  import type { SearchResponse, SearchResult } from "$lib/types.js";

  let searchQuery = "";
  let isSearching = false;
  let searchResults: SearchResponse | null = null;
  let searchError: string | null = null;
  let orientation: "landscape" | "portrait" = "landscape";
  let currentPage = 1;
  const resultsPerPage = 10;

  // Calculate pagination from intermediary schema
  $: pagination = searchResults?.data?.pagination;
  $: totalResults = pagination?.totalResults || 0;
  $: totalPages = pagination?.totalPages || 0;
  $: hasNextPage = pagination?.hasNextPage || false;
  $: hasPreviousPage = pagination?.hasPreviousPage || false;
  $: startIndex = (currentPage - 1) * resultsPerPage + 1;

  async function handleSearch(page: number = 1) {
    if (!searchQuery.trim()) return;

    isSearching = true;
    searchError = null;
    currentPage = page;

    try {
      const response = await apiService.searchImages({
        q: searchQuery,
        orientation,
        count: resultsPerPage,
        start: (page - 1) * resultsPerPage + 1,
      });

      searchResults = response;
    } catch (error) {
      console.error("Search error:", error);
      searchError =
        error instanceof Error ? error.message : "An unexpected error occurred";
      searchResults = null;
    } finally {
      isSearching = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSearch(1);
    }
  }

  function handleOrientationChange() {
    if (searchResults) {
      handleSearch(1);
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      handleSearch(page);
    }
  }

  function clearSearch() {
    searchResults = null;
    searchError = null;
    searchQuery = "";
    currentPage = 1;
  }

  // Generate pagination numbers
  $: paginationNumbers = (() => {
    const numbers = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      numbers.push(i);
    }

    return numbers;
  })();
</script>

<main class="min-h-screen bg-rose-pine-base text-rose-pine-text">
  {#if $isLoading}
    <!-- Loading State -->
    <div
      class="flex flex-col items-center justify-center min-h-screen space-y-4"
    >
      <div
        class="animate-spin rounded-full h-12 w-12 border-4 border-rose-pine-iris border-t-transparent"
      ></div>
      <p class="text-rose-pine-muted">Initializing authentication...</p>
    </div>
  {:else if $authError}
    <!-- Error State -->
    <div
      class="flex flex-col items-center justify-center min-h-screen space-y-6 max-w-md mx-auto text-center px-6"
    >
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
    <div
      class="flex flex-col items-center justify-center min-h-screen space-y-8 max-w-md mx-auto text-center px-6"
    >
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
    <div class="w-full">
      <!-- Header Section - Fixed at top when results are shown -->
      <div
        class="{searchResults
          ? 'sticky top-0 z-10 bg-rose-pine-base border-b border-rose-pine-overlay'
          : 'flex flex-col items-center justify-center min-h-screen'} px-6 py-6"
      >
        <!-- User Info & Logout -->
        <div
          class="flex justify-between items-center mb-6 max-w-6xl mx-auto w-full"
        >
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

          <div class="flex items-center space-x-4">
            {#if searchResults}
              <button
                on:click={clearSearch}
                class="px-4 py-2 text-rose-pine-muted hover:text-rose-pine-text
                       border border-rose-pine-overlay hover:border-rose-pine-subtle
                       rounded-lg transition-colors duration-200"
              >
                New Search
              </button>
            {/if}
            <button
              on:click={logout}
              class="px-4 py-2 text-rose-pine-muted hover:text-rose-pine-text
                     border border-rose-pine-overlay hover:border-rose-pine-subtle
                     rounded-lg transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>

        <!-- Header Title -->
        <header class="mb-6 text-center max-w-6xl mx-auto w-full">
          <h1
            class="{searchResults
              ? 'text-4xl md:text-5xl'
              : 'text-6xl md:text-7xl'} font-bold bg-gradient-to-r from-rose-pine-love via-rose-pine-iris to-rose-pine-foam bg-clip-text text-transparent transition-all duration-300"
          >
            Galactic Parallax
          </h1>
        </header>

        <!-- Search Controls -->
        <div class="w-full max-w-4xl mx-auto space-y-4">
          <!-- Search Input -->
          <div class="relative">
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

          <!-- Search Options -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center space-x-4">
              <label class="text-rose-pine-text font-medium">Orientation:</label
              >
              <select
                bind:value={orientation}
                on:change={handleOrientationChange}
                disabled={isSearching}
                class="px-3 py-2 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg
                       focus:border-rose-pine-iris focus:outline-none focus:ring-1 focus:ring-rose-pine-iris/20
                       text-rose-pine-text disabled:opacity-50"
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>

            <button
              on:click={() => handleSearch(1)}
              disabled={isSearching || !searchQuery.trim()}
              class="px-6 py-2 bg-rose-pine-iris text-rose-pine-base font-semibold rounded-lg
                     hover:bg-rose-pine-iris/90 focus:outline-none focus:ring-2 focus:ring-rose-pine-iris/20
                     transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          <!-- Subtle hint text -->
          {#if !searchResults}
            <p class="text-rose-pine-muted text-sm text-center">
              Press Enter to search for wallpapers
            </p>
          {/if}

          <!-- Error Display -->
          {#if searchError}
            <div class="mt-4">
              <div
                class="bg-rose-pine-love/10 border border-rose-pine-love/20 rounded-lg p-4"
              >
                <div class="flex items-center space-x-3">
                  <div class="text-rose-pine-love">
                    <svg
                      class="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-rose-pine-love font-semibold">
                      Search Error
                    </h3>
                    <p class="text-rose-pine-text">{searchError}</p>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Search Results -->
      {#if searchResults && searchResults.data.results}
        <div class="max-w-6xl mx-auto px-6 py-6">
          <!-- Results Info -->
          <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div class="text-rose-pine-muted">
              <p>
                Found {pagination?.totalResults.toLocaleString()} results in {searchResults.data.searchInfo.searchTime.toFixed(
                  2
                )} seconds
              </p>
              <p class="text-sm">
                Showing {startIndex}-{Math.min(
                  startIndex + resultsPerPage - 1,
                  totalResults
                )} of {pagination?.totalResults.toLocaleString()}
              </p>
            </div>
          </div>

          <!-- Results Grid -->
          <div
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8"
          >
            {#each searchResults.data.results as result (result.id)}
              <div
                class="group relative bg-rose-pine-surface rounded-lg overflow-hidden border border-rose-pine-overlay hover:border-rose-pine-subtle transition-all duration-200"
              >
                <div class="aspect-video relative overflow-hidden">
                  <img
                    src={result.thumbnailUrl}
                    alt={result.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  <div
                    class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200"
                  ></div>
                </div>

                <div class="p-3">
                  <h3
                    class="text-sm font-medium text-rose-pine-text line-clamp-2 mb-1"
                  >
                    {result.title}
                  </h3>
                  <p class="text-xs text-rose-pine-muted line-clamp-1 mb-2">
                    {result.sourceDomain}
                  </p>
                  <div
                    class="flex items-center justify-between text-xs text-rose-pine-muted"
                  >
                    <span>{result.width}×{result.height}</span>
                    <span
                      >{result.fileSize
                        ? (result.fileSize / 1024 / 1024).toFixed(1) + "MB"
                        : "N/A"}</span
                    >
                  </div>
                </div>

                <!-- Hover overlay with actions -->
                <div
                  class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                >
                  <div class="flex space-x-2">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="px-3 py-1 bg-rose-pine-iris text-rose-pine-base text-sm font-medium rounded hover:bg-rose-pine-iris/90 transition-colors"
                    >
                      View Full
                    </a>
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="px-3 py-1 bg-rose-pine-surface text-rose-pine-text text-sm font-medium rounded hover:bg-rose-pine-overlay transition-colors"
                    >
                      Source
                    </a>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <!-- Pagination -->
          {#if totalPages > 1}
            <div class="flex items-center justify-center space-x-2">
              <!-- Previous button -->
              <button
                on:click={() => goToPage(currentPage - 1)}
                disabled={!hasPreviousPage}
                class="px-3 py-2 text-rose-pine-muted hover:text-rose-pine-text border border-rose-pine-overlay hover:border-rose-pine-subtle rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <!-- Page numbers -->
              {#each paginationNumbers as pageNum}
                <button
                  on:click={() => goToPage(pageNum)}
                  class="px-3 py-2 {pageNum === currentPage
                    ? 'bg-rose-pine-iris text-rose-pine-base'
                    : 'text-rose-pine-muted hover:text-rose-pine-text border border-rose-pine-overlay hover:border-rose-pine-subtle'} rounded-lg transition-colors duration-200"
                >
                  {pageNum}
                </button>
              {/each}

              <!-- Next button -->
              <button
                on:click={() => goToPage(currentPage + 1)}
                disabled={!hasNextPage}
                class="px-3 py-2 text-rose-pine-muted hover:text-rose-pine-text border border-rose-pine-overlay hover:border-rose-pine-subtle rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          {/if}
        </div>
      {/if}
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

  /* Line clamp utilities */
  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
