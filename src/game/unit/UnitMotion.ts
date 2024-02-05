import { Vector2 } from "three";
import { ICell } from "../GameTypes";
import { flowField, getFlowfield } from "../pathfinding/Flowfield";
import { MiningState } from "./MiningState";
import { unitUtils } from "./UnitUtils";
import { IUnit } from "./IUnit";
import { sectorPathfinder } from "../pathfinding/SectorPathfinder";
import { GameUtils } from "../GameUtils";

class UnitMotion {
    public getTargetCoords(path: Vector2[], desiredTargetCell: ICell, desiredTargetCellCoords: Vector2) {
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

    public move(units: IUnit[], sourceSectorCoords: Vector2, destSectorCoords: Vector2, destMapCoords: Vector2, destCell: ICell) {   
        console.assert(units[0].coords.sectorCoords.equals(sourceSectorCoords));     
        const sectorPath = sectorPathfinder.findPath(sourceSectorCoords, destSectorCoords);
        if (sectorPath) {
            console.assert(sourceSectorCoords.equals(sectorPath[0]));
        }
        const sectors = sectorPath ?? [sourceSectorCoords];
        const computed = flowField.compute(destMapCoords, sectors);
        console.assert(computed);
        const resource = destCell.resource?.name;
        const nextState = resource ? MiningState : null;
        for (const unit of units) {
            if (!unit.isAlive) {
                continue;
            }
            unitUtils.moveTo(unit, destMapCoords);
            unit.fsm.switchState(nextState);
        }

        for (const sectorCoords of sectors) {
            const sector = GameUtils.getSector(sectorCoords)!;
            sector.flowfieldViewer.update(sector, sectorCoords, destCell, destMapCoords, destSectorCoords);
        }
    }

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

