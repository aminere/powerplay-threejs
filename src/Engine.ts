
import { ACESFilmicToneMapping, Camera, ObjectLoader, PCFSoftShadowMap, Scene, WebGLRenderer } from "three";

class Engine {
    public get renderer() { return this._renderer; }

    private _renderer: WebGLRenderer | null = null;
    private _scene: Scene | null = null;
    private _camera: Camera | null = null;

    public init(container: HTMLElement) {
        console.assert(this._renderer === null);
        const renderer = new WebGLRenderer({ alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = .8;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.autoClear = false;
        const { width, height } = container.getBoundingClientRect();
        renderer!.setSize(width, height, false);
        console.assert(container.children.length === 0);        
        container.appendChild(renderer.domElement);
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
    }    
}

export const engine = new Engine();

