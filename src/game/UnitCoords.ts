import { Vector2 } from "three";
import { ISector } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { gameMapState } from "./components/GameMapState";
import { config } from "./config";

export interface IUnitCoords {
    mapCoords: Vector2;    
    localCoords: Vector2;    
    sectorCoords: Vector2;
    sector?: ISector;
    cellIndex: number;
}

const { mapRes } = config.game;
export function updateSectorCoords(coords: IUnitCoords) {
    GameUtils.getCell(coords.mapCoords, coords.sectorCoords, coords.localCoords);
    coords.sector = gameMapState.sectors.get(`${coords.sectorCoords.x},${coords.sectorCoords.y}`);
    coords.cellIndex = coords.localCoords.y * mapRes + coords.localCoords.x;
}

