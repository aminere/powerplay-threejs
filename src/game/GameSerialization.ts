import { Vector2 } from "three";
import { Axis, IConveyorConfig, IRailConfig } from "./GameTypes";
import { BuildingType } from "./buildings/BuildingTypes";
import { RawResourceType, ResourceType, UnitType } from "./GameDefinitions";

export interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: RawResourceType;
    units?: UnitType[];
    conveyor?: IConveyorConfig;
}

export interface ISerializedElevation {
    vertexIndex: number;
    height: number;
}

export interface ISerializedSector {
    key: string;
    cells: ISerializedCell[];
    elevation: ISerializedElevation[];
}

interface ISerializedBuilding {
    mapCoords: Vector2;
}

export interface ISerializedFactory extends ISerializedBuilding {
    input: RawResourceType | ResourceType;
    output: ResourceType;
}

export type TSerializedBuilding = ISerializedBuilding | ISerializedFactory;

export interface ISerializedRail {
    config: IRailConfig;
    startCoords: Vector2,
    startAxis: Axis,
    endCoords?: Vector2,
    endAxis?: Axis
}

export interface ISerializedGameMap {
    size: number;
    sectors: ISerializedSector[];
    buildings: Record<BuildingType, TSerializedBuilding[]>;
    rails: ISerializedRail[];
}

