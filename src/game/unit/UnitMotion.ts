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

type FlowFieldMap = Map<string, TFlowField[]>;

class UnitMotion {
    private _motionId = 1;
    private _motions = new Map<number, FlowFieldMap>();

    public move(units: IUnit[], destSectorCoords: Vector2, destMapCoords: Vector2, destCell: ICell) {
        const sourceSectorCoords = units[0].coords.sectorCoords;
        const sectors = (() => {
            if (sourceSectorCoords.equals(destSectorCoords)) {
                return [sourceSectorCoords];
            } else {
                const sectorPath = sectorPathfinder.findPath(sourceSectorCoords, destSectorCoords)!;
                console.assert(sectorPath);
                return sectorPath;
            }
        })();

        const flowfields = flowField.compute(destMapCoords, sectors)!;
        console.assert(flowfields);
        const motionId = this._motionId++;
        this._motions.set(motionId, flowfields);
        const resource = destCell.resource?.name;
        const nextState = resource ? MiningState : null;
        for (const unit of units) {
            if (!unit.isAlive) {
                continue;
            }
            if (unit.coords.mapCoords.equals(destMapCoords)) {
                continue;
            }
            unit.motionId = motionId;
            this.moveTo(unit, destMapCoords);
            unit.fsm.switchState(nextState);
        }
        
        for (const sector of gameMapState.sectors.values()) {
            sector.flowfieldViewer.visible = false;
        }
        for (const sectorCoords of sectors) {
            const sector = GameUtils.getSector(sectorCoords)!;
            sector.flowfieldViewer.update(motionId, sector, sectorCoords, destMapCoords);
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

    // private getTargetCoords(path: Vector2[], desiredTargetCell: ICell, desiredTargetCellCoords: Vector2) {
    //     const resource = desiredTargetCell.resource?.name;
    //     if (resource) {
    //         return desiredTargetCellCoords;
    //     } else if (desiredTargetCell.isEmpty) {
    //         return path[path.length - 1];
    //     } else if (path.length > 2) {
    //         return path[path.length - 2];
    //     }
    //     return null;
    // }

    // public moveWithinSector(units: IUnit[], srcMapCoords: Vector2, destMapCoords: Vector2, destCell: ICell, multiSectorMotion?: IMultiSectorMotion) {
    //     const path = cellPathfinder.findPath(srcMapCoords, destMapCoords, { diagonals: () => false });
    //     if (!path || path.length < 2) {
    //         return;
    //     }

    //     const targetCellCoords = this.getTargetCoords(path, destCell, destMapCoords);        
    //     if (!targetCellCoords) {
    //         return;
    //     }

    //     const computed = flowField.compute(targetCellCoords);
    //     console.assert(computed);
    //     const resource = destCell.resource?.name;
    //     const nextState = resource ? MiningState : null;
    //     for (const unit of units) {
    //         if (!unit.isAlive) {
    //             continue;
    //         }
    //         unitUtils.moveTo(unit, targetCellCoords);
    //         unit.fsm.switchState(nextState);
    //         if (multiSectorMotion) {
    //             unit.multiSectorMotion = {
    //                 sectors: multiSectorMotion.sectors.map(s => {
    //                     return {
    //                         sectorCoords: s.sectorCoords.clone(),
    //                         targetCell: s.targetCell
    //                     }
    //                 }),
    //                 currentSector: 0
    //             }
    //         }            
    //     }
    // }
}

export const unitMotion = new UnitMotion();

