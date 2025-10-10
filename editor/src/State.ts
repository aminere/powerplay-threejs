import { Camera, DirectionalLight, Object3D, PerspectiveCamera, Scene } from "three";
import { OrbitControls, TransformControls } from "three/examples/jsm/Addons.js"; 
import { cmdSaveEditorCamera, evtEngineStatusChanged, evtObjectSelected, evtObjectTransformChanged, evtShowFPSChanged, evtShowStatsChanged } from "./Events";
import { undoRedo } from "./UndoRedo";
import { engine, serialization, utils, Component, ComponentProps } from "powerplay-lib";
import { ISerializedEditorCamera } from "./Types";

type EngineStatus = "stopped" | "running" | "paused" | "stopping";

class State {

    private _sceneLoadingInProgress = false;
    public get sceneLoadingInProgress() { return this._sceneLoadingInProgress; }
    public set sceneLoadingInProgress(value: boolean) { this._sceneLoadingInProgress = value; }

    public get transformInProgress() { return this._transformInProgress; }
    public set transformInProgress(value: boolean) { this._transformInProgress = value; }

    public get objectTransformed() { return this._objectTransformed; }
    public set objectTransformed(value: boolean) { this._objectTransformed = value; }

    public get cameraOrbitInProgress() { return this._cameraOrbitInProgress; }

    public get engineStatus() { return this._engineStatus; }
    public set engineStatus(value: EngineStatus) { 
        if (value !== this._engineStatus) {
            this._engineStatus = value; 
            evtEngineStatusChanged.post();
            this.onCameraPotentiallyChanged();
        }
    }

    public get camera() { return this._camera; }
    public set camera(value: Camera | null) { this._camera = value; }

    public get editorCamera() {
        if (!this._editorCamera) {            
            console.assert(!this._orbitControls);
            const savedState = localStorage.getItem("editorCamera");
            if (savedState) {
                const parsed = JSON.parse(savedState) as ISerializedEditorCamera;                
                this._editorCamera = serialization.deserialize(parsed.camera) as Camera;                
                this._orbitControls = new OrbitControls(this._editorCamera, engine.renderer!.domElement);
                this._orbitControls.target.copy(parsed.target);
                this._orbitControls.update();
            } else {
                this._editorCamera = new PerspectiveCamera();                
                this._editorCamera.position.set(0, 0, 10);   
                this._orbitControls = new OrbitControls(this._editorCamera, engine.renderer!.domElement);                 
            } 
            this._orbitControls.addEventListener("change", () => {
                this._cameraOrbitInProgress = true;
            });           
            this._orbitControls.addEventListener("end", () => {
                if (this._cameraOrbitInProgress) {
                    setTimeout(() => {
                        this._cameraOrbitInProgress = false;
                        cmdSaveEditorCamera.post();
                    }, 30);
                }
            });
        }
        return this._editorCamera; 
    }

    public get orbitControls() { return this._orbitControls!; }

    public get forceEditorCamera() { return this._forceEditorCamera; }
    public set forceEditorCamera(value: boolean) { 
        this._forceEditorCamera = value;
        this.onCameraPotentiallyChanged();
    }

    public get currentCamera() {
        if (this._engineStatus === "stopped") {
            return this.editorCamera;
        } else {
            if (this._forceEditorCamera) {
                return this.editorCamera;
            } else {
                return this._camera;
            }
        }
    }

    public get showStats() { return this._showStats; }
    public set showStats(value: boolean) { 
        this._showStats = value; 
        localStorage.setItem("showStats", value.toString());
        evtShowStatsChanged.post(value);
    }

    public get showFPS() { return this._showFPS; }
    public set showFPS(value: boolean) {
        this._showFPS = value;
        localStorage.setItem("showFPS", value.toString());
        evtShowFPSChanged.post(value);
    }

    public readonly editorScene = new Scene();    

    public get selection(): Object3D | null { return this._selection; }
    public set selection(value: Object3D | null) {
        if (value !== this._selection) {            
            evtObjectSelected.post(value);            
            if (value) {
                this.transformControls.attach(value);
            } else {
                this.transformControls.detach();
            }
            this._selection = value;
        }
    }

    public get transformControls() { 
        if (!this._transformControls) {
            const renderer = engine.renderer!;
            const controls = new TransformControls(this.currentCamera!, renderer.domElement);
            controls.space = "local";
            this.editorScene.add(controls);
            controls.addEventListener("mouseDown", () => {
                this._transformInProgress = true;
                console.assert(controls.object !== null);
                undoRedo.recordState(controls.object!);
                this._orbitControls!.enabled = false;
            });
            controls.addEventListener("objectChange", () => {
                this._objectTransformed = true;
                evtObjectTransformChanged.post()

                const light = controls.object as DirectionalLight;
                if (light.isDirectionalLight) {
                    utils.updateDirectionalLightTarget(light);
                }

                if (controls.mode === "rotate") {
                    controls.object!.userData.eulerRotation = controls.object!.rotation.clone();
                }
            });            
            this._transformControls = controls;
        }
        return this._transformControls;
    }

    public get componentClipboard() { return this._componentClipboard; }
    public setComponentClipboard(component: Component<ComponentProps>) {
        const typeName = component.constructor.name;
        this._componentClipboard = {
            typeName,
            data: JSON.stringify(component.props)
        };
    }

    public updateOrbitControlsStatus() {
        if (this._engineStatus === "stopped") {            
            this._orbitControls!.enabled = true;
        } else {
            this._orbitControls!.enabled = this._forceEditorCamera;            
        }        
    }

    private onCameraPotentiallyChanged() {
        this.updateOrbitControlsStatus();
        this.transformControls.camera = this.currentCamera!;
        const { width, height } = engine.renderer!.domElement.parentElement!.getBoundingClientRect();
        utils.updateCameraAspect(this.currentCamera!, width, height);
    }
    
    private _selection: Object3D | null = null;
    private _transformControls: TransformControls | null = null;
    private _orbitControls: OrbitControls | null = null;
    private _transformInProgress = false;
    private _cameraOrbitInProgress = false;
    private _objectTransformed = false;
    private _engineStatus: EngineStatus = "stopped";
    private _camera: Camera | null = null;
    private _editorCamera: Camera | null = null;
    private _forceEditorCamera = false;
    private _showStats = (localStorage.getItem("showStats") ?? "true") === "true";
    private _showFPS = (localStorage.getItem("showFPS") ?? "true") === "true";
    private _componentClipboard: { typeName: string; data: string; } | null = null;
}

export const state = new State();

