import { writable } from "svelte/store";
import type {
  DeepSeekModel,
  FollowupAnswer,
  HitlLevel,
  OnboardingRecommendation,
  StorageMode,
  WriteOutcome,
} from "./types";

export type WizardStep =
  | "project-status"
  | "storage-mode"
  | "connect"
  | "agent-question"
  | "questions"
  | "followup-questions"
  | "recommendation"
  | "tools"
  | "hitl"
  | "summary";

// Feste Reihenfolge für den Fortschrittsbalken. Der tatsächliche Pfad
// verzweigt (KI-Pfad überspringt "tools"/"hitl", der manuelle Pfad
// überspringt "agent-question" bis "recommendation") — die Anzeige
// rechnet deshalb mit der Position im TATSÄCHLICH durchlaufenen Pfad
// (siehe `history` unten), nicht mit dieser Liste direkt. Sie dient nur
// als Referenz für die Gesamtzahl möglicher Schritte.
export const STEP_ORDER: WizardStep[] = [
  "project-status",
  "storage-mode",
  "connect",
  "agent-question",
  "questions",
  "followup-questions",
  "recommendation",
  "tools",
  "hitl",
  "summary",
];

export interface EditableCustomAgent {
  name: string;
  description: string;
}

export interface WizardState {
  step: WizardStep;
  // Tatsächlich besuchte Schritte in Reihenfolge, inkl. des aktuellen als
  // letztes Element — Grundlage für "Zurück" und den Fortschrittsbalken.
  // Ersetzt eine feste Schritt-Liste, weil der Flow verzweigt (KI-Pfad
  // vs. manueller Pfad, variable Anzahl Vertiefungsfragen).
  history: WizardStep[];
  isNewProject: boolean;
  // Verdichtete Projekt-Analyse beim Andocken (formatProjectAnalysis),
  // geht als Kontext in die DeepSeek-Aufrufe. Leer bei neuen Projekten.
  projectAnalysis: string;
  storageMode: StorageMode;
  deepSeekConnected: boolean;
  model: DeepSeekModel;
  // Ob die optionale Tavily-Web-Recherche für diesen Durchlauf genutzt
  // wird, und ihr Ergebnis als prompt-fertiger Textblock.
  webSearchEnabled: boolean;
  webResearch: string;
  wantsCustomAgent: boolean;
  customAgentDescription: string;
  usedTools: string[];
  projectDescription: string;
  isPrototype: boolean;
  followupQuestions: string[];
  followupAnswers: FollowupAnswer[];
  recommendation: OnboardingRecommendation | null;
  // Inline im Empfehlungs-Screen editierbare Werte — vorausgefüllt aus
  // der Empfehlung, aber unabhängig davon direkt änderbar, ohne Schritte
  // zurückzugehen.
  editablePluginTags: string[];
  editableCustomAgent: EditableCustomAgent | null;
  projectName: string;
  projectRoot: string;
  selectedToolIds: string[];
  hitlLevel: HitlLevel;
  // Modell unter opencode (`provider/modell`) — leer heißt: opencode
  // behält seine eigene Default-Konfiguration.
  opencodeModel: string;
  outcomes: WriteOutcome[] | null;
}

function initialState(): WizardState {
  return {
    step: "project-status",
    history: ["project-status"],
    isNewProject: true,
    projectAnalysis: "",
    storageMode: "LocalOnly",
    deepSeekConnected: false,
    model: "Flash",
    webSearchEnabled: false,
    webResearch: "",
    wantsCustomAgent: false,
    customAgentDescription: "",
    usedTools: [],
    projectDescription: "",
    isPrototype: true,
    followupQuestions: [],
    followupAnswers: [],
    recommendation: null,
    editablePluginTags: [],
    editableCustomAgent: null,
    projectName: "",
    projectRoot: "",
    selectedToolIds: [],
    hitlLevel: "AskOnRisky",
    opencodeModel: "",
    outcomes: null,
  };
}

