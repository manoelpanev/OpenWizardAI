/**
 * useProviderTurnOptions - the model and effort choices valid for one provider,
 * plus that provider's own defaults.
 *
 * Effort is provider-shaped and there is no single config key for it: Claude
 * Code exposes `effort`, while Codex, Copilot-CLI and Factory Droid expose
 * `reasoningEffort`. Both are probed and whichever the agent actually defines
 * wins, so a new agent gets correct options without editing this file. Anything
 * that offers a model or effort picker must read from here rather than
 * hardcoding a list, or it will show Claude's thinking levels to a Codex agent.
 *
 * The stale flag is load-bearing. Switching agents while a slow probe is in
 * flight (`opencode models` shells out) would otherwise let the previous
 * agent's list overwrite the current one's.
 */

import { useEffect, useState } from 'react';
import type { ToolType } from '../../types';

export interface ProviderTurnOptions {
	/** Models this provider offers. Empty while loading or when it has none. */
	models: string[];
	/** Effort levels this provider offers, from whichever config key it defines. */
	efforts: string[];
	/** The provider's own configured default model, or '' when unset. */
	defaultModel: string;
	/** The provider's own configured default effort, or '' when unset. */
	defaultEffort: string;
}

export function useProviderTurnOptions(toolType: ToolType | undefined): ProviderTurnOptions {
	const [models, setModels] = useState<string[]>([]);
	const [efforts, setEfforts] = useState<string[]>([]);
	const [defaultModel, setDefaultModel] = useState('');
	const [defaultEffort, setDefaultEffort] = useState('');

	useEffect(() => {
		if (!toolType) return;
		let stale = false;
		const agentId = toolType;

		window.maestro.agents
			.getModels(agentId)
			.then((next) => {
				if (!stale) setModels(next);
			})
			.catch(() => {
				if (!stale) setModels([]);
			});

		Promise.all([
			window.maestro.agents.getConfigOptions(agentId, 'effort').catch(() => [] as string[]),
			window.maestro.agents
				.getConfigOptions(agentId, 'reasoningEffort')
				.catch(() => [] as string[]),
		])
			.then(([effortOpts, reasoningOpts]) => {
				if (stale) return;
				setEfforts(effortOpts.length > 0 ? effortOpts : reasoningOpts);
			})
			.catch(() => {
				if (!stale) setEfforts([]);
			});

		window.maestro.agents
			.getConfig(agentId)
			.then((config) => {
				if (stale) return;
				setDefaultModel(config?.model || '');
				setDefaultEffort(config?.effort || config?.reasoningEffort || '');
			})
			.catch(() => {
				if (stale) return;
				setDefaultModel('');
				setDefaultEffort('');
			});

		return () => {
			stale = true;
		};
	}, [toolType]);

	return { models, efforts, defaultModel, defaultEffort };
}
