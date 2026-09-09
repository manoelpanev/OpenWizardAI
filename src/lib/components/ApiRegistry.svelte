<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import type { CustomApiEntry } from "../types";

  let entries = $state<CustomApiEntry[]>([]);
  let loading = $state(true);
  let error = $state("");
  let busyId = $state("");

  // Formular für einen neuen bzw. bearbeiteten Eintrag.
  let editingId = $state("");
  let name = $state("");
  let description = $state("");
  let endpointUrl = $state("");
  let authMethod = $state("bearer");
  let authHeader = $state("");
  let tags = $state("");
  let apiKey = $state("");
  let saving = $state(false);

  onMount(load);

  async function load() {
    loading = true;
    try {
      entries = await invoke<CustomApiEntry[]>("list_custom_apis");
    } catch (e) {
      error = `Registry konnte nicht geladen werden: ${e}`;
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    editingId = "";
    name = "";
    description = "";
    endpointUrl = "";
    authMethod = "bearer";
    authHeader = "";
    tags = "";
    apiKey = "";
  }

  function editEntry(entry: CustomApiEntry) {
    editingId = entry.id;
    name = entry.name;
    description = entry.description;
    endpointUrl = entry.endpoint_url;
    authMethod = entry.auth_method;
    authHeader = entry.auth_header ?? "";
    tags = entry.tags.join(", ");
    // Key wird nie zurückgelesen — leer lassen heißt "unverändert".
    apiKey = "";
  }

  // Aus dem Namen abgeleitete, stabile ID für neue Einträge.
  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function save() {
    saving = true;
    error = "";

    const entry: CustomApiEntry = {
      id: editingId || slugify(name),
      name: name.trim(),
      description: description.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      source: "custom-api",
      target_tools: [],
      endpoint_url: endpointUrl.trim(),
      auth_method: authMethod,
      auth_header: authMethod === "header" ? authHeader.trim() || null : null,
      version: "1",
      last_updated: new Date().toISOString(),
      health: null,
    };

    try {
      await invoke<CustomApiEntry>("save_custom_api", {
        request: { entry, api_key: apiKey.trim().length > 0 ? apiKey : null },
      });
      resetForm();
      await load();
    } catch (e) {
      error = `Speichern fehlgeschlagen: ${e}`;
    } finally {
      saving = false;
    }
  }

  async function recheck(id: string) {
    busyId = id;
    error = "";
    try {
      await invoke("recheck_custom_api", { id });
      await load();
    } catch (e) {
      error = `Prüfung fehlgeschlagen: ${e}`;
    } finally {
      busyId = "";
    }
  }

  async function remove(id: string) {
    busyId = id;
    error = "";
    try {
      await invoke("delete_custom_api", { id });
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      error = `Löschen fehlgeschlagen: ${e}`;
    } finally {
      busyId = "";
    }
  }

  const canSave = $derived(name.trim().length > 0 && endpointUrl.trim().startsWith("https://"));
</script>

<section>
  <h2>Eigene APIs</h2>

  <p class="hint">
    Selbst eingetragene API-Zugänge werden wie Plugins behandelt (<code>source: custom-api</code>). Keys liegen im
    OS-Keychain, nie in einer Datei. Vor der Aktivierung läuft ein rein technischer Check: HTTPS, Erreichbarkeit,
    JSON-Gültigkeit, Timeout, Rate-Limit-Header — der Inhalt der API wird nicht bewertet.
  </p>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <fieldset>
    <legend>{editingId ? `Eintrag "${editingId}" bearbeiten` : "Neue API hinzufügen"}</legend>

    <label>
      Name
      <input type="text" bind:value={name} placeholder="z.B. Higgsfield" />
    </label>

    <label>
      Beschreibung
      <input type="text" bind:value={description} placeholder="Wofür ist diese API da?" />
    </label>

    <label>
      Endpoint (HTTPS)
      <input type="text" bind:value={endpointUrl} placeholder="https://api.example.com/v1/status" />
    </label>

    <label>
      Authentifizierung
      <select bind:value={authMethod}>
        <option value="bearer">Bearer-Token (Authorization-Header)</option>
        <option value="header">Eigener Header</option>
        <option value="none">Keine</option>
      </select>
    </label>

    {#if authMethod === "header"}
      <label>
        Header-Name
        <input type="text" bind:value={authHeader} placeholder="X-API-Key" />
      </label>
    {/if}

    {#if authMethod !== "none"}
      <label>
        API-Key {editingId ? "(leer = unverändert)" : ""}
        <input type="password" bind:value={apiKey} autocomplete="off" placeholder="wird im Keychain gespeichert" />
      </label>
    {/if}

    <label>
      Tags (Komma-getrennt)
      <input type="text" bind:value={tags} placeholder="bilder, video" />
    </label>

    <div class="actions">
      {#if editingId}
        <button type="button" onclick={resetForm} disabled={saving}>Abbrechen</button>
      {/if}
      <button type="button" disabled={!canSave || saving} onclick={save}>
        {saving ? "Prüfe und speichere…" : "Speichern und prüfen"}
      </button>
    </div>
  </fieldset>

  {#if loading}
    <p>Lade Einträge…</p>
  {:else if entries.length === 0}
    <p class="hint">Noch keine eigenen APIs eingetragen.</p>
  {:else}
    <ul class="entries">
      {#each entries as entry (entry.id)}
        <li>
          <div class="entry-head">
            <strong>{entry.name}</strong>
            {#if entry.health}
              <span class="badge" class:ok={entry.health.reachable} class:bad={!entry.health.reachable}>
                {entry.health.reachable ? "erreichbar" : "nicht nutzbar"}
              </span>
            {:else}
              <span class="badge">ungeprüft</span>
            {/if}
          </div>

          <p class="entry-endpoint">{entry.endpoint_url}</p>

          {#if entry.description}
            <p class="entry-description">{entry.description}</p>
          {/if}

          {#if entry.health}
            <p class="hint">
              {entry.health.message}
              {#if entry.health.status_code}
                · HTTP {entry.health.status_code}
              {/if}
              · {entry.health.duration_ms} ms
              {#if entry.health.rate_limit_hint}
                · {entry.health.rate_limit_hint}
              {/if}
            </p>
          {/if}

          <div class="actions">
            <button type="button" onclick={() => editEntry(entry)} disabled={busyId === entry.id}>Bearbeiten</button>
            <button type="button" onclick={() => recheck(entry.id)} disabled={busyId === entry.id}>
              {busyId === entry.id ? "Prüfe…" : "Erneut prüfen"}
            </button>
            <button type="button" onclick={() => remove(entry.id)} disabled={busyId === entry.id}>Löschen</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 34rem;
  }

  h2 {
    margin: 0;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-weight: 500;
  }

  input,
  select {
    font-family: inherit;
    font-size: 1rem;
    border: 1px solid var(--owai-border);
    border-radius: 6px;
    padding: 0.5rem;
    background: var(--owai-bg);
    color: var(--owai-fg);
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 1rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .entries li {
    border: 1px solid var(--owai-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .entry-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .entry-endpoint {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--owai-muted);
    margin: 0;
    overflow-wrap: anywhere;
  }

  .entry-description {
    margin: 0;
    font-size: 0.9rem;
  }

  .badge {
    font-size: 0.75rem;
    border: 1px solid var(--owai-border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    color: var(--owai-muted);
  }

  .badge.ok {
    border-color: var(--owai-accent);
    color: var(--owai-accent);
  }

  .badge.bad {
    border-color: var(--owai-danger);
    color: var(--owai-danger);
  }

  .hint {
    color: var(--owai-muted);
    font-size: 0.85rem;
    margin: 0;
  }

  .error {
    color: var(--owai-danger);
  }

  code {
    font-size: 0.85em;
  }
</style>
