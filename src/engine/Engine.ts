
import { ACESFilmicToneMapping, Camera, Object3D, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";
import { Serialization } from "./Serialization";
import { Component, IComponentProps } from "./Component";
import { TimeInternal } from "./Time";
import { registerComponents } from "../game/components/ComponentRegistration";
import { input } from "./Input";
import { pools } from "./Pools";

export interface ISceneInfo {
    mainCamera: Camera;
    cameras: Camera[];
}

class Engine {
    public get renderer() { return this._renderer; }
    public set scene(value: Scene | null) { this._scene = value; }
    public get scene() { return this._scene; }    
    
    private _renderer: WebGLRenderer | null = null;
    private _scene: Scene | null = null;
    private _sceneStarted = false;
    private _components = new Map<Object3D, Component<IComponentProps>[]>();

    public init(width: number, height: number) {
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

        input.init();
        registerComponents();
    }

    public dispose() {
        input.dispose();
    }

    public update() {
        TimeInternal.updateDeltaTime();
        pools.flush();
        input.update(this._renderer!.domElement.getBoundingClientRect());
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
                        (instance as Component<IComponentProps>).dispose();
                    }
                }

                // TODO dispose of 3D resources
            });
        }

        const scene = new ObjectLoader().parse(data) as Scene;
        this._scene = scene;
        this._sceneStarted = false;
        const cameras: THREE.Camera[] = [];  
        scene.traverse(obj => {
            Serialization.postDeserialize(obj);
            const camera = obj as THREE.Camera;
            if (camera.isCamera) {
                cameras.push(camera);
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
        this._components.clear();
        this._scene!.traverse(obj => {
            const { components } = obj.userData;
            if (components) {
                this._components.set(obj, Object.values(components).map(c => c as Component<IComponentProps>));
            }
        });

        if (!this._sceneStarted) {
            for (const [obj, components] of this._components) {
                for (const instance of components) {
                    instance.start(obj);
                }
            }
            this._sceneStarted = true;
        }

        for (const [obj, components] of this._components) {
            for (const instance of components) {
                instance.update(obj);
            }
        }
    }
}

export const engine = new Engine();

