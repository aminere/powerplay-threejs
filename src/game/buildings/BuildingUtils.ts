import { Vector2 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameUtils } from "../GameUtils";
import { utils } from "../../engine/Utils";
import { conveyorItems } from "../ConveyorItems";
import { ITruckUnit } from "../unit/TruckUnit";
import { ICell } from "../GameTypes";
import { Trucks } from "../unit/Trucks";

const cellCoords = new Vector2();

export class BuildingUtils {

    public static tryGetFromAdjacentCell(type: ResourceType | RawResourceType, mapCoords: Vector2, dx: number, dy: number) {
        cellCoords.set(mapCoords.x + dx, mapCoords.y + dy);
        const cell = GameUtils.getCell(cellCoords);
        if (!cell) {
            return false;
        }

        const conveyor = cell?.conveyor;
        if (conveyor) {
            let itemToGet = -1;
            for (let i = 0; i < conveyor.items.length; i++) {
                const item = conveyor.items[i];
                if (item.type === type) {
                    itemToGet = i;
                    break;
                }
            }
            if (itemToGet >= 0) {
                const item = conveyor.items[itemToGet];
                utils.fastDelete(conveyor.items, itemToGet);
                conveyorItems.removeItem(item);
                return true;
            }
        } else if (cell.units) {
            const truck = cell.units.find(unit => unit.type === "truck") as ITruckUnit;
            if (truck) {
                const isMoving = truck.motionId > 0;
                if (!isMoving && truck.resources?.type === type) {
                    if (truck.resources!.amount > 0) {
                        Trucks.removeResource(truck);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public static tryFillAdjacentConveyors(cell: ICell, mapCoords: Vector2, resourceType: RawResourceType | ResourceType) {
        const tryFillConveyor = (neighbor: ICell | null) => {
            const conveyor = neighbor?.conveyor;
            if (conveyor) {
                const added = conveyorItems.addItem(neighbor, cellCoords, resourceType);
                if (added) {
                    cell.pickableResource?.visual.removeFromParent();
                    cell.pickableResource = undefined;
                    return true;
                }
            }
            return false;
        }

        cellCoords.set(mapCoords.x + 1, mapCoords.y);
        const neighbor1 = GameUtils.getCell(cellCoords);
        if (tryFillConveyor(neighbor1)) {
            return true;
        }
        cellCoords.set(mapCoords.x, mapCoords.y + 1);
        const neighbor2 = GameUtils.getCell(cellCoords);
        return tryFillConveyor(neighbor2);
    }
}

