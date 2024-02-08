import { AnimationAction, Camera, DirectionalLight, LoopOnce, LoopPingPong, LoopRepeat, Object3D, ObjectLoader, OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { config } from "../game/config";
import { Component } from "./ecs/Component";
import { ComponentProps } from "./ecs/ComponentProps";
import { TArray } from "./serialization/TArray";
import { LoopMode } from "./serialization/Types";

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
        return owner.userData.components?.[ctor.name] as U | undefined;
    }

    public createObject(parent: Object3D, name: string) {
        const obj = new Object3D();
        obj.name = name;
        parent.add(obj);
        return obj;
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

    public async loadObject(path: string) {
        const response = await fetch(path);
        const data = await response.json();
        const object = new ObjectLoader().parse(data);
        return object;
    }

    public isPointerLocked() {
        return Boolean(document.pointerLockElement);
    }

    public MakeStrArray(values: string[]) {
        const array = new TArray(String);
        for (const value of values) {
            array.grow(new String(value));
        }
        return array;
    }

    public setLoopMode(_action: AnimationAction, loopMode: LoopMode, repetitions: number) {
        switch (loopMode) {
            case "Once": {
                _action.setLoop(LoopOnce, 1);
                _action.clampWhenFinished = true;

                const mixer = _action.getMixer();
                const onFinished = ({ action }: { action: AnimationAction }) => {
                    if (_action === action) {
                        action.paused = true;
                        mixer.removeEventListener("finished", onFinished);
                    }
                }
                mixer.addEventListener("finished", onFinished);
            } break;
            case "Repeat": _action.setLoop(LoopRepeat, repetitions); break;
            case "PingPong": _action.setLoop(LoopPingPong, repetitions); break;
        }
    }

    public fastDelete<T>(array: T[], index: number) {
        console.assert(index >= 0 && index < array.length);
        const lastElem = array[array.length - 1];
        array[index] = lastElem;
        array.length--;
    }
}

export const utils = new Utils();

