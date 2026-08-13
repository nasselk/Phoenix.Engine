export function getRandomColor(r: boolean = true, g: boolean = true, b: boolean = true, alpha: boolean = false): string {
	const colors = "0123456789ABCDEF";

	function randomChannel(enabled: boolean = true): string {
		if (!enabled) return "00";
		return colors[Math.floor(Math.random() * 16)] + colors[Math.floor(Math.random() * 16)];
	}

	let color = "#";

	color += randomChannel(r);
	color += randomChannel(g);
	color += randomChannel(b);

	if (alpha) {
		color += randomChannel();
	}

	return color;
}

export function hexToRgba(hex: string, alpha: number = 1): string {
	if (hex.startsWith("#")) {
		hex = hex.slice(1);
	}

	if (hex.length === 3) {
		hex = hex
			.split("")
			.map((c) => c + c)
			.join("");
	}

	// Handle 8-character hex (with alpha)
	if (hex.length === 8) {
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		const a = parseInt(hex.slice(6, 8), 16) / 255; // Convert to 0-1 range
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	const r = parseInt(hex.slice(0, 2), 16);
	const g = parseInt(hex.slice(2, 4), 16);
	const b = parseInt(hex.slice(4, 6), 16);

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function rgbaToHex(rgba: string): string {
	const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
	if (!match) return "";

	const r = parseInt(match[1]).toString(16).padStart(2, "0");
	const g = parseInt(match[2]).toString(16).padStart(2, "0");
	const b = parseInt(match[3]).toString(16).padStart(2, "0");

	return `#${r}${g}${b}`;
}

export function isRGBA(rgba: string): boolean {
	const regex = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/;

	return regex.test(rgba);
}

export function isHexColor(hex: string): boolean {
	const regex = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

	return regex.test(hex);
}

export function extractRGBA(rgba: string): { r: number; g: number; b: number; a: number } | null {
	const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
	if (!match) return null;

	const r = parseInt(match[1]);
	const g = parseInt(match[2]);
	const b = parseInt(match[3]);
	const a = match[4] ? parseFloat(match[4]) : 1;

	// Validate ranges
	if (r > 255 || g > 255 || b > 255 || a > 1 || r < 0 || g < 0 || b < 0 || a < 0) {
		return null;
	}

	return { r, g, b, a };
}
