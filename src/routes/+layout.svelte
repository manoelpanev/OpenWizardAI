<script lang="ts">
  import "../lib/theme";
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(:root) {
    --owai-bg: #f6f6f6;
    --owai-fg: #0f0f0f;
    --owai-border: #d8d8d8;
    --owai-muted: #6b6b6b;
    --owai-accent: #396cd8;
    --owai-danger: #c0392b;

    color-scheme: light;
  }

  :global([data-theme="dark"]) {
    --owai-bg: #1f1f1f;
    --owai-fg: #f2f2f2;
    --owai-border: #3a3a3a;
    --owai-muted: #a0a0a0;
    --owai-accent: #6ea8ff;
    --owai-danger: #e57373;

    color-scheme: dark;
  }

  :global(body) {
    margin: 0;
    background: var(--owai-bg);
    color: var(--owai-fg);
    font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  }

  :global(button) {
    font-family: inherit;
  }

  :global(input[type="text"]) {
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem;
    background: var(--owai-bg);
    color: var(--owai-fg);
    font-family: inherit;
  }

  :global(button:not(.theme-toggle)) {
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    background: var(--owai-accent);
    color: white;
    cursor: pointer;
  }

  :global(button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
