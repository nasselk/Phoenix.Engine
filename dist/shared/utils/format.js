export function format(template, values) {
    return template.replace(/\{(\w+)\}/g, (placeholder, name) => (name in values ? String(values[name]) : placeholder));
}
//# sourceMappingURL=format.js.map