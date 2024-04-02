import { Vector2 } from "three";
import { IConveyorConfig } from "./GameTypes";
import { BuildingType } from "./buildings/BuildingTypes";
import { RawResourceType } from "./GameDefinitions";

export interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: RawResourceType;
    unitCount?: number;
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

export interface ISerializedGameMap {
    size: number;
    sectors: ISerializedSector[];
    buildings: Record<BuildingType, Vector2[]>;
}

