use super::client::{self, DeepSeekModel};
use crate::adapters::{all_adapters, HitlLevel};
use serde::{Deserialize, Serialize};

/// Antworten aus der festen Frage-Sequenz (CONCEPT.md, "Geführter
/// Wizard-Onboarding-Flow"). `wants_custom_agent`/`custom_agent_description`
/// gehören zur separaten Custom-Agent-Frage direkt beim Verbinden.
#[derive(Debug, Deserialize)]
pub struct OnboardingAnswers {
    pub used_tools: Vec<String>,
    pub project_description: String,
    pub is_prototype: bool,
    pub wants_custom_agent: bool,
    pub custom_agent_description: Option<String>,
}

/// Eine einzelne Empfehlung mit Begründung — wird 1:1 im Ergebnis-Screen
/// angezeigt, jede Empfehlung bleibt danach manuell überschreibbar
/// (CONCEPT.md, "Ergebnis-Screen").
#[derive(Debug, Serialize, Deserialize)]
pub struct Recommendation<T> {
    pub value: T,
    pub reasoning: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomAgentRecommendation {
    pub name: String,
    pub description: String,
    pub reasoning: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OnboardingRecommendation {
    pub recommended_tool_ids: Recommendation<Vec<String>>,
    pub recommended_hitl_level: Recommendation<HitlLevel>,
    pub recommended_plugin_tags: Recommendation<Vec<String>>,
    pub custom_agent: Option<CustomAgentRecommendation>,
}

fn build_system_prompt() -> String {
    let tool_ids: Vec<&str> = all_adapters().iter().map(|a| a.id()).collect();

    format!(
        "Du bist Teil von OpenWizardAI, einem Setup-Wizard für KI-Coding-Projekte. \
        Verfügbare Tool-IDs: {}. Verfügbare HITL-Stufen: AlwaysAsk, AskOnRisky, \
        AskRarely, Autonomous. Antworte AUSSCHLIESSLICH mit validem JSON in \
        genau dieser Struktur, ohne Markdown-Codeblock, ohne Erklärtext davor \
        oder danach:\n\
        {{\n\
        \"recommended_tool_ids\": {{\"value\": [\"...\"], \"reasoning\": \"...\"}},\n\
        \"recommended_hitl_level\": {{\"value\": \"AskOnRisky\", \"reasoning\": \"...\"}},\n\
        \"recommended_plugin_tags\": {{\"value\": [\"...\"], \"reasoning\": \"...\"}},\n\
        \"custom_agent\": null\n\
        }}\n\
        Wenn der Nutzer einen Custom-Agent wünscht, fülle \"custom_agent\" als \
        Objekt {{\"name\": \"...\", \"description\": \"...\", \"reasoning\": \"...\"}} \
        statt null. Jede \"reasoning\" ist ein kurzer, konkreter Satz auf Deutsch, \
        der erklärt, welche Nutzerantwort zu dieser Empfehlung geführt hat.",
        tool_ids.join(", ")
    )
}

fn build_user_prompt(answers: &OnboardingAnswers) -> String {
    let agent_line = if answers.wants_custom_agent {
        format!(
            "Gewünschter Custom-Agent: {}",
            answers
                .custom_agent_description
                .as_deref()
                .unwrap_or("(keine Beschreibung angegeben)")
        )
    } else {
        "Kein Custom-Agent gewünscht.".to_string()
    };

    format!(
        "Bereits genutzte/vorhandene Tools: {}\n\
        Vorhaben: {}\n\
        Projekttyp: {}\n\
        {}",
        if answers.used_tools.is_empty() {
            "keine Angabe".to_string()
        } else {
            answers.used_tools.join(", ")
        },
        answers.project_description,
        if answers.is_prototype { "Prototyp" } else { "Produktions-Code" },
        agent_line
    )
}

/// Schickt die Onboarding-Antworten an DeepSeek und liefert eine
/// strukturierte Empfehlung zurück. Nutzt immer Flash (CONCEPT.md,
/// "DeepSeek-Modellwahl" — Flash ist Default für Standard-Aufrufe).
pub async fn get_recommendation(
    api_key: &str,
    answers: &OnboardingAnswers,
) -> Result<OnboardingRecommendation, String> {
    let system_prompt = build_system_prompt();
    let user_prompt = build_user_prompt(answers);

    let raw = client::complete(api_key, DeepSeekModel::Flash, &system_prompt, &user_prompt).await?;

    // Modelle liefern trotz Anweisung gelegentlich Markdown-Codeblöcke —
    // robust gegen ```json ... ``` -Wrapping parsen.
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    serde_json::from_str(cleaned)
        .map_err(|e| format!("DeepSeek-Antwort war kein valides Empfehlungs-JSON: {e}\nAntwort: {cleaned}"))
}
