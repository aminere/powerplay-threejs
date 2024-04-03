import { Vector2 } from "three";
import { ISector } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { GameMapState } from "../components/GameMapState";

export interface IUnitAddr {
    mapCoords: Vector2;
    localCoords: Vector2;
    sectorCoords: Vector2;
    cellIndex: number;
    sector: ISector;
}

export function makeUnitAddr() {
    const addr: IUnitAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0,
        sector: null!,
    };
    return addr;
}

const { mapRes } = config.game;
export function computeUnitAddr(mapCoords: Vector2, addrOut: IUnitAddr) {
    addrOut.mapCoords.copy(mapCoords);
    GameUtils.getCell(mapCoords, addrOut.sectorCoords, addrOut.localCoords)!;
    addrOut.sector = GameMapState.instance.sectors.get(`${addrOut.sectorCoords.x},${addrOut.sectorCoords.y}`)!;
    addrOut.cellIndex = addrOut.localCoords.y * mapRes + addrOut.localCoords.x;
}

export function copyUnitAddr(src: IUnitAddr, dest: IUnitAddr) {
    dest.mapCoords.copy(src.mapCoords);
    dest.localCoords.copy(src.localCoords);
    dest.sectorCoords.copy(src.sectorCoords);
    dest.cellIndex = src.cellIndex;
    dest.sector = src.sector;
}
