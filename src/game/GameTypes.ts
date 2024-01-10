import { Object3D, Vector2 } from "three";
import { BezierPath } from "./BezierPath";

export type RailTip = "start" | "end";
export type Axis = "x" | "z";

export interface IFlowField {
    integrations: number[];
    directions: [Vector2, boolean][];
}

export interface ICell {
    roadTile?: number;

    building?: THREE.Object3D;
    resource?: THREE.Object3D;
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
    flowField: IFlowField;
    isEmpty: boolean;
}

export interface ISector {
    cells: ICell[];
    layers: {
        buildings: Object3D;
        resources: Object3D;
        terrain: Object3D;        
    };
    textureData: {
        terrain: Uint8Array;
        highlight: Uint8Array;
    };    
    flowFieldCosts: number[];
}

export interface IRail {    
    curve?: BezierPath;
    rotation: number;
}

