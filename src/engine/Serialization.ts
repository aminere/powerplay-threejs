import { Color, Object3D, ObjectLoader, Vector2 } from "three";
import { Component, IComponentProps, IComponentState } from "./Component";
import { componentFactory } from "./ComponentFactory";
import { utils } from "./Utils";
import { TArray } from "./TArray";

class Serialization {

    private _loader = new ObjectLoader();

    public serialize(obj: Object3D, pretty = false) {        
        const data = obj.toJSON();
        if (pretty) {
            return JSON.stringify(data ?? "{}", null, 2);
        } else {
            return JSON.stringify(data ?? {});
        }
    }

    public deserialize(serialized: string, target?: Object3D) {
        const newInstance = this._loader.parse(JSON.parse(serialized));
        if (target) {
            const liveUserData = target.userData;
            target.copy(newInstance, false);
            target.userData = { 
            ...liveUserData,
                ...newInstance.userData
            };            
            this.postDeserializeObject(target);

            const { components } = target.userData;
            if (components && liveUserData.components) {
                for (const [key, value] of Object.entries(components)) {
                    const liveComponent = liveUserData.components[key];
                    const serializedInstance = value as Component<IComponentProps, IComponentState>;
                    const liveInstance = componentFactory.create(key, serializedInstance.props)!;
                    if (liveComponent) {
                        // keep the instance from the live component
                        // but assign to it fresh props from the serialized component
                        liveComponent.props = liveInstance.props;
                        components[key] = liveComponent;
                    } else {
                        components[key] = liveInstance
                    }
                }
            }

            return target;
        } else {
            this.postDeserialize(newInstance);
            return newInstance;
        }
    }

    public deserializeComponentProps(liveProps: IComponentProps, serializedProps: IComponentProps) {
        for (const [prop, value] of Object.entries(serializedProps)) {
            const instance = liveProps[prop as keyof typeof liveProps];
            if (instance === undefined) {
                continue;
            }
            const vec2 = instance as Vector2;
            const color = instance as Color;
            const array = instance as TArray<any>;            
            if (vec2.isVector2) {
                vec2.copy(value);
            } else if (color.isColor) {
                color.set(value);
            } else if (array.isArray) {
                array.copy(value);
            } else {
                Object.assign(liveProps, { [prop]: value });
            }
        }
    }

    public postDeserialize(obj: Object3D) {
        this.postDeserializeObject(obj);
        this.postDeserializeComponents(obj);
    }    

    private postDeserializeObject(obj: Object3D) {
        const mesh = obj as THREE.Mesh;
        const light = obj as THREE.DirectionalLight;
        if (mesh.isMesh) {
            const geometry = (obj as THREE.Mesh).geometry;
            if (geometry.type === "PlaneGeometry") {
                geometry.rotateX(-Math.PI / 2);
            }
        } else if (light.isDirectionalLight) {
            utils.updateDirectionalLightTarget(light);
        }

        const { eulerRotation } = obj.userData;
        if (eulerRotation) {
            obj.rotation.copy(eulerRotation);
        }
    }

    private postDeserializeComponents(obj: Object3D) {
        const { components } = obj.userData;
        if (components) {
            for (const [key, value] of Object.entries(components)) {
                const serializedInstance = value as Component<IComponentProps, IComponentState>;
                const instance = componentFactory.create(key, serializedInstance.props);
                if (instance) {
                    components[key] = instance;
                } else {
                    console.warn(`Unknown component ${key}`);
                    delete components[key];
                }                
            }
        }
    }
}

export const serialization = new Serialization();

