export function applyRequestOptions(loader, { crossOrigin, headers }) {
    if (crossOrigin !== undefined) {
        loader.setCrossOrigin(crossOrigin);
    }
    if (headers !== undefined) {
        loader.setRequestHeader({ ...headers });
    }
}
