
import { Object3D, Vector2, Vector3 } from "three";
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

export type BuildingType = typeof BuildingTypes[number];

export interface IFactoryState {
    output: ResourceType | null;
    reserve: Map<RawResourceType | ResourceType, number>;
    
    inputTimer: number;
    active: boolean;
    productionTimer: number;

    outputFull: boolean;
    outputCheckTimer: number;
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

export interface IIncubatorState {
    active: boolean;
    progress: number;
    amount: {
        coal: number;
        water: number;
    };
    water: Object3D;
    worker: Object3D;
}

export type TBuildingState = IFactoryState | IMineState | IDepotState | IIncubatorState;

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
    "assembly": new Vector3(6, 4, 5),
    "incubator": new Vector3(1, 3, 1),
    "depot": new Vector3(4, 1, 4),
    "train-factory": new Vector3(8, 4, 5)
};

