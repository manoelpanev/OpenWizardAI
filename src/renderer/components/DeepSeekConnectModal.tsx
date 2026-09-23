/**
 * DeepSeekConnect - connects OpenWizardAI to DeepSeek with the user's API key.
 *
 * Mounted once at the app root. It opens by itself on launch while no key is
 * saved, and again whenever something dispatches OPEN_DEEPSEEK_CONNECT_EVENT
 * (the "Connect DeepSeek" quick action). The key is verified by the main
 * process and stored encrypted there; this component never keeps it after
 * submitting.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import type { Theme } from '../types';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';
import { Modal, ModalFooter } from './ui';
import { Spinner } from './ui/Spinner';
import { openUrl } from '../utils/openUrl';
import { notifyToast } from '../stores/notificationStore';

export const OPEN_DEEPSEEK_CONNECT_EVENT = 'openwizardai:open-deepseek-connect';

type DeepSeekConnectionStatus = Awaited<ReturnType<typeof window.openwizardai.deepseek.getStatus>>;

const API_KEYS_URL = 'https://platform.deepseek.com/api_keys';

export function openDeepSeekConnect(): void {
	window.dispatchEvent(new Event(OPEN_DEEPSEEK_CONNECT_EVENT));
}

interface DeepSeekConnectProps {
	theme: Theme;
}

export function DeepSeekConnect({ theme }: DeepSeekConnectProps) {
	const [open, setOpen] = useState(false);
	const [status, setStatus] = useState<DeepSeekConnectionStatus | null>(null);
	const [apiKey, setApiKey] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const refresh = useCallback(async () => {
		const next = await window.openwizardai.deepseek.getStatus();
		setStatus(next);
		return next;
	}, []);

	useEffect(() => {
		let cancelled = false;
		refresh()
			.then((s) => {
				if (!cancelled && !s.configured) setOpen(true);
			})
			.catch(() => {
				// Status unavailable (e.g. main not ready): stay quiet, the quick action still works.
			});
		const onOpen = () => {
			setError(null);
			setApiKey('');
			void refresh();
			setOpen(true);
		};
		window.addEventListener(OPEN_DEEPSEEK_CONNECT_EVENT, onOpen);
		return () => {
			cancelled = true;
			window.removeEventListener(OPEN_DEEPSEEK_CONNECT_EVENT, onOpen);
		};
	}, [refresh]);

	const close = useCallback(() => {
		setOpen(false);
		setApiKey('');
		setError(null);
	}, []);

	const connect = useCallback(async () => {
		if (!apiKey.trim() || saving) return;
		setSaving(true);
		setError(null);
		try {
			const result = await window.openwizardai.deepseek.saveApiKey(apiKey);
			if (result.success) {
				setStatus(result.status);
				notifyToast({
					type: 'success',
					title: 'DeepSeek connected',
					message: 'Create an agent and pick DeepSeek to start working.',
				});
				close();
			} else {
				setError(result.error);
			}
		} finally {
			setSaving(false);
			setApiKey('');
		}
	}, [apiKey, saving, close]);

	const disconnect = useCallback(async () => {
		setStatus(await window.openwizardai.deepseek.clearApiKey());
	}, []);

	if (!open) return null;

	return (
		<Modal
			theme={theme}
			title="Connect DeepSeek"
			priority={MODAL_PRIORITIES.DEEPSEEK_CONNECT}
			onClose={close}
			initialFocusRef={inputRef}
			headerIcon={<KeyRound className="w-4 h-4" style={{ color: theme.colors.accent }} />}
			width={480}
			footer={
				<ModalFooter
					theme={theme}
					onCancel={close}
					cancelLabel={status?.configured ? 'Close' : 'Later'}
					onConfirm={() => void connect()}
					confirmLabel={saving ? 'Checking…' : 'Connect'}
					confirmDisabled={!apiKey.trim() || saving}
				/>
			}
		>
			<div className="space-y-4 text-sm" style={{ color: theme.colors.textMain }}>
				<p style={{ color: theme.colors.textDim }}>
					OpenWizardAI&apos;s own agent and wizard run on DeepSeek V4. Paste your DeepSeek API key
					once; it is checked with DeepSeek and stored encrypted in your system keychain.
				</p>

				{status?.configured && (
					<div
						className="flex items-center justify-between p-3 rounded border"
						style={{
							borderColor: theme.colors.success,
							backgroundColor: `${theme.colors.success}10`,
						}}
					>
						<span>Connected (key ending in {status.keyHint})</span>
						<button
							type="button"
							onClick={() => void disconnect()}
							className="text-xs underline"
							style={{ color: theme.colors.textDim }}
						>
							Remove key
						</button>
					</div>
				)}

				<label className="block">
					<span className="block text-xs mb-1" style={{ color: theme.colors.textDim }}>
						{status?.configured ? 'Replace API key' : 'DeepSeek API key'}
					</span>
					<input
						ref={inputRef}
						type="password"
						autoComplete="off"
						spellCheck={false}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								void connect();
							}
						}}
						placeholder="sk-…"
						className="w-full px-3 py-2 rounded border bg-transparent outline-none font-mono"
						style={{ borderColor: error ? theme.colors.error : theme.colors.border }}
						aria-invalid={Boolean(error)}
					/>
				</label>

				{saving && (
					<div className="flex items-center gap-2" style={{ color: theme.colors.textDim }}>
						<Spinner size={12} color={theme.colors.textDim} /> Checking the key with DeepSeek…
					</div>
				)}
				{error && (
					<p role="alert" style={{ color: theme.colors.error }}>
						{error}
					</p>
				)}
				{status && !status.encryptionAvailable && (
					<p style={{ color: theme.colors.warning }}>
						Secure storage is not available on this system, so the key cannot be saved.
					</p>
				)}

				<button
					type="button"
					onClick={() => openUrl(API_KEYS_URL)}
					className="flex items-center gap-1.5 text-xs hover:opacity-80"
					style={{ color: theme.colors.accent }}
				>
					<ExternalLink className="w-3 h-3" /> Get an API key at platform.deepseek.com
				</button>
			</div>
		</Modal>
	);
}
