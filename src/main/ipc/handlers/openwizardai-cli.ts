import { ipcMain } from 'electron';
import { withIpcErrorLogging, CreateHandlerOptions } from '../../utils/ipcHandler';
import { OpenWizardAICliManager } from '../../openwizardai-cli-manager';

const LOG_CONTEXT = '[OpenWizardAICLI]';

const handlerOpts = (operation: string): Pick<CreateHandlerOptions, 'context' | 'operation'> => ({
	context: LOG_CONTEXT,
	operation,
});

export function registerOpenWizardAICliHandlers(
	openwizardaiCliManager: OpenWizardAICliManager
): void {
	ipcMain.handle(
		'openwizardaiCli:checkStatus',
		withIpcErrorLogging(handlerOpts('checkStatus'), async () =>
			openwizardaiCliManager.checkStatus()
		)
	);

	ipcMain.handle(
		'openwizardaiCli:installOrUpdate',
		withIpcErrorLogging(handlerOpts('installOrUpdate'), async () =>
			openwizardaiCliManager.installOrUpdate()
		)
	);
}
