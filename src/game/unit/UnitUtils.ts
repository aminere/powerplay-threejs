import { Vector2, Vector3 } from "three";
import { ISector } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { IUnit } from "./IUnit";
import { flowField } from "../pathfinding/Flowfield";
import { SkeletonManager } from "../animation/SkeletonManager";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { engineState } from "../../engine/EngineState";

export interface ICellAddr {
    mapCoords: Vector2;
    localCoords: Vector2;
    sectorCoords: Vector2;
    sector?: ISector;
    cellIndex: number;
}

const { mapRes } = config.game;
const cellDirection3 = new Vector3();
class UnitUtils {

    public set skeletonManager(value: SkeletonManager) { this._skeletonManager = value; }
    public get skeletonManager() { return this._skeletonManager; }

    private _skeletonManager!: SkeletonManager;

    public computeCellAddr(mapCoords: Vector2, addrOut: ICellAddr) {
        addrOut.mapCoords.copy(mapCoords);
        GameUtils.getCell(mapCoords, addrOut.sectorCoords, addrOut.localCoords);
        addrOut.sector = gameMapState.sectors.get(`${addrOut.sectorCoords.x},${addrOut.sectorCoords.y}`);
        addrOut.cellIndex = addrOut.localCoords.y * mapRes + addrOut.localCoords.x;
    }

    public computeDesiredPos(unit: IUnit, steerAmount: number) {
        const { isMoving, desiredPosValid, desiredPos, targetCell, coords, obj } = unit;
        if (isMoving) {
            if (!desiredPosValid) {
                const { sector } = targetCell;
                const targetCellIndex = targetCell.cellIndex;
                const currentCellIndex = coords.cellIndex;
                const _flowField = sector!.cells[targetCellIndex].flowField!;
                const { directions } = _flowField;
                const [cellDirection, cellDirectionValid] = directions[currentCellIndex];
                if (!cellDirectionValid) {
                    flowField.computeDirection(_flowField, sector!.flowFieldCosts, currentCellIndex, cellDirection);
                    directions[currentCellIndex][1] = true;
                }
                cellDirection3.set(cellDirection.x, 0, cellDirection.y);
                desiredPos.addVectors(obj.position, cellDirection3.multiplyScalar(steerAmount));
                unit.desiredPosValid = true;
            }
        } else {
            if (!desiredPosValid) {
                desiredPos.copy(obj.position);
                unit.desiredPosValid = true;
            }
        }
        return desiredPos;
    }

    public moveTo(unit: IUnit, mapCoords: Vector2) {
        unit.isMoving = true;
        unit.desiredPosValid = false;
        unit.isColliding = false;
        this.computeCellAddr(mapCoords, unit.targetCell);
        engineState.removeComponent(unit.obj, UnitCollisionAnim);
        this._skeletonManager.applySkeleton("walk", unit.obj);
    }
}

export const unitUtils = new UnitUtils();

