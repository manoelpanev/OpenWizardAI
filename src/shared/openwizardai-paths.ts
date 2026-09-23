/**
 * Canonical project-relative paths for OpenWizardAI-managed files.
 *
 * All OpenWizardAI files live under `.openwizardai/` in the project root.
 * Legacy paths are retained for backwards compatibility (read-only fallback).
 */

// ── Current (canonical) paths ────────────────────────────────────────────────

/** Root directory for all OpenWizardAI project files */
export const OPENWIZARDAI_DIR = '.openwizardai';

/** Playbook (Auto Run) documents folder */
export const PLAYBOOKS_DIR = '.openwizardai/playbooks';

/** Shared history directory for cross-host history sync */
export const SHARED_HISTORY_DIR = '.openwizardai/history';

/** Cue configuration file */
export const CUE_CONFIG_PATH = '.openwizardai/cue.yaml';

/** Default directory for Cue prompt files */
export const CUE_PROMPTS_DIR = '.openwizardai/prompts';

/**
 * Where rendered diagrams (agent-authored inline SVG, Mermaid charts) are saved.
 * Every "Save Image" surface writes here so diagrams land next to the project
 * that produced them instead of scattering into ~/Downloads.
 */
export const DIAGRAMS_DIR = '.openwizardai/diagrams';

// ── Legacy paths (backwards compatibility, read-only fallback) ───────────────

/** @deprecated Use PLAYBOOKS_DIR */
export const LEGACY_PLAYBOOKS_DIR = 'Auto Run Docs';

/** @deprecated Use CUE_CONFIG_PATH */
export const LEGACY_CUE_CONFIG_PATH = 'openwizardai-cue.yaml';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a prompt file path for a Cue pipeline agent.
 * Convention: .openwizardai/prompts/{agentName}-{pipelineName}.md
 * Spaces are replaced with underscores.
 */
export function cuePromptFilePath(
	agentName: string,
	pipelineName: string,
	suffix?: string
): string {
	const sanitize = (s: string) => s.replace(/\s+/g, '_').toLowerCase();
	const base = `${sanitize(agentName)}-${sanitize(pipelineName)}`;
	const filename = suffix ? `${base}-${suffix}.md` : `${base}.md`;
	return `${CUE_PROMPTS_DIR}/${filename}`;
}
