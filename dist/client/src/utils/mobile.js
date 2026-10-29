const TABLET = /iPad|Tablet|PlayBook|Silk|Kindle|KF[A-Z]{2,4}\b/i;
const PHONE = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|BB10|IEMobile|Windows Phone|Opera Mini|Mobile/i;
const TABLET_MIN_SIDE = 600;
export function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || "";
    const touchPoints = navigator.maxTouchPoints || 0;
    const finger = touchPoints > 0 && typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const iPadOS = /Macintosh/i.test(userAgent) && touchPoints > 1;
    const namedTablet = iPadOS || TABLET.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
    const namedPhone = !namedTablet && (PHONE.test(userAgent) || navigator.userAgentData?.mobile === true);
    const unnamed = finger && !namedTablet && !namedPhone;
    const large = typeof screen !== "undefined" && Math.min(screen.width, screen.height) >= TABLET_MIN_SIDE;
    const tablet = namedTablet || (unnamed && large);
    const mobile = namedPhone || (unnamed && !large);
    return { mobile, tablet, any: mobile || tablet };
}
//# sourceMappingURL=mobile.js.map