import { ipcRenderer } from 'electron';
import type {
	OpenWizardAICliStatus,
	OpenWizardAICliInstallResult,
} from '../../shared/openwizardai-cli';

export interface OpenWizardAICliApi {
	checkStatus: () => Promise<OpenWizardAICliStatus>;
	installOrUpdate: () => Promise<OpenWizardAICliInstallResult>;
}

export function createOpenWizardAICliApi(): OpenWizardAICliApi {
	return {
		checkStatus: () => ipcRenderer.invoke('openwizardaiCli:checkStatus'),
		installOrUpdate: () => ipcRenderer.invoke('openwizardaiCli:installOrUpdate'),
	};
}
