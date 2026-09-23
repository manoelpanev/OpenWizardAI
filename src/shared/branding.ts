/**
 * OpenWizardAI branding, project links and distribution settings.
 *
 * OpenWizardAI is based on Maestro by Pedram Amini (AGPL-3.0). The license
 * requires keeping that notice; everything else is OpenWizardAI's own.
 */

/** User-facing application name */
export const APP_NAME = 'OpenWizardAI';

/** Project home */
export const APP_REPO_URL = 'https://github.com/manoelpanev/OpenWizardAI';

/** Where users report bugs */
export const APP_ISSUES_URL = `${APP_REPO_URL}/issues`;

/** Releases page (update checks read from here once they are enabled) */
export const APP_RELEASES_URL = `${APP_REPO_URL}/releases`;

/** Community playbook library for the Playbook Exchange */
export const PLAYBOOKS_REPO_URL = 'https://github.com/manoelpanev/OpenWizardAI-Playbooks';
export const PLAYBOOKS_RAW_BASE =
	'https://raw.githubusercontent.com/manoelpanev/OpenWizardAI-Playbooks/main';

/** Upstream attribution required by the AGPL-3.0 license */
export const UPSTREAM_ATTRIBUTION = 'Based on Maestro by Pedram Amini (AGPL-3.0)';

/**
 * Update checks and auto-updates stay off until OpenWizardAI publishes its own
 * signed releases on APP_RELEASES_URL.
 */
export const UPDATES_ENABLED = false;
