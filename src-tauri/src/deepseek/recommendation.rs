use super::behavior::STRICT_BEHAVIOR_PREFIX;
use super::client::{self, DeepSeekModel};
use crate::adapters::{all_adapters, HitlLevel};
use serde::{Deserialize, Serialize};

/// Antworten aus der festen Frage-Sequenz (CONCEPT.md, "Geführter
/// Wizard-Onboarding-Flow"). `wants_custom_agent`/`custom_agent_description`
/// gehören zur separaten Custom-Agent-Frage direkt beim Verbinden.
/// `followup_answers` sind die Antworten auf die von DeepSeek dynamisch
/// generierten, projektspezifischen Vertiefungsfragen (siehe
/// `generate_followup_questions` unten) — Frage-Text und Antwort-Text als
/// Paar, damit die Empfehlung später den vollen Kontext hat.
#[derive(Debug, Deserialize)]
pub struct OnboardingAnswers {
    /// Ob dies ein neues Projekt ist oder ein bestehendes optimiert/
    /// angedockt wird — allererste Frage im Flow (CONCEPT.md, "Docking").
    pub is_new_project: bool,
    pub used_tools: Vec<String>,
    pub project_description: String,
    pub is_prototype: bool,
    pub wants_custom_agent: bool,
    pub custom_agent_description: Option<String>,
    #[serde(default)]
    pub followup_answers: Vec<FollowupAnswer>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FollowupAnswer {
    pub question: String,
    pub answer: String,
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
        "{}Du bist Teil von OpenWizardAI, einem Setup-Wizard für KI-Coding-Projekte. \
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
        STRICT_BEHAVIOR_PREFIX,
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

    let followup_block = if answers.followup_answers.is_empty() {
        String::new()
    } else {
        let lines: Vec<String> = answers
            .followup_answers
            .iter()
            .map(|f| format!("- {}: {}", f.question, f.answer))
            .collect();
        format!("\nProjektspezifische Rückfragen und Antworten:\n{}", lines.join("\n"))
    };

    format!(
        "Projektstatus: {}\n\
        Bereits genutzte/vorhandene Tools: {}\n\
        Vorhaben: {}\n\
        Projekttyp: {}\n\
        {}{}",
        if answers.is_new_project {
            "Neues Projekt"
        } else {
            "Bestehendes Projekt, soll optimiert/angedockt werden"
        },
        if answers.used_tools.is_empty() {
            "keine Angabe".to_string()
        } else {
            answers.used_tools.join(", ")
        },
        answers.project_description,
        if answers.is_prototype { "Prototyp" } else { "Produktions-Code" },
        agent_line,
        followup_block
    )
}

/// Schickt die Onboarding-Antworten (inkl. der Antworten auf die
/// dynamisch generierten Vertiefungsfragen) an DeepSeek und liefert eine
/// strukturierte Empfehlung zurück. `model` ist manuell wählbar
/// (CONCEPT.md, "DeepSeek-Modellwahl") — Flash bleibt der UI-seitige
/// Default, Pro für mehr Tiefe.
pub async fn get_recommendation(
    api_key: &str,
    model: DeepSeekModel,
    answers: &OnboardingAnswers,
) -> Result<OnboardingRecommendation, String> {
    let system_prompt = build_system_prompt();
    let user_prompt = build_user_prompt(answers);

    let raw = client::complete(api_key, model, &system_prompt, &user_prompt).await?;
    parse_json_response(&raw)
}

fn build_followup_questions_prompt() -> String {
    format!(
        "{}Du bist Teil von OpenWizardAI, einem Setup-Wizard für KI-Coding-Projekte. \
        Der Nutzer hat sein Vorhaben grob beschrieben. Formuliere 3 bis 6 gezielte, \
        konkrete Rückfragen, die speziell für DIESES Projekt relevant sind (nicht \
        generisch) — z.B. bei einer Web-API nach Framework/Auth/Datenbank fragen, \
        bei einem CLI-Tool nach Zielplattformen, bei einem Frontend nach \
        Design-System-Vorgaben. Stelle nur Fragen, die für die spätere Tool- und \
        Plugin-Empfehlung tatsächlich relevant sind. Antworte AUSSCHLIESSLICH mit \
        validem JSON, ohne Markdown-Codeblock, ohne Text davor oder danach:\n\
        {{\"questions\": [\"Frage 1\", \"Frage 2\", ...]}}",
        STRICT_BEHAVIOR_PREFIX
    )
}

/// Generiert projektspezifische Vertiefungsfragen basierend auf den festen
/// Basis-Antworten (genutzte Tools, Vorhaben, Prototyp/Produktion) — der
/// erste API-Call im Onboarding-Flow, bevor der Nutzer die Fragen
/// beantwortet und `get_recommendation` aufgerufen wird.
pub async fn generate_followup_questions(
    api_key: &str,
    model: DeepSeekModel,
    answers: &OnboardingAnswers,
) -> Result<Vec<String>, String> {
    let system_prompt = build_followup_questions_prompt();
    let user_prompt = build_user_prompt(answers);

    let raw = client::complete(api_key, model, &system_prompt, &user_prompt).await?;

    #[derive(Deserialize)]
    struct QuestionsResponse {
        questions: Vec<String>,
    }

    let parsed: QuestionsResponse = parse_json_response(&raw)?;
    Ok(parsed.questions)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClarityCheck {
    /// Ob die Antwort ausreichend klar/konkret war.
    pub is_clear: bool,
    /// Falls nicht klar: eine einzelne, gezielte Nachfrage, die genau den
    /// unklaren Punkt adressiert. Leer, wenn `is_clear` true ist.
    #[serde(default)]
    pub clarifying_question: String,
}

fn build_clarity_check_prompt() -> String {
    format!(
        "{}Du bist Teil von OpenWizardAI, einem Setup-Wizard für KI-Coding-Projekte. \
        Du bekommst eine Frage und die Antwort des Nutzers darauf. Beurteile, ob \
        die Antwort konkret und eindeutig genug ist, um später eine sinnvolle \
        Tool-/Plugin-Empfehlung daraus abzuleiten. Vage, widersprüchliche oder \
        ausweichende Antworten gelten als nicht klar genug — aber sei nicht \
        übervorsichtig: eine kurze, aber eindeutige Antwort gilt als klar. \
        Antworte AUSSCHLIESSLICH mit validem JSON, ohne Markdown-Codeblock, ohne \
        Text davor oder danach:\n\
        {{\"is_clear\": true, \"clarifying_question\": \"\"}}\n\
        oder, falls unklar:\n\
        {{\"is_clear\": false, \"clarifying_question\": \"Eine konkrete Rückfrage, \
        die genau den unklaren Punkt adressiert.\"}}",
        STRICT_BEHAVIOR_PREFIX
    )
}

/// Prüft eine einzelne Frage-Antwort-Paarung auf Klarheit. Wird nach jeder
/// beantworteten Vertiefungsfrage aufgerufen (siehe
/// `generate_followup_questions`) — bei Unklarheit liefert dies direkt die
/// nächste, gezielte Nachfrage, statt dass der Nutzer ungeprüft
/// weiterklickt.
pub async fn check_answer_clarity(
    api_key: &str,
    model: DeepSeekModel,
    question: &str,
    answer: &str,
) -> Result<ClarityCheck, String> {
    let system_prompt = build_clarity_check_prompt();
    let user_prompt = format!("Frage: {question}\nAntwort: {answer}");

    let raw = client::complete(api_key, model, &system_prompt, &user_prompt).await?;
    parse_json_response(&raw)
}

fn parse_json_response<T: serde::de::DeserializeOwned>(raw: &str) -> Result<T, String> {
    // Modelle liefern trotz Anweisung gelegentlich Markdown-Codeblöcke —
    // robust gegen ```json ... ``` -Wrapping parsen.
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    serde_json::from_str(cleaned)
        .map_err(|e| format!("DeepSeek-Antwort war kein valides JSON: {e}\nAntwort: {cleaned}"))
}
