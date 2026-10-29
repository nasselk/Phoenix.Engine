export type DeviceType = {
	readonly mobile: boolean;
	readonly tablet: boolean;
	readonly any: boolean;
};

const TABLET = /iPad|Tablet|PlayBook|Silk|Kindle|KF[A-Z]{2,4}\b/i;
const PHONE = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|BB10|IEMobile|Windows Phone|Opera Mini|Mobile/i;

/** The smallest side, in CSS pixels, of a touch screen that counts as a tablet rather than a phone. */
const TABLET_MIN_SIDE = 600;

/**
 * Whether this is a phone or a tablet. The user agent names most of them; iPads on iPadOS 13 and
 * later say "Macintosh", and other touch devices (an Android tablet asking for desktop sites, a
 * Windows tablet) name nothing, so a touch screen whose main pointer is a finger counts too, as a
 * tablet when its smallest side is TABLET_MIN_SIDE or more.
 */
export function isMobileDevice(): DeviceType {
	const userAgent: string = navigator.userAgent || navigator.vendor || "";
	const touchPoints = navigator.maxTouchPoints || 0;
	const finger = touchPoints > 0 && typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

	const iPadOS = /Macintosh/i.test(userAgent) && touchPoints > 1;
	const namedTablet = iPadOS || TABLET.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
	const namedPhone = !namedTablet && (PHONE.test(userAgent) || (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile === true);

	const unnamed = finger && !namedTablet && !namedPhone;
	const large = typeof screen !== "undefined" && Math.min(screen.width, screen.height) >= TABLET_MIN_SIDE;

	const tablet = namedTablet || (unnamed && large);
	const mobile = namedPhone || (unnamed && !large);

	return { mobile, tablet, any: mobile || tablet };
}
