import profanities from "./profanity.json" with { type: "json" };

/** What may stand on either side of a censored word: whitespace, `_`, `-` or a digit. Sticky, to test one character where it is. */
const SEPARATOR = /[\s_\-0-9]/y;

/** Each ASCII character's folded form, worked out once. */
const ASCII_FOLDS = Uint16Array.from({ length: 128 }, (_, code) => foldUnit(code));

/**
 * A UTF-16 unit as a case-insensitive regular expression compares it (`Canonicalize` in the spec, without
 * the `u` flag): upper-cased, unless that takes more than one unit or turns a non-ASCII unit into ASCII.
 */
function foldUnit(code: number): number {
	const upper = String.fromCharCode(code).toUpperCase();

	if (upper.length !== 1) {
		return code;
	}

	const folded = upper.charCodeAt(0);

	return code >= 128 && folded < 128 ? code : folded;
}

/** The text with every unit folded, the same length, so two folded strings are equal exactly where a case-insensitive match finds them equal. */
function fold(text: string): string {
	let folded = "";

	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);

		folded += String.fromCharCode(code < 128 ? ASCII_FOLDS[code]! : foldUnit(code));
	}

	return folded;
}

const profanityWords = profanities.map((word) => ({ folded: fold(word), stars: "*".repeat(word.length) }));

/** Whether a censored word may end or start next to `index`: the start or end of the text, or a separator. */
function isEdge(text: string, index: number): boolean {
	if (index < 0 || index >= text.length) {
		return true;
	}

	SEPARATOR.lastIndex = index;

	return SEPARATOR.test(text);
}

// Control characters and XSS patterns
const validationPatterns = [
	/[\x00-\x1F\x7F]/, // Control characters
];

export function normalizeText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function validateText(text: string, length: number | [number, number] = Infinity): boolean {
	let min = 0;
	let max = 0;

	if (Array.isArray(length)) {
		min = length[0];
		max = length[1];
	} else {
		max = length;
	}

	if (text.length < min || text.length > max) {
		// Length check
		return false;
	}

	// Check all patterns
	for (const pattern of validationPatterns) {
		if (pattern.test(text)) {
			return false;
		}
	}

	return true;
}

/**
 * Stars out every listed word standing on its own (between separators or the ends of the text), whatever
 * its case, one word of the list after the other, in order.
 */
export function censorText(text: string): string {
	let folded = fold(text);

	for (const { folded: word, stars } of profanityWords) {
		let index = folded.indexOf(word);

		if (index === -1) {
			continue;
		}

		let censored = "";
		let censoredFolded = "";
		let copied = 0;

		while (index !== -1) {
			const end = index + word.length;

			if (isEdge(folded, index - 1) && isEdge(folded, end)) {
				censored += text.slice(copied, index) + stars;
				censoredFolded += folded.slice(copied, index) + stars;
				copied = end;
				index = folded.indexOf(word, end);
			} else {
				index = folded.indexOf(word, index + 1);
			}
		}

		if (copied > 0) {
			text = censored + text.slice(copied);
			folded = censoredFolded + folded.slice(copied);
		}
	}

	return text;
}
