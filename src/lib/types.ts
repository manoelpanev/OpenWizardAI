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

// Spiegelt ProjectAnalysis aus src-tauri/src/commands/analyze.rs
export interface ProjectAnalysis {
  markers: string[];
  languages: string[];
  has_git: boolean;
  top_extensions: string[];
}

/** Verdichtet die Analyse zu einer Zeile für den DeepSeek-Prompt. */
export function formatProjectAnalysis(analysis: ProjectAnalysis): string {
  const parts: string[] = [];
  if (analysis.languages.length > 0) parts.push(`Sprachen/Ökosysteme: ${analysis.languages.join(", ")}`);
  if (analysis.markers.length > 0) parts.push(`Marker-Dateien: ${analysis.markers.join(", ")}`);
  parts.push(`Git-Repository: ${analysis.has_git ? "ja" : "nein"}`);
  if (analysis.top_extensions.length > 0) parts.push(`Häufigste Dateiendungen: ${analysis.top_extensions.join(", ")}`);
  return parts.join("; ");
}

export type StorageMode = "LocalOnly" | "LocalAndGitHub" | "GitHubOnly";

export const STORAGE_MODES: { value: StorageMode; label: string; description: string }[] = [
  {
    value: "LocalOnly",
    label: "Nur lokal",
    description: "Zielordner auf der eigenen Platte, kein GitHub involviert.",
  },
  {
    value: "LocalAndGitHub",
    label: "Lokal + GitHub",
    description: "Lokale Arbeitskopie, jede Änderung wird zusätzlich committed und zu einem GitHub-Repo gepusht.",
  },
  {
    value: "GitHubOnly",
    label: "Nur GitHub",
    description:
      "Kein dauerhafter lokaler Ordner. Temporärer Arbeitsordner wird nach jedem Push sofort gelöscht — GitHub bleibt die einzige Quelle.",
  },
];

export interface SetupProjectRequest {
  project_name: string;
  project_root: string;
  selected_tool_ids: string[];
  hitl_level: HitlLevel;
  already_confirmed: string[];
  opencode_model: string | null;
}

// Spiegelt OpencodeModel aus src-tauri/src/adapters/opencode.rs
export interface OpencodeModel {
  id: string;
  display_name: string;
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
  project_analysis: string | null;
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
