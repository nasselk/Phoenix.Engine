/** The elements a person types in, where the browser's own behaviour is what they expect. */
const TEXT_FIELDS = "input, textarea, select, [contenteditable]";

/** Whether an event happened in something a person types in: keys pressed there are text, not controls. */
export function isTextField(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(TEXT_FIELDS) !== null;
}
