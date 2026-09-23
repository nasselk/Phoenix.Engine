export function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
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
