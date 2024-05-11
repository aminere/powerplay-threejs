
import { Object3D, Vector2 } from "three";
import { ResourceType, RawResourceType, MineralType, VehicleType } from "../GameDefinitions";

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
    active: boolean;
    productionTimer: number;

    outputRequests: number;
    outputFull: boolean;    
    outputCheckTimer: number;
    autoOutput: boolean;

    depleted: boolean;
    resourceCells: Vector2[];
    minedResource: MineralType | null;
}

export interface IDepotState {
    type: RawResourceType | ResourceType | null;
    amount: number;
    capacity: number;
    inputTimer: number;
    outputTimer: number;
}

export interface IAssemblyState {
    active: boolean;
    productionTimer: number;
    reserve: Map<RawResourceType | ResourceType, number>;    
    inputTimer: number;
    inputFull: boolean;
    output: VehicleType | null;
    outputRequests: number;    
}

export type TBuildingState = IFactoryState | IMineState | IDepotState | IIncubatorState | IAssemblyState;

export interface IBuildingInstance {
    id: string;
    buildingType: BuildingType;    
    visual: Object3D;
    mapCoords: Vector2;
    state: TBuildingState | null;
    deleted: boolean;
    hitpoints: number;
}

