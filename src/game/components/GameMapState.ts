import { Box2, Camera, DirectionalLight, Object3D, Vector2, Vector3 } from "three";
import { IBuildingInstance, ICell, ISector } from "../GameTypes";
import { TileSector } from "../TileSelector";
import { Action } from "../GameDefinitions";

export interface IGameMapState {
    sectorsRoot: Object3D;
    sectors: Map<string, ISector>;
    sectorRes: number;
    bounds?: Box2;
    action: Action | null;
    initialDragAxis?: "x" | "z";
    previousRoad: Vector2[];
    previousRail: ICell[];
    cameraZoom: number;
    cameraAngleRad: number;
    cameraTween: gsap.core.Tween | null;
    cameraRoot: Object3D;
    cameraPivot: Object3D;
    camera: Camera;
    light: DirectionalLight;
    cameraBoundsAccessors: number[];
    cameraBounds: Vector3[];
    pressedKeys: Set<string>;
    previousTouchPos: Vector2;
    tileSelector: TileSector;
    selectedCellCoords: Vector2;
    touchStartCoords:  Vector2;
    touchHoveredCoords: Vector2;
    touchDragged: boolean;
    cursorOverUI: boolean;
    selectionInProgress: boolean;
    layers: {
        rails: Object3D;
        trains: Object3D;
        cars: Object3D;
        buildings: Object3D;
    },
    buildings: Map<string, IBuildingInstance>;
}

export class GameMapState {   
    public set instance(value: IGameMapState | null) { this._instance = value; }
    public get instance() { return this._instance!; }
    public get sectors() { return this._instance!.sectors; }
    public get action() { return this._instance!.action; }
    public get initialDragAxis() { return this._instance!.initialDragAxis; }
    public get layers() { return this._instance!.layers; }
    public get camera() { return this._instance!.camera; }
    public get previousRoad() { return this._instance!.previousRoad; }
    public get previousRail() { return this._instance!.previousRail; }
    public get selectionInProgress() { return this._instance!.selectionInProgress; }
    public get sectorRes() { return this._instance!.sectorRes; }
    public get cursorOverUI() { return this._instance!.cursorOverUI; }

    public set bounds(value: Box2 | undefined) { this._instance!.bounds = value; }  
    public set action(action: Action | null) { 
        this._instance!.action = action;        
    }    

    public set initialDragAxis(value: "x" | "z" | undefined) { this._instance!.initialDragAxis = value; }
    public set selectionInProgress(value: boolean) { this._instance!.selectionInProgress = value; }
    public set cursorOverUI(value: boolean) { 
        this._instance!.cursorOverUI = value;
        if (this._instance!.action) {
            this._instance!.tileSelector.visible = !value;
        }
    }
    
    private _instance: IGameMapState | null = null;
}

export const gameMapState = new GameMapState();

