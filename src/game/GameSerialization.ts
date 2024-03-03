import { Vector2 } from "three";

export interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: string;
    // rail TODO
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
    sectors: ISerializedSector[];
    buildings: Record<string, Vector2[]>;
}

