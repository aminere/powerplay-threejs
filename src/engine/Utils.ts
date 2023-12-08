import { Camera, DirectionalLight, Object3D, ObjectLoader, OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { config } from "../game/config";
import { Component, IComponentInstance } from "./Component";
import { engine } from "./Engine";
import { ComponentProps } from "./ComponentProps";

class Utils {
    public updateCameraAspect(camera: Camera, width: number, height: number) {
        const orthoCamera = camera as OrthographicCamera;
        const perspectiveCamera = camera as PerspectiveCamera;
        const aspect = width / height;
        if (orthoCamera.isOrthographicCamera) {
            const { orthoSize } = config.camera;
            orthoCamera.left = -orthoSize * aspect;
            orthoCamera.right = orthoSize * aspect;
            orthoCamera.top = orthoSize;
            orthoCamera.bottom = -orthoSize;
            orthoCamera.updateProjectionMatrix();
        } else if (perspectiveCamera.isPerspectiveCamera) {
            perspectiveCamera.aspect = aspect;
            perspectiveCamera.updateProjectionMatrix();
        }
    }

    private _dummy = new Vector3();
    private _dummy2 = new Vector3();
    public updateDirectionalLightTarget(light: DirectionalLight) {
        const lightDir = light.getWorldDirection(this._dummy);        
        light.target.position.copy(light.getWorldPosition(this._dummy2)).sub(lightDir);
        light.target.updateMatrixWorld();
    }

    public getComponent<U extends Component<ComponentProps>>(ctor: new () => U, owner: Object3D) {
        return owner.userData.components?.[ctor.name];
    }

    public setComponent<U extends Component<ComponentProps>>(owner: Object3D, component: U) {
        if (!("components" in owner.userData)) {
            owner.userData.components = {};
        }
        owner.userData.components[component.constructor.name] = component;
        this.registerComponent(component, owner);
        component.start(owner);
    }

    public removeComponent<U extends Component<ComponentProps>>(owner: Object3D, ctor: new () => U) {
        const componentType = ctor.name;
        this.removeComponentByType(owner, componentType);
    }

    public removeComponentByType(owner: Object3D, componentType: string) {
        const instance = owner.userData.components?.[componentType] as Component<ComponentProps>;
        if (instance) {
            instance.dispose(owner);
            delete owner.userData.components[componentType];
            this.unregisterComponent(instance, owner);
        }
    }

    public getComponents<U extends Component<ComponentProps>>(ctor: new () => U) {
        return engine.components.get(ctor.name) as IComponentInstance<U>[];
    }

    public createObject(parent: Object3D, name: string) {
        const obj = new Object3D();
        obj.name = name;
        parent.add(obj);
        return obj;
    }

    public removeObject(obj: Object3D) {
        const unregisterComponents = (_obj: Object3D) => {
            const components = _obj.userData.components;
            if (components) {
                for (const value of Object.values(components)) {
                    const instance = value as Component<ComponentProps>;
                    instance.dispose(_obj);
                    this.unregisterComponent(instance, _obj);
                }
            }
        }
        obj.traverse(o => unregisterComponents(o));        
        obj.removeFromParent();
    }

    public disposeObject(obj: Object3D) {       
        const mesh = obj as THREE.Mesh;
        const line = obj as THREE.Line;
        if (mesh.isMesh) {
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        } else if (line.isLine) {
            line.geometry.dispose();
            if (Array.isArray(line.material)) {
                line.material.forEach(m => m.dispose());
            } else {
                line.material.dispose();
            }
        }
    }

    public registerComponent(component: Component<ComponentProps>, owner: Object3D) {
        const list = engine.components.get(component.constructor.name);
        if (list) {
            list.push({ owner, component });
        } else {
            engine.components.set(component.constructor.name, [{ owner, component }]);
        }
    }

    public unregisterComponent(component: Component<ComponentProps>, owner: Object3D) {
        const list = engine.components.get(component.constructor.name);
        if (list) {
            const index = list.findIndex(i => i.owner === owner);
            if (index >= 0) {
                list.splice(index, 1);
            }
        }
    }

    public async loadObject(path: string) {
        const response = await fetch(path);
        const data = await response.json();
        const object = new ObjectLoader().parse(data);
        return object;
    }

    public isPointerLocked() {
        return Boolean(document.pointerLockElement);
    }
}

export const utils = new Utils();

