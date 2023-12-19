import { Vector2 } from "three";
import { ISector } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { gameMapState } from "./components/GameMapState";
import { config } from "./config";

export interface ICellAddr {
    mapCoords: Vector2;    
    localCoords: Vector2;    
    sectorCoords: Vector2;
    sector?: ISector;
    cellIndex: number;
}

const { mapRes } = config.game;
export function computeCellAddr(mapCoords: Vector2, addrOut: ICellAddr) {
    addrOut.mapCoords.copy(mapCoords);
    GameUtils.getCell(mapCoords, addrOut.sectorCoords, addrOut.localCoords);
    addrOut.sector = gameMapState.sectors.get(`${addrOut.sectorCoords.x},${addrOut.sectorCoords.y}`);
    addrOut.cellIndex = addrOut.localCoords.y * mapRes + addrOut.localCoords.x;
}

