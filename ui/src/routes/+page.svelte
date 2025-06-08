<script lang="ts">
  import { isAuthenticated } from "$lib/auth";
  import { apiService } from "$lib/api";
  import type {
    SearchResponse,
    SearchResult,
    PaginationInfo,
  } from "$lib/types";

  // Import components
  import AuthSection from "$lib/components/AuthSection.svelte";
  import SearchBarComponent from "$lib/components/SearchBar.svelte";
  import SearchResultsDisplay from "$lib/components/SearchResults.svelte";
  import PaginationControls from "$lib/components/Pagination.svelte";
  import ClearCacheButton from "$lib/components/ClearCacheButton.svelte";

  let searchQueryFromInput = "";
  let currentOrientation: "landscape" | "portrait" = "landscape";

  let isSearchingCurrently = false;
  let searchResponseData: SearchResponse | null = null;
  let searchErrorToDisplay: string | null = null;
  let currentPageNumber = 1;
  const resultsPerPageCount = 10;

  // Reactive derivations for results and pagination
  $: currentSearchResultsList = searchResponseData?.data?.results ?? null;
  $: paginationDetails = searchResponseData?.data?.pagination;

  $: totalResults = paginationDetails?.totalResults ?? 0;
  $: totalPages = paginationDetails?.totalPages ?? 0;
  $: hasNextPage = paginationDetails?.hasNextPage ?? false;
  $: hasPreviousPage = paginationDetails?.hasPreviousPage ?? false;

  // To store feedback from ClearCacheButton events
  let cacheNotification: { type: "success" | "error"; message: string } | null =
    null;
  let cacheNotificationTimeout: number | undefined;

  async function performSearch(
    page: number = 1,
    query: string = searchQueryFromInput,
    orientationSetting: "landscape" | "portrait" = currentOrientation
  ) {
    if (!query.trim()) {
      // Clear results if query is empty, but don't set error
      searchResponseData = null;
      searchErrorToDisplay = null;
      isSearchingCurrently = false;
      return;
    }

    isSearchingCurrently = true;
    searchErrorToDisplay = null;
    currentPageNumber = page;
    searchQueryFromInput = query;
    currentOrientation = orientationSetting;

    try {
      const response = await apiService.searchImages({
        q: query,
        orientation: orientationSetting,
        count: resultsPerPageCount,
        start: (page - 1) * resultsPerPageCount + 1,
      });
      searchResponseData = response;
    } catch (error) {
      console.error("Search error:", error);
      searchErrorToDisplay =
        error instanceof Error ? error.message : "An unexpected error occurred";
      searchResponseData = null;
    } finally {
      isSearchingCurrently = false;
    }
  }

  function handleSearchTriggered(
    event: CustomEvent<{ query: string; orientation: "landscape" | "portrait" }>
  ) {
    performSearch(1, event.detail.query, event.detail.orientation);
  }

  function handleOrientationChanged(
    event: CustomEvent<{ orientation: "landscape" | "portrait" }>
  ) {
    // SearchBar component's current implementation dispatches 'search' event on orientation change if query exists.
    // This ensures currentOrientation state in this parent component is also updated.
    currentOrientation = event.detail.orientation;
    // If the search bar didn't trigger search itself, we would do it here:
    // if (searchQueryFromInput.trim()) {
    //   performSearch(1, searchQueryFromInput, event.detail.orientation);
    // }
  }

  function handleQueryUpdated(event: CustomEvent<{ query: string }>) {
    // This ensures parent's searchQueryFromInput is in sync with SearchBar's internal state
    searchQueryFromInput = event.detail.query;
  }

  function handlePageChanged(event: CustomEvent<{ page: number }>) {
    performSearch(event.detail.page, searchQueryFromInput, currentOrientation);
  }

  function clearSearchAndResults() {
    searchResponseData = null;
    searchErrorToDisplay = null;
    searchQueryFromInput = ""; // This will also clear it in SearchBar due to binding
    currentOrientation = "landscape"; // Reset to default
    currentPageNumber = 1;
  }

  function handleCacheCleared(event: CustomEvent<string>) {
    cacheNotification = { type: "success", message: event.detail };
    clearTimeout(cacheNotificationTimeout);
    cacheNotificationTimeout = window.setTimeout(
      () => (cacheNotification = null),
      4000
    );
    // Optionally clear search results or trigger other actions
    if (searchQueryFromInput) {
      performSearch(1); // Re-run current search to get fresh (non-cached) results if desired
    }
  }

  function handleCacheClearError(event: CustomEvent<string>) {
    cacheNotification = { type: "error", message: event.detail };
    clearTimeout(cacheNotificationTimeout);
    cacheNotificationTimeout = window.setTimeout(
      () => (cacheNotification = null),
      4000
    );
  }
</script>

