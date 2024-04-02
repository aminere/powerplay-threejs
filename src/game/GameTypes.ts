import { Object3D, Vector2, Vector3 } from "three";
import { BezierPath } from "./BezierPath";
import { FlowfieldViewer } from "./pathfinding/FlowfieldViewer";
import { IUnit } from "./unit/IUnit";
import { RawResourceType } from "./GameDefinitions";

export type RailTip = "start" | "end";
export type Axis = "x" | "z";

export interface IConveyor {
    visual: {
        instanceIndex?: number;
        mesh?: Object3D;
    };
    config: IConveyorConfig;
    items: IConveyorItem[];
}

export interface IConveyorConfig {
    direction: Vector2;
    startAxis: Axis;
    endAxis?: Axis;
}

export interface IConveyorItem {
    size: number;
    obj: Object3D;
    owner: IConveyor;
    mapCoords: Vector2;
    localT: number;
}

export interface IResource {
    visual: Object3D;
    type: RawResourceType;
    amount: number;
}

export interface ICell {
    id: string;
    flowFieldCost: number;    
    viewCount: number;
    isEmpty: boolean;
    isWalkable: boolean;
    hasUnits: boolean;

    roadTile?: number;
    conveyor?: IConveyor;
    buildingId?: string;
    resource?: IResource;
    rail?: {        
        axis: Axis;        
        tip: RailTip;
        worldPos: Vector3;
        mapCoords: Vector2;
        endCell?: ICell;
        neighbors?: {
            [key in Axis]: {
                [direction: string]: ICell;
            }
        };
        obj?: Object3D;
    };
    
    units?: IUnit[];
}

export interface ISector {
    cells: ICell[];

    root: Object3D;
    layers: {
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

