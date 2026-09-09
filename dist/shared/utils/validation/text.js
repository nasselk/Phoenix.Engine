import profanities from "./profanity.json" with { type: "json" };
const profanityPatterns = profanities.map((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<=(^|[\\s_\\-0-9]))${escaped}(?=([\\s_\\-0-9]|$))`, "ig");
});
const validationPatterns = [
    /[\x00-\x1F\x7F]/,
];
export default function validateText(text, length = Infinity) {
    let min = 0;
    let max = 0;
    if (Array.isArray(length)) {
        min = length[0];
        max = length[1];
    }
    else {
        max = length;
    }
    if (text.length < min || text.length > max) {
        return false;
    }
    for (const pattern of validationPatterns) {
        if (pattern.test(text)) {
            return false;
        }
    }
    return true;
}
export function censorText(text) {
    for (let i = 0; i < profanityPatterns.length; i++) {
        const pattern = profanityPatterns[i];
        text = text.replaceAll(pattern, "*".repeat(profanities[i].length));
    }
    return text;
}
