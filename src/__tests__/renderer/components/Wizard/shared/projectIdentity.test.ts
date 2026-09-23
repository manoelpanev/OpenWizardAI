import { describe, expect, it } from 'vitest';
import {
	defaultAgentNameForPath,
	projectNameFromPath,
} from '../../../../../renderer/components/Wizard/shared/projectIdentity';

describe('projectNameFromPath', () => {
	it('names the project after its folder', () => {
		expect(projectNameFromPath('/Users/pedram/Projects/OpenWizardAI')).toBe('OpenWizardAI');
	});

	it('ignores a trailing separator', () => {
		expect(projectNameFromPath('/Users/pedram/Projects/OpenWizardAI/')).toBe('OpenWizardAI');
	});

	it('reads a Windows path', () => {
		expect(projectNameFromPath('C:\\Users\\pedram\\Projects\\OpenWizardAI')).toBe('OpenWizardAI');
	});

	it('falls back when there is no folder name', () => {
		expect(projectNameFromPath('')).toBe('this project');
		expect(projectNameFromPath('   ')).toBe('this project');
	});
});

describe('defaultAgentNameForPath', () => {
	it('suggests the folder name when it is free', () => {
		expect(defaultAgentNameForPath('/Projects/OpenWizardAI', ['Something Else'])).toBe(
			'OpenWizardAI'
		);
	});

	it('avoids a name already in use, case-insensitively', () => {
		expect(defaultAgentNameForPath('/Projects/OpenWizardAI', ['openwizardai'])).toBe(
			'OpenWizardAI 2'
		);
	});

	it('keeps counting past the first collision', () => {
		expect(
			defaultAgentNameForPath('/Projects/OpenWizardAI', ['OpenWizardAI', 'OpenWizardAI 2'])
		).toBe('OpenWizardAI 3');
	});

	it('returns an empty string when the path yields no name', () => {
		expect(defaultAgentNameForPath('', [])).toBe('');
	});
});
