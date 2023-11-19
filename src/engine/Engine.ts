
import { ACESFilmicToneMapping, Camera, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";
import { Serialization } from "./Serialization";
import { Component, ComponentProps } from "./Component";
import { TimeInternal } from "./Time";
import { registerComponents } from "../game/components/ComponentRegistration";

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
        
        registerComponents();
    }

    public update() {
        TimeInternal.updateDeltaTime();
        this._scene!.traverse(obj => {
            const { components } = obj.userData;
            if (components) {
                for (const instance of Object.values(components)) {
                    (instance as Component<ComponentProps>).update(obj);
                }
            }
        });
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
                        (instance as Component<ComponentProps>).dispose();
                    }
                }

                // TODO dispose of 3D resources
            });
        }

        const scene = new ObjectLoader().parse(data) as Scene;
        this._scene = scene;
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
}

export const engine = new Engine();

