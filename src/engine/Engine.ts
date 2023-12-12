
import { ACESFilmicToneMapping, AnimationClip, Camera, Object3D, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";
import { serialization } from "./Serialization";
import { Component, IComponentInstance } from "./Component";
import { input } from "./Input";
import { pools } from "./Pools";
import { time } from "./Time";
import { utils } from "./Utils";
import { ComponentProps } from "./ComponentProps";
import { registerComponents } from "../game/components/ComponentRegistration";

export interface ISceneInfo {
    mainCamera: Camera;
    cameras: Camera[];
}

type Runtime = "editor" | "game";

class Engine {
    public get renderer() { return this._renderer; }
    public set scene(value: Scene | null) { this._scene = value; }
    public get scene() { return this._scene; }    
    public get runtime() { return this._runtime; }
    public get screenRect() { return this._renderer!.domElement.getBoundingClientRect(); }
    public get components() { return this._componentsMap; }
    public get animations() { return this._animations; }
    
    private _renderer: WebGLRenderer | null = null;
    private _scene: Scene | null = null;
    private _sceneStarted = false;
    private _componentsMap = new Map<string, IComponentInstance<Component<ComponentProps>>[]>();
    private _runtime: Runtime = "game";
    private _animations = new Map<string, {
        owner: Object3D;
        clip: AnimationClip;
    }>();

    public init(width: number, height: number, runtime: Runtime) {
        console.assert(this._renderer === null);
        const renderer = new WebGLRenderer({ alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = .8;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.autoClear = false;
        renderer!.setSize(width, height, false);
        this._renderer = renderer;        
        this._runtime = runtime;
        registerComponents();
    }

    public dispose() {        
    }

    public update() {
        time.updateDeltaTime();
        pools.flush();
        input.update();
        this.updateComponents();
        input.postUpdate();
    }

    public render(camera: Camera) {
        this._renderer!.clear();
        this._renderer!.render(this._scene!, camera);
    }

    public async loadScene(path: string, onLoaded: (props: ISceneInfo) => void) {
        const response = await fetch(path);
        const data = await response.json();
        this.parseScene(data, onLoaded);
    }

    public parseScene(data: object, onParsed: (props: ISceneInfo) => void) {
        if (this._scene) {
            this._scene.traverse(obj => {
                const { components } = obj.userData;
                if (components) {
                    for (const instance of Object.values(components)) {
                        (instance as Component<ComponentProps>).dispose(obj);
                    }
                }
                utils.disposeObject(obj);
            });
        }

        const scene = new ObjectLoader().parse(data) as Scene;
        this._scene = scene;
        this._sceneStarted = false;
        const cameras: THREE.Camera[] = [];
        this._animations.clear();
        this._componentsMap.clear();
        scene.traverse(obj => {
            serialization.postDeserialize(obj);
            const camera = obj as THREE.Camera;
            if (camera.isCamera) {
                cameras.push(camera);
            }

            if (obj.animations) {
                for (const anim of obj.animations) {
                    const existing = this._animations.get(anim.name);
                    if (!existing) {
                        this._animations.set(anim.name, { owner: obj, clip: anim });
                    } else {
                        console.assert(false, `Anim '${anim.name}' (${obj.name}) ignored because it name-clashes with an existing anim.`);
                    }
                }
            }

            const { components } = obj.userData;
            if (components) {
                for (const value of Object.values(components)) {
                    utils.registerComponent(value as Component<ComponentProps>, obj);                    
                }
            }
        });

        let mainCamera: Camera | undefined = undefined;
        if (scene.userData.mainCamera) {
            mainCamera = cameras.find(c => c.uuid === scene.userData.mainCamera);
            if (!mainCamera && cameras.length > 0) {
                console.warn("No main camera found in scene, using first camera found");
                mainCamera = cameras[0];
            }
        } else if (cameras.length > 0) {
            mainCamera = cameras[0];
        }
        if (!mainCamera) {
            console.error("No camera found in scene");
        }        
        onParsed({ mainCamera: mainCamera!, cameras });       
    }    

    private updateComponents() {
        if (!this._sceneStarted) {
            for (const [, components] of this._componentsMap) {
                for (const instance of components) {
                    if (instance.component.props.active) {
                        instance.component.start(instance.owner);
                    }
                }
            }
            this._sceneStarted = true;
        }

        for (const [, components] of this._componentsMap) {
            for (const instance of components) {
                if (instance.component.props.active) {
                    instance.component.update(instance.owner);
                }
            }
        }
    }
}

export const engine = new Engine();

