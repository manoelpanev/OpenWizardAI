/**
 * OpenWizzard branding and distribution settings.
 *
 * OpenWizzard is a fork of Maestro (https://github.com/RunMaestro/Maestro, AGPL-3.0).
 * Internal identifiers (`window.maestro`, `.maestro/`, `maestro://`, `maestro-cli`)
 * are intentionally kept so upstream changes keep merging cleanly.
 */

/** User-facing application name */
export const APP_NAME = 'OpenWizzard';

/** Upstream project this fork is based on */
export const UPSTREAM_REPO_URL = 'https://github.com/RunMaestro/Maestro';

/**
 * Update checks and auto-updates are off until OpenWizzard publishes its own
 * releases. The upstream release feed ships Maestro builds, which would replace
 * this app on install.
 */
export const UPDATES_ENABLED = false;

/**
 * Anonymous usage pings (install check-in, Cue stats) are off. Their endpoints
 * belong to the upstream Maestro project, not to OpenWizzard.
 */
export const UPSTREAM_TELEMETRY_ENABLED = false;
