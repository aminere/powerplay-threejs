import { Camera, Object3D, OrthographicCamera, PerspectiveCamera } from "three";
import { config } from "../game/config";
import { Component, IComponentProps } from "./Component";

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
            perspectiveCamera.aspect = width / height;
            perspectiveCamera.updateProjectionMatrix();
        }
    }

    public getComponent<U extends Component<IComponentProps>>(ctor: new () => U, owner: Object3D) {
        return owner.userData.components[ctor.name];
    }

    public setComponent<U extends Component<IComponentProps>>(owner: Object3D, component: U) {
        if (!("components" in owner.userData)) {
            owner.userData.components = {};
        }
        owner.userData.components[component.constructor.name] = component;
        component.start(owner);
    }    

    public createObject(parent: Object3D, name: string) {
        const obj = new Object3D();
        obj.name = name;
        parent.add(obj);
        return obj;
    }

    public isPointerLocked() {
        return Boolean(document.pointerLockElement);
    }
}

export const utils = new Utils();

