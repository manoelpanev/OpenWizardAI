<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { wizardStore } from "../wizardStore";

  let apiKey = $state("");
  let connecting = $state(false);
  let connected = $state(false);
  let error = $state("");
  let checkingStatus = $state(true);

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

  .error {
    color: var(--owai-danger);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
</style>
