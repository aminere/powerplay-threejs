import { Object3D, Vector2, type WebGLRenderer } from "three";
import { BezierPath } from "./BezierPath";

export interface IGameContext {
    action?: Action;
}

export interface IGame {
    onResize: () => void;
    start: () => void;
    stop: () => void;
    setCursorPos: (x: number, y: number) => void;
    setCursorInsideScreen: (inside: boolean) => void;
    setCursorOverUI: (over: boolean) => void;
    get currentContext(): IGameContext;
    get renderer(): WebGLRenderer;
}

export enum GameState {
    Intro,
    Game  
}

export type RailTip = "start" | "end";

export interface ICell {
    roadTile?: number;
    building?: THREE.Object3D;
    rail?: {        
        axis: Axis;        
        tip: RailTip;
        worldPos: THREE.Vector3;
        mapCoords: Vector2;
        endCell?: ICell;
        neighbors?: {
            [key in Axis]: {
                [direction: string]: ICell;
            }
        };
        obj?: THREE.Object3D;        
    };
    
    unit?: THREE.Object3D;
}

export interface ISector {
    cells: ICell[];
    layers: {
        buildings: Object3D;
        terrain: Object3D;
        rails: Object3D;
        trains: Object3D;
        cars: Object3D;
    }
    textureData: {
        terrain: Uint8Array;
        highlight: Uint8Array;
    }
}

export interface IRail {    
    curve?: BezierPath;
    rotation: number;
}

export type Axis = "x" | "z";

export const Actions = [
    "elevation", 
    "road", 
    "building", 
    "rail", 
    "belt",
    "unit",
    "car",
    "train"
] as const;
export type Action = typeof Actions[number];


