<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { initAuth0 } from "$lib/auth.js";

  let { children } = $props();

  onMount(() => {
    initAuth0();
  });
</script>

{@render children()}
