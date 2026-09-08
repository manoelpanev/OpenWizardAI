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
