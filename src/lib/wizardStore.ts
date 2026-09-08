import { writable } from "svelte/store";
import type { HitlLevel, WriteOutcome } from "./types";

export interface WizardState {
  step: 1 | 2 | 3;
  projectName: string;
  projectRoot: string;
  selectedToolIds: string[];
  hitlLevel: HitlLevel;
  outcomes: WriteOutcome[] | null;
}

function createWizardStore() {
  const { subscribe, update, set } = writable<WizardState>({
    step: 1,
    projectName: "",
    projectRoot: "",
    selectedToolIds: [],
    hitlLevel: "AskOnRisky",
    outcomes: null,
  });

  return {
    subscribe,
    setProjectBasics(projectName: string, projectRoot: string) {
      update((s) => ({ ...s, projectName, projectRoot }));
    },
    setSelectedTools(ids: string[]) {
      update((s) => ({ ...s, selectedToolIds: ids }));
    },
    setHitlLevel(level: HitlLevel) {
      update((s) => ({ ...s, hitlLevel: level }));
    },
    setOutcomes(outcomes: WriteOutcome[]) {
      update((s) => ({ ...s, outcomes }));
    },
    goToStep(step: 1 | 2 | 3) {
      update((s) => ({ ...s, step }));
    },
    reset() {
      set({
        step: 1,
        projectName: "",
        projectRoot: "",
        selectedToolIds: [],
        hitlLevel: "AskOnRisky",
        outcomes: null,
      });
    },
  };
}

export const wizardStore = createWizardStore();
