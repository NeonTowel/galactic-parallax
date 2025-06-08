<script lang="ts">
  import type { SearchResult } from "$lib/types";

  export let item: SearchResult;

  function formatBytes(bytes: number | undefined, decimals = 2) {
    if (bytes === undefined) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
</script>

<div
  class="bg-rose-pine-surface p-4 rounded-lg shadow-md hover:shadow-rose-pine-iris/30 transition-shadow duration-200 flex flex-col h-full"
>
  <a
    href={item.url}
    target="_blank"
    rel="noopener noreferrer"
    class="block mb-3 aspect-video bg-rose-pine-overlay rounded overflow-hidden group"
  >
    <img
      src={item.thumbnailUrl}
      alt={item.title}
      class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 ease-in-out"
      loading="lazy"
    />
  </a>
  <div class="flex-grow flex flex-col">
    <h3 class="text-sm font-semibold text-rose-pine-text mb-1 leading-tight">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-rose-pine-iris transition-colors"
      >
        {item.title || "Untitled Image"}
      </a>
    </h3>
    <p class="text-xs text-rose-pine-muted mb-2 flex-grow">
      {item.description
        ? item.description.length > 100
          ? item.description.substring(0, 97) + "..."
          : item.description
        : "No description available."}
    </p>
    <div class="text-xs text-rose-pine-subtle mt-auto space-y-1">
      <p>
        <strong>Source:</strong>
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-rose-pine-iris transition-colors"
        >
          {item.sourceDomain || "N/A"}
        </a>
      </p>
      <p><strong>Dimensions:</strong> {item.width}x{item.height}</p>
      {#if item.fileSize}
        <p><strong>Size:</strong> {formatBytes(item.fileSize)}</p>
      {/if}
      {#if item.source_engine}
        <p class="capitalize"><strong>Engine:</strong> {item.source_engine}</p>
      {/if}
    </div>
  </div>
</div>
