use crate::deepseek::key_store;
use crate::websearch;

/// Speichert den Tavily-Key im Keychain, nachdem er mit einer minimalen
/// Suchanfrage verifiziert wurde — gleiches Muster wie
/// `connect_deepseek`, damit kein kaputter Key unbemerkt gespeichert wird.
#[tauri::command]
pub async fn connect_tavily(api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("Tavily-API-Key darf nicht leer sein.".to_string());
    }

    websearch::verify_key(&api_key).await?;
    key_store::save_tavily_key(&api_key)
}

#[tauri::command]
pub fn tavily_connection_status() -> Result<bool, String> {
    key_store::load_tavily_key().map(|key| key.is_some())
}

#[tauri::command]
pub fn disconnect_tavily() -> Result<(), String> {
    key_store::delete_tavily_key()
}

/// Führt eine Recherche für die Rückfragen-Analyse aus. Wird nur
/// aufgerufen, wenn der Nutzer die Websuche aktiviert hat; ohne
/// gespeicherten Key kommt ein klarer Fehler zurück, den das Frontend als
/// Hinweis behandelt statt als Blocker.
#[tauri::command]
pub async fn research_topic(query: String) -> Result<String, String> {
    if query.trim().is_empty() {
        return Err("Suchanfrage darf nicht leer sein.".to_string());
    }

    let api_key = key_store::load_tavily_key()?
        .ok_or_else(|| "Kein Tavily-API-Key verbunden.".to_string())?;

    websearch::search(&api_key, &query).await
}
