
import { Object3D, Vector2 } from "three";
import { ResourceType, RawResourceType } from "../GameDefinitions";
import { ICell } from "../GameTypes";

export const BuildingTypes = [
    "mine",
    "factory",
    "assembly",
    "incubator",
    "depot",
    "train-factory"
] as const;

export const BuildableTypes = [
    ...BuildingTypes,
    "road",
    "conveyor",
    "rail"
] as const;

export type BuildingType = typeof BuildingTypes[number];
export type BuildableType = typeof BuildableTypes[number];

export interface IIncubatorState {
    active: boolean;
    productionTimer: number;
    reserve: Map<RawResourceType | ResourceType, number>;
    inputTimer: number;
    inputFull: boolean;    
    outputRequests: number;

    water: Object3D;
    worker: Object3D;
}

export interface IFactoryState {
    active: boolean;
    productionTimer: number;
    reserve: Map<RawResourceType | ResourceType, number>;    
    inputTimer: number;
    inputFull: boolean;
    outputRequests: number;    

    output: ResourceType | null;
    outputFull: boolean;
    outputCheckTimer: number;
    autoOutput: boolean;
}

export interface IMineState {
    resourceCells: Vector2[];
    currentResourceCell: number;
    active: boolean;
    depleted: boolean;    
    timer: number;
    outputConveyorIndex: number;
    outputFull: boolean;
    minedCell?: ICell;
    outputCheckTimer: number;
}

export interface IDepotState {
    type: RawResourceType | ResourceType | null;
    amount: number;
    capacity: number;
    inputTimer: number;
    outputTimer: number;
}


export type TBuildingState = IFactoryState | IMineState | IDepotState | IIncubatorState;

export interface IBuildingInstance {
    id: string;
    buildingType: BuildingType;    
    visual: Object3D;
    mapCoords: Vector2;
    state: TBuildingState | null;
    deleted: boolean;
    hitpoints: number;
}

