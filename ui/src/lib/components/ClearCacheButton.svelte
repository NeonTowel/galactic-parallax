<script lang="ts">
  import { apiService } from "$lib/api";
  import { onDestroy, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{ cleared: string; error: string }>();

  let isClearingCache = false;
  // Internal state for messages, but not directly rendered here.
  // Could be used to dispatch events with details.
  let internalClearCacheMessage: string | null = null;
  let internalClearCacheError: string | null = null;
  let messageTimeoutId: number | undefined;

  async function handleClearCache() {
    isClearingCache = true;
    internalClearCacheMessage = null;
    internalClearCacheError = null;
    clearTimeout(messageTimeoutId);

    try {
      const response = await apiService.clearUserSearchCache();
      if (response.success) {
        internalClearCacheMessage =
          response.message || "Your search cache has been cleared.";
        dispatch("cleared", internalClearCacheMessage);
      } else {
        internalClearCacheError = response.error || "Failed to clear cache.";
        dispatch("error", internalClearCacheError);
      }
    } catch (error) {
      console.error("Clear cache error:", error);
      internalClearCacheError =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";
      dispatch("error", internalClearCacheError);
    } finally {
      isClearingCache = false;
      // Parent component can handle displaying messages based on events if needed.
      // A short visual feedback directly on button is not easily done without more props/complexity here.
    }
  }

  onDestroy(() => {
    clearTimeout(messageTimeoutId); // Though not used for rendering here, good practice
  });
</script>

<button
  on:click={handleClearCache}
  disabled={isClearingCache}
  class="px-3 md:px-4 py-2 text-sm bg-rose-pine-surface text-rose-pine-subtle hover:text-rose-pine-text hover:border-rose-pine-iris border border-rose-pine-overlay rounded-lg transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center space-x-1.5"
  title="Clear your search history cache from the server"
>
  {#if isClearingCache}
    <span
      class="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"
    ></span>
    <span>Clearing...</span>
  {:else}
    <span>Clear My Cache</span>
  {/if}
</button>
