<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { wizardStore } from "../wizardStore";
  import { DEEPSEEK_MODELS } from "../types";
  import type { DeepSeekModel } from "../types";

  let apiKey = $state("");
  let connecting = $state(false);
  let connected = $state(false);
  let error = $state("");
  let checkingStatus = $state(true);
  let model = $state<DeepSeekModel>(get(wizardStore).model);

  onMount(async () => {
    try {
      connected = await invoke<boolean>("deepseek_connection_status");
    } catch {
      // Status unbekannt — Nutzer kann trotzdem verbinden oder überspringen.
    } finally {
      checkingStatus = false;
    }
  });

  async function connect() {
    connecting = true;
    error = "";
    try {
      await invoke("connect_deepseek", { apiKey });
      connected = true;
      apiKey = "";
    } catch (e) {
      error = `Verbindung fehlgeschlagen: ${e}`;
    } finally {
      connecting = false;
    }
  }

  function proceedConnected() {
    wizardStore.setDeepSeekConnected(true);
    wizardStore.setModel(model);
    wizardStore.goToStep("agent-question");
  }

  function skip() {
    wizardStore.setDeepSeekConnected(false);
    wizardStore.goToStep("tools");
  }
</script>

<section>
  <h2>0. DeepSeek verbinden (optional)</h2>
  <p>
    Verbinde deinen DeepSeek-API-Key, damit der Wizard dir passende Tools,
    Plugins und Einstellungen vorschlagen kann. Empfohlen, aber nicht
    erforderlich — der Wizard funktioniert auch ohne, dann wählst du alles
    manuell.
  </p>

  {#if checkingStatus}
    <p>Prüfe Verbindungsstatus…</p>
  {:else if connected}
    <p class="status-connected">✓ DeepSeek verbunden</p>

    <div class="options">
      <span class="options-label">Modell</span>
      {#each DEEPSEEK_MODELS as m (m.value)}
        <label class="option" class:active={model === m.value}>
          <input type="radio" name="model" value={m.value} bind:group={model} />
          <span class="option-label">{m.label}</span>
          <span class="option-desc">{m.description}</span>
        </label>
      {/each}
    </div>

    <div class="actions">
      <button type="button" onclick={proceedConnected}>Weiter</button>
    </div>
  {:else}
    <label>
      DeepSeek-API-Key
      <input type="password" bind:value={apiKey} placeholder="sk-..." autocomplete="off" />
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" onclick={skip}>Überspringen</button>
      <button type="button" disabled={connecting || !apiKey.trim()} onclick={connect}>
        {connecting ? "Verbinde…" : "Verbinden"}
      </button>
    </div>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 32rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
  }

  .status-connected {
    color: var(--owai-accent);
    font-weight: 600;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .options-label {
    font-weight: 500;
  }

  .option {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.5rem;
    row-gap: 0.1rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    cursor: pointer;
  }

  .option.active {
    border-color: var(--owai-accent);
  }

  .option-label {
    font-weight: 600;
  }

  .option-desc {
    grid-column: 2;
    font-size: 0.85rem;
    color: var(--owai-muted);
  }

  .error {
    color: var(--owai-danger);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
