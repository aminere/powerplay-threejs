import { Object3D, Vector2 } from "three";
import { BezierPath } from "./BezierPath";
import { FlowfieldViewer } from "./pathfinding/FlowfieldViewer";

export type RailTip = "start" | "end";
export type Axis = "x" | "z";

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
    flowFieldCost: number;
    isEmpty: boolean;
    viewCount: number;
}

export interface ISector {
    cells: ICell[];

    root: Object3D;
    layers: {
        buildings: Object3D;
        resources: Object3D;
        terrain: Object3D;
        props: Object3D;
    };
    textureData: {
        terrain: Uint8Array;
        highlight: Uint8Array;
    };

    flowfieldViewer: FlowfieldViewer;
}

export interface IRail {    
    curve?: BezierPath;
    rotation: number;
}

