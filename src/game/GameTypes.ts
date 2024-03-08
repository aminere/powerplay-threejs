import { Object3D, Vector2, Vector3 } from "three";
import { BezierPath } from "./BezierPath";
import { FlowfieldViewer } from "./pathfinding/FlowfieldViewer";
import { IUnit } from "./unit/IUnit";

export type RailTip = "start" | "end";
export type Axis = "x" | "z";

export interface IBuildingInstance {
    id: string;
    buildingId: string;
    obj: Object3D;
    mapCoords: Vector2;
}

export interface IConveyorConfig {
    direction: Vector2;
    startAxis: Axis;
}

interface IConveyorItem {
    size: number;
    obj: Object3D;
}

export interface ICell {
    id: string;
    roadTile?: number;
    previewRoadTile?: number;
    conveyor?: {
        instanceIndex: number;
        mesh?: Object3D;
        config?: IConveyorConfig;
        items: IConveyorItem[];
    };
    previewConveyor?: boolean;

    buildingId?: string;
    resource?: Object3D;
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
    
    units: IUnit[];
    flowFieldCost: number;
    isEmpty: boolean;
    viewCount: number;
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

