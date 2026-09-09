use crate::deepseek::key_store;
use crate::registry::{self, CustomApiEntry, HealthReport};
use std::path::PathBuf;
use tauri::Manager;

/// Vom Frontend gesendete Felder für einen neuen/geänderten Eintrag. Der
/// API-Key kommt getrennt vom Rest, weil er im Keychain landet und nie in
/// `custom-apis.json` geschrieben wird.
#[derive(Debug, serde::Deserialize)]
pub struct SaveCustomApiRequest {
    pub entry: CustomApiEntry,
    /// Neuer Key. `None` heißt: bestehenden Key im Keychain unverändert
    /// lassen (z.B. beim Umbenennen eines Eintrags).
    pub api_key: Option<String>,
}

fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("Konfigurationsordner nicht verfügbar: {e}"))
}

#[tauri::command]
pub fn list_custom_apis(app: tauri::AppHandle) -> Result<Vec<CustomApiEntry>, String> {
    registry::load_all(&config_dir(&app)?)
}

/// Legt einen Eintrag an bzw. aktualisiert ihn und prüft ihn direkt
/// technisch durch. Der Health-Report wird mitgespeichert, damit das UI
/// den Zustand auch nach einem Neustart noch anzeigen kann.
#[tauri::command]
pub async fn save_custom_api(
    app: tauri::AppHandle,
    request: SaveCustomApiRequest,
) -> Result<CustomApiEntry, String> {
    let dir = config_dir(&app)?;
    let mut entry = request.entry;

    if entry.id.trim().is_empty() {
        return Err("ID darf nicht leer sein.".to_string());
    }
    if entry.name.trim().is_empty() {
        return Err("Name darf nicht leer sein.".to_string());
    }
    if !entry.endpoint_url.starts_with("https://") {
        return Err("Endpoint muss mit https:// beginnen.".to_string());
    }

    let account = key_store::custom_api_account(&entry.id);

    if let Some(key) = request.api_key.as_deref() {
        if key.trim().is_empty() {
            key_store::delete_secret(&account)?;
        } else {
            key_store::save_secret(&account, key)?;
        }
    }

    let stored_key = key_store::load_secret(&account)?;
    entry.health = Some(registry::check_health(&entry, stored_key.as_deref()).await);
    entry.source = "custom-api".to_string();

    let mut entries = registry::load_all(&dir)?;
    match entries.iter().position(|e| e.id == entry.id) {
        Some(index) => entries[index] = entry.clone(),
        None => entries.push(entry.clone()),
    }
    registry::save_all(&dir, &entries)?;

    Ok(entry)
}

/// Prüft einen bereits gespeicherten Eintrag erneut und schreibt das
/// Ergebnis zurück in die Registry.
#[tauri::command]
pub async fn recheck_custom_api(app: tauri::AppHandle, id: String) -> Result<HealthReport, String> {
    let dir = config_dir(&app)?;
    let mut entries = registry::load_all(&dir)?;

    let index = entries
        .iter()
        .position(|e| e.id == id)
        .ok_or_else(|| format!("Kein Eintrag mit ID \"{id}\"."))?;

    let stored_key = key_store::load_secret(&key_store::custom_api_account(&id))?;
    let health = registry::check_health(&entries[index], stored_key.as_deref()).await;

    entries[index].health = Some(health.clone());
    registry::save_all(&dir, &entries)?;

    Ok(health)
}

/// Entfernt Eintrag und zugehörigen Key. Der Key wird mit gelöscht, damit
/// keine verwaisten Secrets im Keychain zurückbleiben.
#[tauri::command]
pub fn delete_custom_api(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let dir = config_dir(&app)?;
    let mut entries = registry::load_all(&dir)?;
    entries.retain(|e| e.id != id);
    registry::save_all(&dir, &entries)?;
    key_store::delete_secret(&key_store::custom_api_account(&id))
}

/// Ob für einen Eintrag ein Key im Keychain liegt — das UI zeigt damit
/// "Key gespeichert" an, ohne den Key selbst zu lesen/anzuzeigen.
#[tauri::command]
pub fn custom_api_has_key(id: String) -> Result<bool, String> {
    key_store::load_secret(&key_store::custom_api_account(&id)).map(|key| key.is_some())
}
