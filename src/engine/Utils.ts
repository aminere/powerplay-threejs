import { AmbientLight, AnimationAction, Camera, DirectionalLight, Line, LoopOnce, LoopPingPong, LoopRepeat, MathUtils, Mesh, Object3D, ObjectLoader, OrthographicCamera, PerspectiveCamera, Scene, Vector3 } from "three";
import { config } from "../game/config/config";
import { Component } from "./ecs/Component";
import { ComponentProps } from "./ecs/ComponentProps";
import { TArray } from "./serialization/TArray";
import { LoopMode } from "./serialization/Types";
import { serialization } from "./serialization/Serialization";
import { engineState } from "./EngineState";
import gsap from "gsap";

const lightDir = new Vector3();
const worldPos = new Vector3();

class Utils {
    public getBasePath() {
        return '/prototype/';
    }

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

    public updateDirectionalLightTarget(light: DirectionalLight) {
        light.getWorldDirection(lightDir);
        light.getWorldPosition(worldPos);
        light.target.position.subVectors(worldPos, lightDir);
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
        const mesh = obj as Mesh;
        const line = obj as Line;
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

    public makeStrArray(values: string[]) {
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
        const newLength = array.length - 1;
        const lastElem = array[newLength];
        array[index] = lastElem;
        array.length = newLength;
    }

    public isPointInRect(x: number, y: number, rect: DOMRect) {
        return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
    }

    public createNewScene(name: string) {
        const scene = new Scene();
        scene.name = name;
        const camera = new PerspectiveCamera();
        camera.position.set(4, 3, 4);
        camera.rotation.set(MathUtils.degToRad(-30), MathUtils.degToRad(45), 0, 'YXZ');
        camera.userData.eulerRotation = camera.rotation.clone();
        scene.add(camera);
        const ambient = new AmbientLight(0xffffff, .2);
        scene.add(ambient);
        scene.updateWorldMatrix(true, true);
        return scene;
    }

    public instantiate(prefab: Object3D) {
        const instance = prefab.clone();
        instance.traverse(o => {
            serialization.postDeserializeObject(o);
            serialization.postDeserializeComponents(o);
            const components = o.userData.components;
            if (components) {
                for (const component of Object.values(components)) {
                    const instance = component as Component<ComponentProps>;
                    instance.start(o);
                    engineState.registerComponent(instance, o);
                }
            }
        });
        return instance;
    }

    public postpone(delay: number, cb: () => void) {
        return gsap.delayedCall(delay, cb);
    }
}

export const utils = new Utils();

