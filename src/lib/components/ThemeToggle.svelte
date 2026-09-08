<script lang="ts">
  import { theme, toggleTheme } from "../theme";
</script>

<button type="button" class="theme-toggle" onclick={toggleTheme} aria-label="Farbthema wechseln">
  {$theme === "dark" ? "☀️ Hell" : "🌙 Dunkel"}
</button>

<style>
  .theme-toggle {
    background: transparent;
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    font-size: 0.85rem;
  }
</style>
