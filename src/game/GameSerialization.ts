
export interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: string;
    // building?: string;
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
}

