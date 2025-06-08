<script lang="ts">
  import type { SearchResult } from "$lib/types";
  import SearchResultItem from "./SearchResultItem.svelte";
  import LoadingSpinner from "./LoadingSpinner.svelte";
  import ErrorMessage from "./ErrorMessage.svelte";

  export let results: SearchResult[] | null | undefined = null;
  export let isLoading: boolean = false;
  export let error: string | null = null;
  export let searchQuery: string = ""; // To display context for "no results"
</script>

{#if isLoading}
  <div class="flex flex-col items-center justify-center space-y-4 py-10">
    <LoadingSpinner>Searching for images...</LoadingSpinner>
  </div>
{:else if error}
  <ErrorMessage message={error} />
{:else if results && results.length > 0}
  <div
    class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
  >
    {#each results as item (item.id)}
      <SearchResultItem {item} />
    {/each}
  </div>
{:else if searchQuery && !isLoading}
  <div class="text-center py-10">
    <p class="text-xl text-rose-pine-muted">
      No results found for "<span class="font-semibold text-rose-pine-text"
        >{searchQuery}</span
      >".
    </p>
    <p class="text-rose-pine-subtle mt-2">
      Try a different search term or check your spelling.
    </p>
  </div>
{/if}
