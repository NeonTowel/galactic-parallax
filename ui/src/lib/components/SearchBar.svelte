<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { apiService } from "$lib/api";

  export let searchQuery: string = "";
  export let orientation: "landscape" | "portrait" = "landscape";

  const dispatch = createEventDispatcher<{
    queryChange: { query: string };
    search: { query: string; orientation: "landscape" | "portrait" };
    orientationChange: { orientation: "landscape" | "portrait" };
  }>();

  let suggestions: string[] = [];
  let isFetchingSuggestions = false;
  let suggestionsError: string | null = null;
  let showSuggestions = false;
  let suggestionTimeoutId: number | undefined = undefined;
  const DEBOUNCE_DELAY = 300; // milliseconds

  async function fetchSuggestions() {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }

    isFetchingSuggestions = true;
    suggestionsError = null;

    try {
      const response = await apiService.getSearchSuggestions(searchQuery);
      if (response.success && response.data) {
        suggestions = response.data;
        showSuggestions = suggestions.length > 0;
      } else {
        suggestionsError = response.error || "Failed to fetch suggestions.";
        suggestions = [];
        showSuggestions = false;
      }
    } catch (error) {
      console.error("Suggestions fetch error:", error);
      suggestionsError =
        error instanceof Error ? error.message : "Error fetching suggestions.";
      suggestions = [];
      showSuggestions = false;
    } finally {
      isFetchingSuggestions = false;
    }
  }

  function debouncedFetchSuggestions(): void {
    clearTimeout(suggestionTimeoutId);
    dispatch("queryChange", { query: searchQuery });
    if (searchQuery.length >= 2) {
      suggestionTimeoutId = window.setTimeout(fetchSuggestions, DEBOUNCE_DELAY);
    } else {
      suggestions = [];
      showSuggestions = false;
    }
  }

  function handleSuggestionClick(suggestion: string) {
    searchQuery = suggestion;
    showSuggestions = false;
    dispatch("search", { query: searchQuery, orientation });
  }

  function handleSearchSubmit() {
    showSuggestions = false;
    dispatch("search", { query: searchQuery, orientation });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent form submission if inside a form
      handleSearchSubmit();
    }
    if (event.key === "Escape") {
      showSuggestions = false;
    }
  }

  function handleOrientationChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    orientation = target.value as "landscape" | "portrait";
    dispatch("orientationChange", { orientation });
    // Optionally trigger search immediately on orientation change if there's a query
    if (searchQuery.trim()) {
      dispatch("search", { query: searchQuery, orientation });
    }
  }

  // Hide suggestions if user clicks outside
  let searchInputContainer: HTMLElement;
  function handleClickOutside(event: MouseEvent) {
    if (
      showSuggestions &&
      searchInputContainer &&
      !searchInputContainer.contains(event.target as Node)
    ) {
      showSuggestions = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
    clearTimeout(suggestionTimeoutId);
  });
</script>

<div
  class="search-input-container relative mb-4"
  bind:this={searchInputContainer}
>
  <div class="flex flex-col sm:flex-row items-stretch gap-3">
    <input
      type="text"
      bind:value={searchQuery}
      on:input={debouncedFetchSuggestions}
      on:keydown={handleKeydown}
      on:focus={() => {
        if (suggestions.length > 0 && searchQuery.length >= 2)
          showSuggestions = true;
      }}
      placeholder="Search for images... (e.g., 'nebula')"
      class="flex-grow px-5 py-3 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg focus:ring-2 focus:ring-rose-pine-iris focus:border-rose-pine-iris outline-none transition-shadow text-lg shadow-md"
    />
    <select
      bind:value={orientation}
      on:change={handleOrientationChange}
      class="px-5 py-3 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg focus:ring-2 focus:ring-rose-pine-iris focus:border-rose-pine-iris outline-none transition-shadow text-lg shadow-md appearance-none"
    >
      <option value="landscape">Landscape</option>
      <option value="portrait">Portrait</option>
    </select>
    <button
      on:click={handleSearchSubmit}
      class="px-6 py-3 bg-rose-pine-iris text-rose-pine-base font-semibold rounded-lg hover:bg-rose-pine-iris/90 transition-colors duration-200 shadow-md text-lg"
    >
      Search
    </button>
  </div>

  {#if showSuggestions && suggestions.length > 0}
    <ul
      class="absolute z-10 w-full mt-1 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg shadow-xl max-h-60 overflow-y-auto"
    >
      {#each suggestions as suggestion (suggestion)}
        <li
          class="px-4 py-2 hover:bg-rose-pine-highlight-med cursor-pointer transition-colors duration-150"
          on:click={() => handleSuggestionClick(suggestion)}
          on:mousedown|preventDefault
        >
          {suggestion}
        </li>
      {/each}
    </ul>
  {/if}
  {#if isFetchingSuggestions}
    <p class="text-sm text-rose-pine-muted mt-1">Fetching suggestions...</p>
  {/if}
  {#if suggestionsError}
    <p class="text-sm text-rose-pine-love mt-1">{suggestionsError}</p>
  {/if}
</div>
