
import { ACESFilmicToneMapping, Camera, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";
import { Serialization } from "./Serialization";

class Engine {
    public get renderer() { return this._renderer; }
    public set scene(value: Scene | null) { this._scene = value; }
    public get scene() { return this._scene; }
    public set camera(value: Camera | null) { this._camera = value; }
    public get camera() { return this._camera; }
    public get cameras() { return this._cameras; }

    private _renderer: WebGLRenderer | null = null;
    private _scene: Scene | null = null;
    private _camera: Camera | null = null;
    private _cameras: Camera[] = [];

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
    }

    public update() {

    }

    public render() {
        this._renderer!.clear();
        this._renderer!.render(this._scene!, this._camera!);
    }

    public async loadScene(path: string) {
        const response = await fetch(path);
        const data = await response.json();
        this.parseScene(data);
    }

    public parseScene(data: object) {
        const scene = new ObjectLoader().parse(data) as Scene;
        this._scene = scene;

        this._cameras.length = 0;
        scene.traverse(obj => {
            if ((obj as THREE.Camera).isCamera) {
                this._cameras.push(obj as THREE.Camera);
            }
            Serialization.postDeserialize(obj);
        });

        this._camera = (() => {
            const { mainCamera } = scene.userData;
            if (mainCamera) {
                return this._cameras.find(c => c.uuid === mainCamera)!;
            } else if (this._cameras.length > 0) {
                return this._cameras[0];
            } else {
                return null;
            }
        })();        
        console.assert(this._camera !== null);
    }    
}

export const engine = new Engine();

