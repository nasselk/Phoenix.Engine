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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9iaWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vY2xpZW50L3NyYy91dGlscy9tb2JpbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBTUEsTUFBTSxVQUFVLGNBQWM7SUFDN0IsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFLLE1BQWMsQ0FBQyxLQUFLLENBQUM7SUFFbkYsTUFBTSxXQUFXLEdBQUcsZ0VBQWdFLENBQUM7SUFDckYsTUFBTSxXQUFXLEdBQUcsOEJBQThCLENBQUM7SUFFbkQsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUM3QyxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBRTdDLE9BQU87UUFDTixNQUFNLEVBQUUsUUFBUTtRQUNoQixNQUFNLEVBQUUsUUFBUTtRQUNoQixHQUFHLEVBQUUsUUFBUSxJQUFJLFFBQVE7S0FDekIsQ0FBQztBQUNILENBQUMifQ==