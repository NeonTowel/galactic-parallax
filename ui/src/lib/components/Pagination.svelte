<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let currentPage: number;
  export let totalPages: number;
  export let hasNextPage: boolean;
  export let hasPreviousPage: boolean;

  const dispatch = createEventDispatcher();

  const maxVisibleButtons = 5;

  $: paginationNumbers = (() => {
    const numbers = [];
    if (totalPages <= 1) return [];

    let start = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let end = Math.min(totalPages, start + maxVisibleButtons - 1);

    if (end - start + 1 < maxVisibleButtons) {
      start = Math.max(1, end - maxVisibleButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      numbers.push(i);
    }
    return numbers;
  })();

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      dispatch("pageChange", { page });
    }
  }
</script>

{#if totalPages > 1}
  <nav
    class="flex justify-center items-center space-x-2 my-8"
    aria-label="Pagination"
  >
    <button
      on:click={() => goToPage(currentPage - 1)}
      disabled={!hasPreviousPage}
      class="px-4 py-2 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg hover:bg-rose-pine-highlight-low disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Previous
    </button>

    {#if paginationNumbers[0] > 1}
      <button
        on:click={() => goToPage(1)}
        class="px-4 py-2 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg hover:bg-rose-pine-highlight-low transition-colors"
        >1</button
      >
      {#if paginationNumbers[0] > 2}
        <span class="px-4 py-2 text-rose-pine-muted">...</span>
      {/if}
    {/if}

    {#each paginationNumbers as pageNum (pageNum)}
      <button
        on:click={() => goToPage(pageNum)}
        class="px-4 py-2 rounded-lg border transition-colors
               {currentPage === pageNum
          ? 'bg-rose-pine-iris text-rose-pine-base border-rose-pine-iris font-semibold'
          : 'bg-rose-pine-surface border-rose-pine-overlay hover:bg-rose-pine-highlight-low'}"
        aria-current={currentPage === pageNum ? "page" : undefined}
      >
        {pageNum}
      </button>
    {/each}

    {#if paginationNumbers[paginationNumbers.length - 1] < totalPages}
      {#if paginationNumbers[paginationNumbers.length - 1] < totalPages - 1}
        <span class="px-4 py-2 text-rose-pine-muted">...</span>
      {/if}
      <button
        on:click={() => goToPage(totalPages)}
        class="px-4 py-2 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg hover:bg-rose-pine-highlight-low transition-colors"
      >
        {totalPages}
      </button>
    {/if}

    <button
      on:click={() => goToPage(currentPage + 1)}
      disabled={!hasNextPage}
      class="px-4 py-2 bg-rose-pine-surface border border-rose-pine-overlay rounded-lg hover:bg-rose-pine-highlight-low disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Next
    </button>
  </nav>
{/if}
