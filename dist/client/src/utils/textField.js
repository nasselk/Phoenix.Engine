const TEXT_FIELDS = "input, textarea, select, [contenteditable]";
export function isTextField(target) {
    return target instanceof Element && target.closest(TEXT_FIELDS) !== null;
}
