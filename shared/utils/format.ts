/** Fill a text's `{name}` placeholders: `format("Room {code} is full", { code })`. A placeholder with no value stays as it is. */
export function format(template: string, values: Readonly<Record<string, string | number>>): string {
	return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => (name in values ? String(values[name]) : placeholder));
}
