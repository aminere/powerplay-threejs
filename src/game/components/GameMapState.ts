import { Box2, Camera, DirectionalLight, Object3D, Vector2, Vector3 } from "three";
import { Action, ICell, ISector } from "../GameTypes";
import { TileSector } from "../TileSelector";

export interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
    action: Action | null;
    initialDragAxis?: "x" | "z";
    previousRoad: Vector2[];
    previousRail: ICell[];
    owner: Object3D;
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
}

export class GameMapState {
    public set instance(value: IGameMapState) { this._instance = value; }
    public get instance() { return this._instance; }
    public get sectors() { return this._instance.sectors; }
    public get owner() { return this._instance.owner; }
    public get action() { return this._instance.action; }
    public get initialDragAxis() { return this._instance.initialDragAxis; }

    public set bounds(value: Box2 | undefined) { this._instance.bounds = value; }  
    public set action(value: Action | null) { this._instance.action = value; }    
    public set initialDragAxis(value: "x" | "z" | undefined) { this._instance.initialDragAxis = value; }
    
    private _instance!: IGameMapState;
}

export const gameMapState = new GameMapState();

