
import { Object3D, Vector2, Vector3 } from "three";
import { ResourceType, RawResourceType, ProductType } from "../GameDefinitions";
import { ICell } from "../GameTypes";

export const BuildingTypes = [
    "hq",
    "mine",
    "factory",
    "assembly",
    "incubator",
    "depot"
] as const;

export type BuildingType = typeof BuildingTypes[number];

export interface IFactoryState {
    input: RawResourceType | ResourceType;
    output: ResourceType;

    inputReserve: number;
    inputCapacity: number;
    inputTimer: number;
    active: boolean;
    timer: number;

    outputFull: boolean;
    outputCheckTimer: number;
}

export interface IAssemblyState {
    inputs: Array<RawResourceType | ResourceType>;
    output: ProductType;
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
    type: RawResourceType | ResourceType;
    amount: number;
    capacity: number;
    inputTimer: number;
    outputTimer: number;
}

export interface IIncubatorState {
    active: boolean;
    progress: number;
}

export type TBuildingState = IFactoryState | IAssemblyState | IMineState | IDepotState | IIncubatorState;

export interface IBuildingInstance {
    id: string;
    buildingType: BuildingType;    
    visual: Object3D;
    mapCoords: Vector2;
    state: TBuildingState | null;
    deleted: boolean;
}

export const buildingSizes: Record<BuildingType, Vector3> = {
    "mine": new Vector3(3, 2, 3),
    "factory": new Vector3(5, 3, 4),
    "hq": new Vector3(10, 4, 5),    
    "assembly": new Vector3(6, 4, 5),
    "incubator": new Vector3(1, 3, 1),
    "depot": new Vector3(4, 1, 4)
};

