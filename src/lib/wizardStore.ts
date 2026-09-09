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

export interface EditableCustomAgent {
  name: string;
  description: string;
}

export interface WizardState {
  step: WizardStep;
  isNewProject: boolean;
  // Verdichtete Projekt-Analyse beim Andocken (formatProjectAnalysis),
  // geht als Kontext in die DeepSeek-Aufrufe. Leer bei neuen Projekten.
  projectAnalysis: string;
  storageMode: StorageMode;
  deepSeekConnected: boolean;
  model: DeepSeekModel;
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
    isNewProject: true,
    projectAnalysis: "",
    storageMode: "LocalOnly",
    deepSeekConnected: false,
    model: "Flash",
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
      update((s) => ({ ...s, step }));
    },
    reset() {
      set(initialState());
    },
  };
}

export const wizardStore = createWizardStore();
