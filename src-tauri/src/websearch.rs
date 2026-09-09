use serde::{Deserialize, Serialize};

/// Web-Recherche über Tavily, damit die Rückfragen-Generierung nicht nur
/// den Nutzertext auswertet (CONCEPT.md, "Noch offen": Web-Recherche in
/// die Rückfragen-Analyse). Vollständig optional — ohne aktivierten
/// Schalter und ohne Key läuft der Onboarding-Flow unverändert.
const TAVILY_SEARCH_URL: &str = "https://api.tavily.com/search";

/// Wie viele Treffer maximal in den Prompt übernommen werden. Bewusst
/// klein: die Ergebnisse sind Zusatzkontext, kein Hauptinhalt, und jeder
/// Treffer kostet Prompt-Tokens.
const MAX_RESULTS: u8 = 5;

#[derive(Debug, Serialize)]
struct SearchRequest<'a> {
    query: &'a str,
    max_results: u8,
    /// Tavilys eigene Kurz-Zusammenfassung der Treffer — spart uns einen
    /// zusätzlichen LLM-Aufruf zum Verdichten.
    include_answer: bool,
    search_depth: &'a str,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    #[serde(default)]
    answer: Option<String>,
    #[serde(default)]
    results: Vec<SearchResult>,
}

#[derive(Debug, Deserialize)]
struct SearchResult {
    #[serde(default)]
    title: String,
    #[serde(default)]
    content: String,
}

/// Führt eine Suche aus und gibt einen kompakten, prompt-fertigen
/// Textblock zurück. Fehler werden als `Err` gemeldet; die Aufrufer im
/// Onboarding-Flow behandeln Websuche als Komfort-Feature und laufen bei
/// Fehlschlag ohne sie weiter, statt den Flow zu blockieren.
pub async fn search(api_key: &str, query: &str) -> Result<String, String> {
    // Ohne User-Agent lehnen manche APIs Anfragen ab; `reqwest` schickt
    // von sich aus keinen.
    let client = reqwest::Client::builder()
        .user_agent(concat!("OpenWizardAI/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("HTTP-Client konnte nicht erstellt werden: {e}"))?;

    let response = client
        .post(TAVILY_SEARCH_URL)
        .bearer_auth(api_key)
        .json(&SearchRequest {
            query,
            max_results: MAX_RESULTS,
            include_answer: true,
            search_depth: "basic",
        })
        .send()
        .await
        .map_err(|e| format!("Tavily-Anfrage fehlgeschlagen: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Tavily-API-Fehler ({status}): {body}"));
    }

    let parsed: SearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Tavily-Antwort konnte nicht gelesen werden: {e}"))?;

    let mut block = String::new();

    if let Some(answer) = parsed.answer.as_deref().map(str::trim) {
        if !answer.is_empty() {
            block.push_str(&format!("Zusammenfassung: {answer}\n"));
        }
    }

    for result in parsed.results.iter().take(MAX_RESULTS as usize) {
        let title = result.title.trim();
        // Einzelne Treffer-Texte können sehr lang sein — hart kürzen,
        // damit die Websuche das Prompt-Budget nicht dominiert.
        let content: String = result.content.trim().chars().take(300).collect();
        if !title.is_empty() || !content.is_empty() {
            block.push_str(&format!("- {title}: {content}\n"));
        }
    }

    if block.trim().is_empty() {
        Err("Tavily lieferte keine verwertbaren Treffer.".to_string())
    } else {
        Ok(block)
    }
}

/// Prüft einen Tavily-Key mit einer minimalen Suchanfrage, analog zu
/// `deepseek::client::verify_key` — verhindert, dass ein kaputter Key
/// unbemerkt im Keychain landet.
pub async fn verify_key(api_key: &str) -> Result<(), String> {
    search(api_key, "OpenWizardAI connectivity check")
        .await
        .map(|_| ())
}
