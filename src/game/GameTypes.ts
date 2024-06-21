import { Object3D, Vector2, Vector3 } from "three";
import { BezierPath } from "./BezierPath";
import { FlowfieldViewer } from "./debug/FlowfieldViewer";
import { IUnit } from "./unit/IUnit";
import { RawResourceType, ResourceType } from "./GameDefinitions";
import { IBuildingInstance } from "./buildings/BuildingTypes";

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
    visual: Object3D;
    owner: IConveyor;
    mapCoords: Vector2;
    localT: number;
    type: RawResourceType | ResourceType;
}

export interface IRawResource {
    visual?: Object3D;
    instanceIndex?: number;
    type: RawResourceType;
    amount: number;
    liquidPatchId?: string;
}

export interface ICarriedResource {
    type: RawResourceType | ResourceType;    
    visual: Object3D;
    sourceCell: Vector2;
}

// export interface IPickableResource {
//     type: RawResourceType | ResourceType;    
//     visual: Object3D;
//     producer: string;
//     minedCell?: ICell;
// }

export interface IStraightRailConfig {
    length: number;
    rotation: number;
}

export interface ICurvedRailConfig {
    turnRadius: number;
    rotation: number;
    directionX: number;
}

export interface IRailConfig {
    type: "straight" | "curved";
    config: IStraightRailConfig | ICurvedRailConfig;
}

export interface IRail {
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
    visual?: Object3D;
    config?: IRailConfig;
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
    building?: IBuildingInstance;
    rail?: IRail;
    resource?: IRawResource;
    
    units?: IUnit[];
}

export interface ISector {
    cells: ICell[];
    cells2x2: Array<{
        units: IUnit[];
        building?: string;
    }>;

    root: Object3D;
    layers: {
        resources: Object3D;
        terrain: Object3D;
        buildings: Object3D;
        fx: Object3D;
    };
    textureData: {
        terrain: Uint8Array;
        highlight: Uint8Array;
    };

    flowfieldViewer: FlowfieldViewer;
}

export interface IRailUserData {    
    curve?: BezierPath;
    rotation: number;
    barInstanceIndex: number;
    barCount: number;
}

export interface IVector2 {
    x: number;
    y: number;
}

