import { Object3D } from "three";
import { Component, ComponentProps } from "./Component";
import { componentFactory } from "./ComponentFactory";

export class Serialization {
    public static postDeserialize(obj: Object3D) {
        if ((obj as THREE.Mesh).isMesh) {
            const gemeotry = (obj as THREE.Mesh).geometry;
            if (gemeotry.type === "PlaneGeometry") {
                gemeotry.rotateX(-Math.PI / 2);
            }
        }        
        const { eulerRotation } = obj.userData;
        if (eulerRotation) {
            obj.rotation.copy(eulerRotation);
        }
        const { components } = obj.userData;
        if (components) {
            for (const [key, value] of Object.entries(components)) {
                const serializedInstance = value as Component<ComponentProps>;
                const instance = componentFactory.create(key, serializedInstance.props);
                components[key] = instance;
            }
        }
    }
}

