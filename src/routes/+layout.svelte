<script lang="ts">
  import "../lib/theme";
  let { children } = $props();
</script>

{@render children()}

<style>
  /* Navy + Purple: seriöse "AI-forward SaaS"-Palette (dieselbe Farbfamilie
     wie das Hermes-Wortmarke-Motiv, aber deutlich zurückhaltender als ein
     Gaming-/Konsumenten-Look — kein Gold, kein Neon). Dark-Mode-Fläche
     bewusst #121212-artig statt reinschwarz (Material-Design-Empfehlung
     für sichtbare Elevation-Layer). */
  :global(:root) {
    --owai-bg: #f7f6fb;
    --owai-surface: #ffffff;
    --owai-fg: #17152b;
    --owai-border: #ddd9ec;
    --owai-muted: #6b6580;
    --owai-accent: #6d28d9;
    --owai-accent-strong: #5b21b6;
    --owai-accent-soft: #efe9fc;
    --owai-danger: #c0392b;
    --owai-success: #1f9d6d;

    color-scheme: light;
  }

  :global([data-theme="dark"]) {
    --owai-bg: #121118;
    --owai-surface: #1a1826;
    --owai-fg: #f1eefb;
    --owai-border: #322d47;
    --owai-muted: #a49cc4;
    --owai-accent: #9061f9;
    --owai-accent-strong: #a78bfa;
    --owai-accent-soft: #251f3d;
    --owai-danger: #e57373;
    --owai-success: #4ade80;

    color-scheme: dark;
  }

  :global(body) {
    margin: 0;
    background: var(--owai-bg);
    color: var(--owai-fg);
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Avenir,
      Helvetica,
      Arial,
      sans-serif;
  }

  :global(button) {
    font-family: inherit;
  }

  :global(input[type="text"], input[type="password"], textarea, select) {
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    background: var(--owai-surface);
    color: var(--owai-fg);
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.15s ease;
  }

  :global(input[type="text"]:focus, input[type="password"]:focus, textarea:focus, select:focus) {
    outline: none;
    border-color: var(--owai-accent);
    box-shadow: 0 0 0 3px var(--owai-accent-soft);
  }

  :global(button:not(.theme-toggle):not(.ghost-button)) {
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0.6rem 1.1rem;
    background: var(--owai-accent);
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      transform 0.1s ease;
  }

  :global(button:not(.theme-toggle):not(.ghost-button):hover:not(:disabled)) {
    background: var(--owai-accent-strong);
  }

  :global(button:not(.theme-toggle):not(.ghost-button):active:not(:disabled)) {
    transform: translateY(1px);
  }

  :global(button.ghost-button) {
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.6rem 1.1rem;
    background: transparent;
    color: var(--owai-fg);
    font-weight: 500;
    cursor: pointer;
  }

  :global(button.ghost-button:hover:not(:disabled)) {
    border-color: var(--owai-accent);
    color: var(--owai-accent);
  }

  :global(button:disabled) {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
