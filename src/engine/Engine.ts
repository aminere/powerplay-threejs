
import { ACESFilmicToneMapping, Camera, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";
import { registerComponents } from "../game/components/ComponentRegistration";
import { Component } from "./ecs/Component";
import { ComponentProps } from "./ecs/ComponentProps";
import { engineState } from "./EngineState";
import { input } from "./Input";
import { pools } from "./core/Pools";
import { serialization } from "./serialization/Serialization";
import { time } from "./core/Time";
import { utils } from "./Utils";
import { cmdRenderUI, cmdUpdateUI, evtScreenResized } from "../Events";

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
    public get screenRect() { return this._screenRect; }
    
    private _renderer: WebGLRenderer | null = null;
    private _scene: Scene | null = null;
    private _sceneStarted = false;
    private _runtime: Runtime = "game";
    private _screenRect = { left: 0, top: 0, width: 0, height: 0 };

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
    }

    public dispose() {        
    }

    public setScreenSize(width: number, height: number) {
        this._renderer!.setSize(width, height, false);
        this._screenRect = this._renderer!.domElement.getBoundingClientRect();
        evtScreenResized.post();
    }

    public update() {
        time.update();
        pools.flush();
        input.update();
        this.updateComponents();
        cmdUpdateUI.post();
        input.postUpdate();
    }

    public render(camera: Camera) {
        this._renderer!.clear();
        this._renderer!.render(this._scene!, camera);
        cmdRenderUI.post();
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
                        const component = instance as Component<ComponentProps>;
                        if (component.props.active) {
                            (instance as Component<ComponentProps>).dispose(obj);
                        }
                    }
                }
                utils.disposeObject(obj);
            });
        }

        const scene = new ObjectLoader().parse(data) as Scene;
        this._scene = scene;
        this._sceneStarted = false;
        const cameras: THREE.Camera[] = [];
        engineState.clear();        
        scene.traverse(obj => {
            serialization.postDeserializeObject(obj);
            serialization.postDeserializeComponents(obj);
            const camera = obj as THREE.Camera;
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
        onParsed({ mainCamera: mainCamera!, cameras });       
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

