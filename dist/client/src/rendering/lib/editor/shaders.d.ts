export declare function fadeUniforms(distance: number, strength: number): {
    uFadeDistance: {
        value: number;
    };
    uFadeStrength: {
        value: number;
    };
};
export declare const FADE = "\n\tuniform float uFadeDistance, uFadeStrength;\n\n\tfloat fade(float away) {\n\t\treturn pow(1.0 - min(away / uFadeDistance, 1.0), uFadeStrength);\n\t}\n";
export declare const FOLLOW_VERTEX = "\n\tuniform float uFadeDistance;\n\tvarying vec3 vWorld;\n\n\tvoid main() {\n\t\tvec3 p = position * uFadeDistance * 2.0;\n\t\t// After the rotation, local Y is world -Z.\n\t\tp.x += cameraPosition.x;\n\t\tp.y -= cameraPosition.z;\n\t\tvec4 world = modelMatrix * vec4(p, 1.0);\n\t\tvWorld = world.xyz;\n\t\tgl_Position = projectionMatrix * viewMatrix * world;\n\t}\n";
//# sourceMappingURL=shaders.d.ts.map