function createWizardStore() {
  const { subscribe, update, set } = writable<WizardState>(initialState());

  return {
    subscribe,
    setIsNewProject(isNew: boolean) {
      update((s) => ({ ...s, isNewProject: isNew }));
    },
    setProjectAnalysis(analysis: string) {
      update((s) => ({ ...s, projectAnalysis: analysis }));
    },
    setStorageMode(mode: StorageMode) {
      update((s) => ({ ...s, storageMode: mode }));
    },
    setDeepSeekConnected(connected: boolean) {
      update((s) => ({ ...s, deepSeekConnected: connected }));
    },
    setModel(model: DeepSeekModel) {
      update((s) => ({ ...s, model }));
    },
    setWebSearchEnabled(enabled: boolean) {
      update((s) => ({ ...s, webSearchEnabled: enabled }));
    },
    setWebResearch(research: string) {
      update((s) => ({ ...s, webResearch: research }));
    },
    setCustomAgentAnswer(wants: boolean, description: string) {
      update((s) => ({ ...s, wantsCustomAgent: wants, customAgentDescription: description }));
    },
    setOnboardingAnswers(usedTools: string[], projectDescription: string, isPrototype: boolean) {
      update((s) => ({ ...s, usedTools, projectDescription, isPrototype }));
    },
    setFollowupQuestions(questions: string[]) {
      update((s) => ({ ...s, followupQuestions: questions }));
    },
    setFollowupAnswers(answers: FollowupAnswer[]) {
      update((s) => ({ ...s, followupAnswers: answers }));
    },
    setRecommendation(recommendation: OnboardingRecommendation) {
      update((s) => ({
        ...s,
        recommendation,
        // Bereits als "genutzt" angegebene Tools sind immer mit
        // vorausgewählt, unabhängig davon, ob die KI sie explizit
        // empfohlen hat — der Nutzer hat sie ja aktiv als vorhanden
        // angegeben.
        selectedToolIds: Array.from(new Set([...recommendation.recommended_tool_ids.value, ...s.usedTools])),
        hitlLevel: recommendation.recommended_hitl_level.value,
        editablePluginTags: recommendation.recommended_plugin_tags.value,
        editableCustomAgent: recommendation.custom_agent
          ? { name: recommendation.custom_agent.name, description: recommendation.custom_agent.description }
          : null,
      }));
    },
    setEditablePluginTags(tags: string[]) {
      update((s) => ({ ...s, editablePluginTags: tags }));
    },
    setEditableCustomAgent(agent: EditableCustomAgent | null) {
      update((s) => ({ ...s, editableCustomAgent: agent }));
    },
    setProjectBasics(projectName: string, projectRoot: string) {
      update((s) => ({ ...s, projectName, projectRoot }));
    },
    setSelectedTools(ids: string[]) {
      update((s) => ({ ...s, selectedToolIds: ids }));
    },
    setHitlLevel(level: HitlLevel) {
      update((s) => ({ ...s, hitlLevel: level }));
    },
    setOpencodeModel(model: string) {
      update((s) => ({ ...s, opencodeModel: model }));
    },
    setOutcomes(outcomes: WriteOutcome[]) {
      update((s) => ({ ...s, outcomes }));
    },
    goToStep(step: WizardStep) {
      update((s) => ({ ...s, step, history: [...s.history, step] }));
    },
    // Springt zum vorherigen tatsächlich besuchten Schritt zurück (nicht
    // zur festen STEP_ORDER-Position) — funktioniert deshalb korrekt über
    // Verzweigungen hinweg, z.B. zurück von "recommendation" landet immer
    // bei "followup-questions", nie bei "tools".
    goBack() {
      update((s) => {
        if (s.history.length <= 1) return s;
        const history = s.history.slice(0, -1);
        return { ...s, history, step: history[history.length - 1] };
      });
    },
    reset() {
      set(initialState());
    },
  };
}

export const wizardStore = createWizardStore();
