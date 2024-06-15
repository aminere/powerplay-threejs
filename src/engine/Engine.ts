
import { ACESFilmicToneMapping, Camera, Mesh, MeshStandardMaterial, ObjectLoader, PCFSoftShadowMap, Quaternion, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { registerComponents } from "../game/components/ComponentRegistration";
import { Component } from "./ecs/Component";
import { ComponentProps } from "./ecs/ComponentProps";
import { engineState } from "./EngineState";
import { input } from "./Input";
import { serialization } from "./serialization/Serialization";
import { time } from "./core/Time";
import { utils } from "./Utils";
import { cmdRenderUI, cmdUpdateUI, evtSceneCreated, evtScreenResized } from "../Events";
import gsap from "gsap";

export interface ISceneInfo {
    name: string;
    mainCamera: Camera;
    cameras: Camera[];
}

type Runtime = "editor" | "game";

class Engine {
    public get renderer() { return this._renderer; }
    public set scene(value: Scene | null) { this._scene = value; }
    public get scene() { return this._scene; }    
    public get runtime() { return this._runtime; }
    public get screenRect() { return this._screenRect; }
    public set paused(value: boolean) { this._paused = value; }
    public get paused() { return this._paused; }
    
    private _renderer: WebGLRenderer | null = null;
    private _scene: Scene | null = null;
    private _sceneStarted = false;
    private _runtime: Runtime = "game";
    private _screenRect = { left: 0, top: 0, width: 0, height: 0 };
    private _paused = false;
    private _loader = new ObjectLoader();

    public init(width: number, height: number, runtime: Runtime) {
        console.assert(this._renderer === null);
        const renderer = new WebGLRenderer({ alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = .8;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.autoClear = false;        
        this._renderer = renderer;        
        this._runtime = runtime;
        this.setScreenSize(width, height);
        registerComponents();
        gsap.ticker.remove(gsap.updateRoot);
    }

    public setScreenSize(width: number, height: number) {
        this._renderer!.setSize(width, height, false);
        this._screenRect = this._renderer!.domElement.getBoundingClientRect();
        evtScreenResized.post();
    }

    public update() {        
        time.update();

        if (this._paused) {
            input.update();
            input.postUpdate();
            return;
        }
        
        time.advance();
        gsap.updateRoot(time.time);

        input.update();
        this.updateComponents();

        cmdUpdateUI.post();
        input.postUpdate();
    }

    public render(camera: Camera) {
        this._renderer!.clear();
        
        // needed by billboards and instanced particles
        if (!camera.userData.worldRotation) {
            camera.userData.worldRotation = new Quaternion();
        }
        camera.getWorldQuaternion(camera.userData.worldRotation);

        this._renderer!.render(this._scene!, camera);
    }

    public renderUI() {
        cmdRenderUI.post();
    }

    public async loadScene(path: string) {
        const response = await fetch(path);
        const data = await response.json();
        this.parseScene(data);
    }

    public parseScene(data: object) {
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

        const scene = this._loader.parse(data) as Scene;
        this._scene = scene;
        this._sceneStarted = false;
        const cameras: Camera[] = [];
        engineState.clear();        
        scene.traverse(obj => {
            serialization.postDeserializeObject(obj);
            serialization.postDeserializeComponents(obj);
            const camera = obj as Camera;
            if (camera.isCamera) {
                cameras.push(camera);
            }

            engineState.registerAnimations(obj);

            const { components } = obj.userData;
            if (components) {
                for (const value of Object.values(components)) {
                    engineState.registerComponent(value as Component<ComponentProps>, obj);                    
                }
            }
        });

        const mainCamera = (() => {
            if (scene.userData.mainCamera) {
                const camera = cameras.find(c => c.uuid === scene.userData.mainCamera);
                if (camera) {
                    return camera;
                } else if (cameras.length > 0) {
                    console.warn("No main camera found in scene, using first camera found");
                    return cameras[0];
                }
            } else if (cameras.length > 0) {
                return cameras[0];
            }
        })();        
        if (!mainCamera) {
            console.error("No camera found in scene");
        }
        
        evtSceneCreated.post({ 
            name: scene.name,
            mainCamera: mainCamera!, 
            cameras 
        });
    }

    private updateComponents() {
        const componentsMap = engineState.components;
        if (!this._sceneStarted) {
            for (const [, components] of componentsMap) {
                for (const instance of components) {
                    if (instance.component.props.active) {
                        instance.component.start(instance.owner);
                    }
                }
            }
            this._sceneStarted = true;
        }

        engineState.handleComponentsToRegister();

        for (const [, components] of componentsMap) {
            for (const instance of components) {
                if (instance.component.props.active) {
                    instance.component.update(instance.owner);
                }
            }
        }
    }
}

export const engine = new Engine();

