import { describe, it, expect } from 'vitest';
import { buildImagePromptPrefix } from '../../../../main/process-manager/utils/imageUtils';

describe('imageUtils', () => {
	describe('buildImagePromptPrefix', () => {
		it('should return empty string for empty array', () => {
			expect(buildImagePromptPrefix([])).toBe('');
		});

		it('should return prefix with single image path', () => {
			const result = buildImagePromptPrefix(['/tmp/openwizardai-image-123-0.png']);
			expect(result).toBe('[Attached images: /tmp/openwizardai-image-123-0.png]\n\n');
		});

		it('should return prefix with multiple image paths', () => {
			const result = buildImagePromptPrefix([
				'/tmp/openwizardai-image-123-0.png',
				'/tmp/openwizardai-image-123-1.jpg',
			]);
			expect(result).toBe(
				'[Attached images: /tmp/openwizardai-image-123-0.png, /tmp/openwizardai-image-123-1.jpg]\n\n'
			);
		});

		it('should handle Windows-style paths', () => {
			const result = buildImagePromptPrefix([
				'C:\\Users\\test\\AppData\\Local\\Temp\\openwizardai-image-0.png',
			]);
			expect(result).toBe(
				'[Attached images: C:\\Users\\test\\AppData\\Local\\Temp\\openwizardai-image-0.png]\n\n'
			);
		});
	});
});