<div
  class="min-h-screen bg-rose-pine-base text-rose-pine-text flex flex-col items-center"
>
  <AuthSection>
    <!-- Slot content for authenticated header actions -->
    <svelte:fragment slot="actions">
      {#if $isAuthenticated}
        <!-- We still need this check here for the CONTENT of the slot -->
        {#if currentSearchResultsList && currentSearchResultsList.length > 0}
          <!-- Show New Search only when results are present -->
          <button
            on:click={clearSearchAndResults}
            class="px-3 md:px-4 py-2 text-sm md:text-base bg-rose-pine-surface text-rose-pine-subtle hover:text-rose-pine-text hover:border-rose-pine-iris border border-rose-pine-overlay rounded-lg transition-colors duration-200"
          >
            New Search
          </button>
        {/if}
        <ClearCacheButton
          on:cleared={handleCacheCleared}
          on:error={handleCacheClearError}
        />
      {/if}
    </svelte:fragment>
  </AuthSection>

  <!-- Conditional content based on authentication and search state -->
  {#if $isAuthenticated}
    <div
      class="w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8 flex-grow flex flex-col items-center"
    >
      <!-- Centered Header for Authenticated Users (Galactic Parallax title) -->
      <header class="my-8 md:my-12 text-center w-full">
        <h1
          class="text-6xl md:text-7xl font-bold bg-gradient-to-r from-rose-pine-love via-rose-pine-iris to-rose-pine-foam bg-clip-text text-transparent galactic-title-animation"
        >
          Galactic Parallax
        </h1>
      </header>

      <!-- Search Bar and Options -->
      <div class="w-full max-w-4xl mb-6 md:mb-10">
        <SearchBarComponent
          bind:searchQuery={searchQueryFromInput}
          bind:orientation={currentOrientation}
          on:search={handleSearchTriggered}
          on:orientationChange={handleOrientationChanged}
          on:queryChange={handleQueryUpdated}
        />
        {#if !currentSearchResultsList && !isSearchingCurrently && !searchErrorToDisplay && !searchQueryFromInput}
          <p class="text-rose-pine-muted text-sm text-center mt-3">
            Press Enter to search for wallpapers
          </p>
        {/if}
      </div>

      <!-- Cache Notification -->
      {#if cacheNotification}
        <div
          class="w-full max-w-3xl mb-4 p-3 rounded-lg text-sm text-center
                 {cacheNotification.type === 'success'
            ? 'bg-rose-pine-foam/20 text-rose-pine-foam border border-rose-pine-foam/30'
            : 'bg-rose-pine-love/20 text-rose-pine-love border border-rose-pine-love/30'}"
          role="alert"
        >
          {cacheNotification.message}
        </div>
      {/if}

      <!-- Search Results Display Area -->
      {#if searchErrorToDisplay}
        <div class="w-full max-w-4xl">
          <SearchResultsDisplay
            results={null}
            isLoading={false}
            error={searchErrorToDisplay}
            searchQuery={searchQueryFromInput}
          />
        </div>
      {:else if isSearchingCurrently && !currentSearchResultsList}
        <div class="flex-grow flex flex-col items-center justify-center w-full">
          <SearchResultsDisplay
            results={null}
            isLoading={true}
            error={null}
            searchQuery={searchQueryFromInput}
          />
        </div>
      {:else if currentSearchResultsList && currentSearchResultsList.length > 0}
        <div class="w-full">
          <div class="text-rose-pine-muted text-sm mb-4 text-center">
            Found {totalResults.toLocaleString()} results in {searchResponseData?.data?.searchInfo?.searchTime?.toFixed(
              2
            ) ?? "N/A"} seconds. Showing {(currentPageNumber - 1) *
              resultsPerPageCount +
              1}-{Math.min(
              currentPageNumber * resultsPerPageCount,
              totalResults
            )} of {totalResults.toLocaleString()}.
          </div>
          <SearchResultsDisplay
            results={currentSearchResultsList}
            isLoading={isSearchingCurrently &&
              currentSearchResultsList.length > 0}
            error={null}
            searchQuery={searchQueryFromInput}
          />
          {#if totalPages > 1}
            <PaginationControls
              currentPage={currentPageNumber}
              {totalPages}
              {hasNextPage}
              {hasPreviousPage}
              on:pageChange={handlePageChanged}
            />
          {/if}
        </div>
      {:else if searchQueryFromInput && !isSearchingCurrently && (!currentSearchResultsList || currentSearchResultsList.length === 0)}
        <div class="w-full max-w-4xl">
          <SearchResultsDisplay
            results={[]}
            isLoading={false}
            error={null}
            searchQuery={searchQueryFromInput}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
  }
  .galactic-title-animation {
    background-size: 200% 200%;
    animation: gradient-animation 3s ease infinite;
  }

  @keyframes gradient-animation {
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
