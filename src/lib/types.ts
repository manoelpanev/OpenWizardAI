// Spiegelt die Rust-Typen aus src-tauri/src/adapters/mod.rs und
// src-tauri/src/commands/tool_setup.rs — bei Änderung dort auch hier
// nachziehen.

export type HitlLevel = "AlwaysAsk" | "AskOnRisky" | "AskRarely" | "Autonomous";

export const HITL_LEVELS: { value: HitlLevel; label: string; description: string }[] = [
  {
    value: "AlwaysAsk",
    label: "Immer fragen",
    description: "Vor jeder Aktion wird nachgefragt.",
  },
  {
    value: "AskOnRisky",
    label: "Nur bei riskanten Aktionen",
    description: "Datei löschen, git push, Netzwerkzugriff — sonst autonom.",
  },
  {
    value: "AskRarely",
    label: "Selten fragen",
    description: "Nur bei irreversiblen Aktionen wird nachgefragt.",
  },
  {
    value: "Autonomous",
    label: "Autonom",
    description: "Fragt nie, außer bei Show-Stoppern.",
  },
];

export interface ToolInfo {
  id: string;
  display_name: string;
}

export interface ExistingConfig {
  found_paths: string[];
}

export interface SetupProjectRequest {
  project_name: string;
  project_root: string;
  selected_tool_ids: string[];
  hitl_level: HitlLevel;
  already_confirmed: string[];
}

export type WriteOutcome =
  | { outcome: "Written"; path: string }
  | { outcome: "Skipped"; path: string; reason: string }
  | { outcome: "Failed"; path: string; error: string };

export interface SetupProjectResponse {
  outcomes: WriteOutcome[];
}

// Spiegelt src-tauri/src/deepseek/client.rs und recommendation.rs

export type DeepSeekModel = "Flash" | "Pro";

export const DEEPSEEK_MODELS: { value: DeepSeekModel; label: string; description: string }[] = [
  { value: "Flash", label: "Flash", description: "Schneller Standard-Modus (Default)." },
  { value: "Pro", label: "Pro", description: "Mehr Tiefe, langsamer — für komplexere Vorhaben." },
];

export interface FollowupAnswer {
  question: string;
  answer: string;
}

export interface OnboardingAnswers {
  is_new_project: boolean;
  used_tools: string[];
  project_description: string;
  is_prototype: boolean;
  wants_custom_agent: boolean;
  custom_agent_description: string | null;
  followup_answers: FollowupAnswer[];
}

export interface ClarityCheck {
  is_clear: boolean;
  clarifying_question: string;
}

export interface Recommendation<T> {
  value: T;
  reasoning: string;
}

export interface CustomAgentRecommendation {
  name: string;
  description: string;
  reasoning: string;
}

export interface OnboardingRecommendation {
  recommended_tool_ids: Recommendation<string[]>;
  recommended_hitl_level: Recommendation<HitlLevel>;
  recommended_plugin_tags: Recommendation<string[]>;
  custom_agent: CustomAgentRecommendation | null;
}
