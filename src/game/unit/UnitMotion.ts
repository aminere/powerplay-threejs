import { Vector2 } from "three";
import { ICell } from "../GameTypes";
import { TFlowField, flowField } from "../pathfinding/Flowfield";
import { MiningState } from "./MiningState";
import { IUnit } from "./IUnit";
import { sectorPathfinder } from "../pathfinding/SectorPathfinder";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "../components/GameMapState";
import { computeUnitAddr } from "./UnitAddr";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { unitAnimation } from "./UnitAnimation";
import { cellPathfinder } from "../pathfinding/CellPathfinder";
import { config } from "../config";
import { pools } from "../../engine/Pools";

type FlowFieldMap = Map<string, TFlowField[]>;
const { mapRes } = config.game;

class UnitMotion {
    private _motionId = 1;
    private _motions = new Map<number, FlowFieldMap>();

    public move(units: IUnit[], destSectorCoords: Vector2, destMapCoords: Vector2, destCell: ICell) {
        const sourceSectorCoords = units[0].coords.sectorCoords;

        const sameSector = sourceSectorCoords.equals(destSectorCoords);
        const sectors = (() => {
            if (sameSector) {
                return [sourceSectorCoords];
            } else {
                const sectorPath = sectorPathfinder.findPath(sourceSectorCoords, destSectorCoords)!;
                console.assert(sectorPath);
                return sectorPath;
            }
        })();

        let targetCellCoords: Vector2 | null = destMapCoords;
        const srcMapCoords = (() => {
            if (sameSector) {
                return units[0].coords.mapCoords;
            } else {
                console.assert(sectors.length > 1);
                const [sector1, sector2] = sectors.slice(-2);
                const dx = sector2.x - sector1.x;
                const dy = sector2.y - sector1.y;
                console.assert(Math.abs(dx) + Math.abs(dy) === 1);
                const sector = GameUtils.getSector(sector2)!;
                if (dx === 0) {
                    console.assert(Math.abs(dy) === 1);
                    const y = dy > 0 ? 0 : mapRes - 1;
                    for (let x = 0; x < mapRes; x++) {
                        const cellIndex = y * mapRes + x;
                        if (sector.cells[cellIndex].isEmpty) {
                            return pools.vec2.getOne().set(sector2.x * mapRes + x, sector2.y * mapRes + y);
                        }
                    }

                } else {
                    console.assert(Math.abs(dx) === 1);
                    const x = dx > 0 ? 0 : mapRes - 1;
                    for (let y = 0; y < mapRes; y++) {
                        const cellIndex = y * mapRes + x;
                        if (sector.cells[cellIndex].isEmpty) {
                            return pools.vec2.getOne().set(sector2.x * mapRes + x, sector2.y * mapRes + y);
                        }
                    }
                }
            }
        })();

        if (!srcMapCoords) {
            return;
        }

        console.assert(Math.abs(destMapCoords.x - srcMapCoords.x) < mapRes);
        console.assert(Math.abs(destMapCoords.y - srcMapCoords.y) < mapRes);
        const path = cellPathfinder.findPath(srcMapCoords, destMapCoords, { diagonals: () => false });
        if (!path || path.length < 2) {
            return;
        }
        targetCellCoords = this.getTargetCoords(path, destCell, destMapCoords);
        if (!targetCellCoords) {
            return;
        }

        const flowfields = flowField.compute(targetCellCoords, sectors)!;
        console.assert(flowfields);
        const motionId = this._motionId++;
        this._motions.set(motionId, flowfields);
        const resource = destCell.resource?.name;
        const nextState = resource ? MiningState : null;
        for (const unit of units) {
            if (!unit.isAlive) {
                continue;
            }
            if (unit.coords.mapCoords.equals(targetCellCoords)) {
                continue;
            }
            unit.motionId = motionId;
            this.moveTo(unit, targetCellCoords);
            unit.fsm.switchState(nextState);
        }
        
        for (const sector of gameMapState.sectors.values()) {
            sector.flowfieldViewer.visible = false;
        }
        for (const sectorCoords of sectors) {
            const sector = GameUtils.getSector(sectorCoords)!;
            sector.flowfieldViewer.update(motionId, sector, sectorCoords, targetCellCoords);
            sector.flowfieldViewer.visible = true;
        }
    }

    public getFlowfields(motionId: number) {
        return this._motions.get(motionId)!;
    }

    private moveTo(unit: IUnit, mapCoords: Vector2, bindSkeleton = true) {
        unit.collidable = true;
        computeUnitAddr(mapCoords, unit.targetCell);
        engineState.removeComponent(unit.obj, UnitCollisionAnim);
        if (bindSkeleton) {
            unitAnimation.setAnimation(unit, "run");
        }
    }

    private getTargetCoords(path: Vector2[], desiredTargetCell: ICell, desiredTargetCellCoords: Vector2) {
        const resource = desiredTargetCell.resource?.name;
        if (resource) {
            return desiredTargetCellCoords;
        } else if (desiredTargetCell.isEmpty) {
            return path[path.length - 1];
        } else if (path.length > 2) {
            return path[path.length - 2];
        }
        return null;
    }    
}

export const unitMotion = new UnitMotion();

