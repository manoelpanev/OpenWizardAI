import { defaultUrlTransform } from 'react-markdown';

/**
 * react-markdown's default urlTransform strips href schemes outside of
 * https/http/ircs/mailto/xmpp. Allow our internal protocols through so the
 * click handler receives them - without this, `openwizardai://`, `openwizardai-file://`,
 * `tel:`, and `file:` hrefs would arrive as empty strings.
 */
export function urlTransformAllowingOpenWizardAI(value: string): string {
	if (
		value.startsWith('openwizardai://') ||
		value.startsWith('openwizardai-file://') ||
		value.startsWith('file://') ||
		value.startsWith('tel:')
	) {
		return value;
	}
	return defaultUrlTransform(value);
}
