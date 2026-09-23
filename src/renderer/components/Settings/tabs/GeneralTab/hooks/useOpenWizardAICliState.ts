import { useCallback, useEffect, useState } from 'react';
import type { OpenWizardAICliStatus } from '../../../../../../shared/openwizardai-cli';
import { captureException } from '../../../../../utils/sentry';
import type { OpenWizardAICliState } from '../types';

interface UseOpenWizardAICliStateArgs {
	isOpen: boolean;
}

export function useOpenWizardAICliState({
	isOpen,
}: UseOpenWizardAICliStateArgs): OpenWizardAICliState {
	const [status, setStatus] = useState<OpenWizardAICliStatus | null>(null);
	const [statusError, setStatusError] = useState<string | null>(null);
	const [checking, setChecking] = useState(false);
	const [installing, setInstalling] = useState(false);
	const [installMessage, setInstallMessage] = useState<string | null>(null);

	const checkStatus = useCallback(async () => {
		setChecking(true);
		setStatusError(null);
		// Clear the previous result up front: leaving the last-known status in
		// place while a re-check is in flight means a check that then FAILS
		// still shows the prior "Installed" badge instead of reading as unknown.
		setStatus(null);
		try {
			const nextStatus = await window.openwizardai.openwizardaiCli.checkStatus();
			setStatus(nextStatus);
		} catch (err) {
			setStatusError('Failed to check OpenWizardAI CLI status');
			captureException(err instanceof Error ? err : new Error(String(err)), {
				extra: { context: 'GeneralTab: OpenWizardAI CLI status check' },
			});
		} finally {
			setChecking(false);
		}
	}, []);

	const installOrUpdate = useCallback(async () => {
		setInstalling(true);
		setInstallMessage(null);
		setStatusError(null);
		try {
			const result = await window.openwizardai.openwizardaiCli.installOrUpdate();
			setStatus(result.status);
			if (result.pathUpdateError) {
				setStatusError(result.pathUpdateError);
			}
			if (result.restartRequired) {
				setInstallMessage('CLI installed. Open a new terminal for PATH changes to apply.');
			} else if (result.success && result.status.versionMatch) {
				setInstallMessage('CLI is installed and matches this OpenWizardAI version.');
			} else {
				setInstallMessage('CLI was installed but version/path check still needs attention.');
			}
		} catch (err) {
			setStatusError('Failed to install/update OpenWizardAI CLI');
			captureException(err instanceof Error ? err : new Error(String(err)), {
				extra: { context: 'GeneralTab: OpenWizardAI CLI install/update' },
			});
		} finally {
			setInstalling(false);
		}
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		setInstallMessage(null);
		void checkStatus();
	}, [checkStatus, isOpen]);

	return {
		status,
		statusError,
		checking,
		installing,
		installMessage,
		checkStatus,
		installOrUpdate,
	};
}
