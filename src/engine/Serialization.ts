import { Object3D, ObjectLoader } from "three";
import { Component, IComponentState } from "./Component";
import { componentFactory } from "./ComponentFactory";
import { utils } from "./Utils";
import { ComponentProps } from "./ComponentProps";

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
                    const serializedInstance = value as Component<ComponentProps, IComponentState>;
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
                const serializedInstance = value as Component<ComponentProps, IComponentState>;
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

