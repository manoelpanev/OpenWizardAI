import React from 'react';

// Import the conductor silhouette images
import conductorLight from '../assets/conductor-light.png';
import conductorDark from '../assets/conductor-dark.png';

interface OpenWizardAISilhouetteProps {
	className?: string;
	style?: React.CSSProperties;
	variant?: 'dark' | 'light'; // dark = black silhouette, light = white silhouette
	size?: number;
}

/**
 * OpenWizardAI conductor silhouette component
 * Uses PNG assets for the authentic conductor graphic
 * - dark variant: black silhouette (for light backgrounds)
 * - light variant: white silhouette (for dark backgrounds)
 */
export function OpenWizardAISilhouette({
	className = '',
	style = {},
	variant = 'dark',
	size = 200,
}: OpenWizardAISilhouetteProps) {
	const imageSrc = variant === 'dark' ? conductorDark : conductorLight;

	return (
		<img
			src={imageSrc}
			alt="OpenWizardAI conductor silhouette"
			className={className}
			style={{
				width: size,
				height: size,
				objectFit: 'contain',
				...style,
			}}
		/>
	);
}

/**
 * Animated openwizardai for the Standing Ovation overlay
 * Includes a subtle conducting motion animation via CSS
 */
export function AnimatedOpenWizardAI({
	className = '',
	style = {},
	variant = 'dark',
	size = 200,
}: OpenWizardAISilhouetteProps) {
	const imageSrc = variant === 'dark' ? conductorDark : conductorLight;

	return (
		<img
			src={imageSrc}
			alt="Animated openwizardai conductor"
			className={className}
			style={{
				width: size,
				height: size,
				objectFit: 'contain',
				animation: 'conductingMotion 2s ease-in-out infinite',
				...style,
			}}
		/>
	);
}

// Add the CSS animation to the document if not already present
if (typeof document !== 'undefined') {
	const styleId = 'openwizardai-animation-styles';
	if (!document.getElementById(styleId)) {
		const styleSheet = document.createElement('style');
		styleSheet.id = styleId;
		styleSheet.textContent = `
      @keyframes conductingMotion {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-3deg); }
        75% { transform: rotate(3deg); }
      }
    `;
		document.head.appendChild(styleSheet);
	}
}

export default OpenWizardAISilhouette;
