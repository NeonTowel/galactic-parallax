<script lang="ts">
  export let message: string | null = null;
</script>

{#if message}
  <div
    class="bg-rose-pine-love/20 border border-rose-pine-love text-rose-pine-love px-4 py-3 rounded-lg text-center"
  >
    <p>{message}</p>
  </div>
{/if}
