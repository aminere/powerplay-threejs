
import { ACESFilmicToneMapping, Camera, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";
import { Serialization } from "./Serialization";

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
    }

    public update() {

    }

    public render(camera: Camera) {
        this._renderer!.clear();
        this._renderer!.render(this._scene!, camera);
    }

    public async loadScene(path: string) {
        const response = await fetch(path);
        const data = await response.json();
        this.parseScene(data);
    }

    public parseScene(data: object) {
        const scene = new ObjectLoader().parse(data) as Scene;
        this._scene = scene;        
        scene.traverse(obj => {
            Serialization.postDeserialize(obj);
        });
    }    
}

export const engine = new Engine();

