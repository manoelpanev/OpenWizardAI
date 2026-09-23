export interface OpenWizardAICliStatus {
	expectedVersion: string;
	installed: boolean;
	inPath: boolean;
	inShellPath: boolean;
	commandPath: string | null;
	installedVersion: string | null;
	versionMatch: boolean;
	needsInstallOrUpdate: boolean;
	installDir: string;
	bundledCliPath: string | null;
}

export interface OpenWizardAICliInstallResult {
	success: boolean;
	status: OpenWizardAICliStatus;
	pathUpdated: boolean;
	pathUpdateError?: string;
	restartRequired: boolean;
	shellFilesUpdated: string[];
}
