use serde::{Deserialize, Serialize};

/// DeepSeek-Modellwahl aus CONCEPT.md — Flash ist Default für alle
/// Standard-Aufrufe, Pro nur manuell für Fälle mit mehr nötiger Tiefe.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DeepSeekModel {
    Flash,
    Pro,
}

impl DeepSeekModel {
    fn api_id(self) -> &'static str {
        match self {
            // Modellbezeichner gemäß DeepSeek-API-Dokumentation zum
            // Implementierungszeitpunkt. Falls DeepSeek die Bezeichner
            // ändert, ist dies die einzige Stelle, die angepasst werden
            // muss.
            DeepSeekModel::Flash => "deepseek-chat",
            DeepSeekModel::Pro => "deepseek-reasoner",
        }
    }
}

const API_BASE_URL: &str = "https://api.deepseek.com/v1/chat/completions";

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: &'static str,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: &'static str,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: String,
}

/// Schickt einen einzelnen Prompt an DeepSeek und gibt die reine
/// Text-Antwort zurück. Für strukturierte Antworten (z.B. die
/// Empfehlungs-Engine) instruiert der aufrufende Code das Modell im
/// `system_prompt`, valides JSON zu liefern, und parst es selbst — kein
/// spezielles "JSON mode"-Feature vorausgesetzt, um API-Versionsunterschiede
/// zu vermeiden.
pub async fn complete(
    api_key: &str,
    model: DeepSeekModel,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request = ChatRequest {
        model: model.api_id(),
        messages: vec![
            ChatMessage {
                role: "system",
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user",
                content: user_prompt.to_string(),
            },
        ],
        temperature: 0.3,
    };

    let response = client
        .post(API_BASE_URL)
        .bearer_auth(api_key)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("DeepSeek-Anfrage fehlgeschlagen: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("DeepSeek-API-Fehler ({status}): {body}"));
    }

    let parsed: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("DeepSeek-Antwort konnte nicht gelesen werden: {e}"))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content)
        .ok_or_else(|| "DeepSeek-Antwort enthielt keine choices.".to_string())
}

/// Prüft, ob ein API-Key gültig ist, mit einem minimalen Testaufruf.
pub async fn verify_key(api_key: &str) -> Result<(), String> {
    complete(
        api_key,
        DeepSeekModel::Flash,
        "Antworte ausschließlich mit dem Wort OK.",
        "Ping.",
    )
    .await
    .map(|_| ())
}
