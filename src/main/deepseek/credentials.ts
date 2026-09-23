/**
 * DeepSeek API key storage.
 *
 * The key is encrypted with Electron's safeStorage (macOS Keychain, Windows
 * DPAPI, libsecret on Linux) and only the ciphertext is written to disk. It is
 * decrypted on demand when a DeepSeek agent process is spawned and handed to
 * that process through its environment - it never enters agent configs,
 * settings, logs or the renderer.
 */

import { app, safeStorage } from 'electron';
import Store from 'electron-store';
import { verifyApiKey } from '../deepseek-agent/deepseek-client';
import { logger } from '../utils/logger';

const LOG_CONTEXT = 'DeepSeek';

interface DeepSeekStoreData {
	/** Base64 of the safeStorage-encrypted key, or null when none is saved */
	encryptedApiKey: string | null;
}

export interface DeepSeekStatus {
	configured: boolean;
	encryptionAvailable: boolean;
	/** Last four characters, so the user can tell which key is saved */
	keyHint: string | null;
}

let _store: Store<DeepSeekStoreData> | null = null;

function getStore(): Store<DeepSeekStoreData> {
	if (_store === null) {
		_store = new Store<DeepSeekStoreData>({
			name: 'deepseek',
			defaults: { encryptedApiKey: null },
		});
	}
	return _store;
}

export function getDeepSeekApiKey(): string | null {
	const encrypted = getStore().get('encryptedApiKey', null);
	if (!encrypted || !safeStorage.isEncryptionAvailable()) return null;
	try {
		return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
	} catch (error) {
		logger.warn('Stored DeepSeek API key could not be decrypted', LOG_CONTEXT, {
			error: String(error),
		});
		return null;
	}
}

export function getDeepSeekStatus(): DeepSeekStatus {
	const key = getDeepSeekApiKey();
	return {
		configured: key !== null,
		encryptionAvailable: safeStorage.isEncryptionAvailable(),
		keyHint: key ? key.slice(-4) : null,
	};
}

/** Verify the key against the DeepSeek API, then store it encrypted. */
export async function saveDeepSeekApiKey(
	rawKey: string
): Promise<{ success: true; status: DeepSeekStatus } | { success: false; error: string }> {
	const key = rawKey.trim();
	if (!key) return { success: false, error: 'Please paste your DeepSeek API key.' };
	if (!safeStorage.isEncryptionAvailable()) {
		return {
			success: false,
			error: 'Secure storage is not available on this system, so the key cannot be saved safely.',
		};
	}
	const check = await verifyApiKey(key);
	if (!check.ok) return { success: false, error: check.error };
	getStore().set('encryptedApiKey', safeStorage.encryptString(key).toString('base64'));
	logger.info('DeepSeek API key saved', LOG_CONTEXT);
	return { success: true, status: getDeepSeekStatus() };
}

export function clearDeepSeekApiKey(): DeepSeekStatus {
	getStore().set('encryptedApiKey', null);
	logger.info('DeepSeek API key removed', LOG_CONTEXT);
	return getDeepSeekStatus();
}

/** Environment for a DeepSeek agent process. Holds no key when none is saved. */
export function getDeepSeekSpawnEnv(): Record<string, string> {
	const env: Record<string, string> = { OPENWIZARDAI_USER_DATA: app.getPath('userData') };
	const key = getDeepSeekApiKey();
	if (key) env.DEEPSEEK_API_KEY = key;
	return env;
}
