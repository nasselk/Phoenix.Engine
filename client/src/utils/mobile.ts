export type DeviceType = {
	readonly mobile: boolean;
	readonly tablet: boolean;
	readonly any: boolean;
};

export function isMobileDevice(): DeviceType {
	const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

	const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
	const tabletRegex = /iPad|Tablet|PlayBook|Kindle/i;

	const isMobile = mobileRegex.test(userAgent);
	const isTablet = tabletRegex.test(userAgent);

	return {
		mobile: isMobile,
		tablet: isTablet,
		any: isMobile || isTablet,
	};
}
