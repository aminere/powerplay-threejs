import { Vector2 } from "three";
import { ISector } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config/config";
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

const { mapRes, cellsPerVehicleCell } = config.game;
const vehicleMapRes = mapRes / cellsPerVehicleCell;
export function computeUnitAddr(mapCoords: Vector2, addrOut: IUnitAddr) {
    addrOut.mapCoords.copy(mapCoords);
    GameUtils.getCell(mapCoords, addrOut.sectorCoords, addrOut.localCoords)!;
    addrOut.sector = GameMapState.instance.sectors.get(`${addrOut.sectorCoords.x},${addrOut.sectorCoords.y}`)!;
    addrOut.cellIndex = addrOut.localCoords.y * mapRes + addrOut.localCoords.x;
}

export function computeUnitAddr2x2(mapCoords1x1: Vector2, addrOut2x2: IUnitAddr) {
    addrOut2x2.mapCoords.set(Math.floor(mapCoords1x1.x / cellsPerVehicleCell), Math.floor(mapCoords1x1.y / cellsPerVehicleCell));
    GameUtils.getCell(mapCoords1x1, addrOut2x2.sectorCoords, addrOut2x2.localCoords)!;
    addrOut2x2.localCoords.set(Math.floor(addrOut2x2.localCoords.x / cellsPerVehicleCell), Math.floor(addrOut2x2.localCoords.y / cellsPerVehicleCell));
    addrOut2x2.sector = GameMapState.instance.sectors.get(`${addrOut2x2.sectorCoords.x},${addrOut2x2.sectorCoords.y}`)!;
    addrOut2x2.cellIndex = addrOut2x2.localCoords.y * vehicleMapRes + addrOut2x2.localCoords.x;
    return addrOut2x2;
}

export function copyUnitAddr(src: IUnitAddr, dest: IUnitAddr) {
    dest.mapCoords.copy(src.mapCoords);
    dest.localCoords.copy(src.localCoords);
    dest.sectorCoords.copy(src.sectorCoords);
    dest.cellIndex = src.cellIndex;
    dest.sector = src.sector;
}

export function getCellFromAddr(addr: IUnitAddr) {
    return addr.sector.cells[addr.cellIndex];
}

export function getCell2x2FromAddr(addr2x2: IUnitAddr) {
    return addr2x2.sector.cells2x2[addr2x2.cellIndex];
}

