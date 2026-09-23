import { Quaternion } from "three";
import { configureTextBuilder, preloadFont as preloadTroikaFont, Text as TroikaText } from "troika-three-text";
const DEFAULTS = {
    anchorX: "center",
    anchorY: "middle",
    color: 0xffffff,
    outlineWidth: "6%",
    outlineColor: 0x000000,
};
const parentRotation = new Quaternion();
export class Text extends TroikaText {
    constructor(text = "", { billboard = false, ...options } = {}) {
        super();
        Object.assign(this, DEFAULTS, options);
        this.text = text;
        this.billboard = billboard;
    }
    onBeforeRender(renderer, scene, camera, geometry, material, group) {
        if (this.billboard) {
            camera.getWorldQuaternion(this.quaternion);
            if (this.parent !== null) {
                this.quaternion.premultiply(this.parent.getWorldQuaternion(parentRotation).invert());
            }
            this.updateMatrixWorld();
        }
        super.onBeforeRender(renderer, scene, camera, geometry, material, group);
    }
    destroy() {
        this.removeFromParent();
        this.dispose();
    }
}
export function preloadFont(font, characters = "") {
    return new Promise((resolve) => {
        preloadTroikaFont({ font, characters: typeof characters === "string" ? characters : [...characters] }, resolve);
    });
}
const LATIN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?'\"-_()[]";
export function fontLoader(characters = LATIN) {
    return {
        load: async (url) => {
            await preloadFont(url, characters);
            return url;
        },
    };
}
export function configureText(config) {
    configureTextBuilder(config);
}
