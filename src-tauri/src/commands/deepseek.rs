use crate::deepseek::{
    client::{self, DeepSeekModel},
    key_store,
    recommendation::{self, ClarityCheck, OnboardingAnswers, OnboardingRecommendation},
};

/// Speichert den API-Key im OS-Keychain, nachdem er mit einem minimalen
/// Testaufruf verifiziert wurde. Schlägt fehl (kein Speichern), wenn der
/// Key ungültig ist — verhindert, dass ein kaputter Key unbemerkt im
/// Keychain landet.
#[tauri::command]
pub async fn connect_deepseek(api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API-Key darf nicht leer sein.".to_string());
    }

    client::verify_key(&api_key).await?;
    key_store::save_key(&api_key)
}

/// Ob bereits ein Key gespeichert ist — für den Onboarding-Schritt, um zu
/// entscheiden, ob "Verbinden" oder "Verbunden" angezeigt wird.
#[tauri::command]
pub fn deepseek_connection_status() -> Result<bool, String> {
    key_store::load_key().map(|key| key.is_some())
}

#[tauri::command]
pub fn disconnect_deepseek() -> Result<(), String> {
    key_store::delete_key()
}

/// Generiert projektspezifische Vertiefungsfragen basierend auf den festen
/// Basis-Antworten — zweiter Schritt im Onboarding-Flow, vor der
/// eigentlichen Empfehlung.
#[tauri::command]
pub async fn generate_followup_questions(
    answers: OnboardingAnswers,
    model: DeepSeekModel,
) -> Result<Vec<String>, String> {
    let api_key = key_store::load_key()?
        .ok_or_else(|| "Kein DeepSeek-API-Key verbunden.".to_string())?;

    recommendation::generate_followup_questions(&api_key, model, &answers).await
}

/// Prüft eine einzelne Frage-Antwort-Paarung auf Klarheit. Wird vom
/// Frontend nach jeder beantworteten Vertiefungsfrage aufgerufen — bei
/// Unklarheit liefert die Antwort eine gezielte Nachfrage, die vor dem
/// Fortschreiten zur nächsten Frage gestellt wird.
#[tauri::command]
pub async fn check_answer_clarity(
    question: String,
    answer: String,
    model: DeepSeekModel,
) -> Result<ClarityCheck, String> {
    let api_key = key_store::load_key()?
        .ok_or_else(|| "Kein DeepSeek-API-Key verbunden.".to_string())?;

    recommendation::check_answer_clarity(&api_key, model, &question, &answer).await
}

/// Kern-Command des geführten Onboarding-Flows (CONCEPT.md, "Geführter
/// Wizard-Onboarding-Flow"): nimmt die Antworten aus der festen
/// Frage-Sequenz plus die Antworten auf die dynamischen Vertiefungsfragen
/// entgegen und liefert die kombinierte KI-Empfehlung zurück. Schlägt
/// fehl, wenn kein Key verbunden ist — das Frontend zeigt diesen Schritt
/// ohnehin nur an, wenn zuvor `connect_deepseek` erfolgreich war.
#[tauri::command]
pub async fn get_onboarding_recommendation(
    answers: OnboardingAnswers,
    model: DeepSeekModel,
) -> Result<OnboardingRecommendation, String> {
    let api_key = key_store::load_key()?
        .ok_or_else(|| "Kein DeepSeek-API-Key verbunden.".to_string())?;

    recommendation::get_recommendation(&api_key, model, &answers).await
}
