import { Vector2 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameUtils } from "../GameUtils";
import { utils } from "../../engine/Utils";
import { conveyorItems } from "../ConveyorItems";
import { ICell } from "../GameTypes";
import { IBuildingInstance } from "./BuildingTypes";
import { buildingConfig } from "./BuildingConfig";
// import { config } from "../config";
// import { resources } from "../Resources";

const cellCoords = new Vector2();
// const sectorCoords = new Vector2();
// const localCoords = new Vector2();
// const { cellSize } = config.game;
// const { itemScale } = config.conveyors;

type Edge = "left" | "right" | "top" | "bottom";

// function tryFillGroundCells(instance: IBuildingInstance, type: ResourceType | RawResourceType, minedCell?: ICell) {
//     const { mapCoords } = instance;
//     const size = buildingSizes[instance.buildingType];

//     // find an empty output cell
//     const startX = Math.floor(mapCoords.x + size.x / 2);
//     const startY = mapCoords.y + size.z;
//     cellCoords.set(startX, startY);
//     const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
//     if (cell?.isWalkable && !cell.pickableResource) {
//         const sector = GameUtils.getSector(sectorCoords)!;
//         const visual = utils.createObject(sector.layers.resources, type);
//         visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);

//         resources.loadModel(type).then(mesh => {
//             visual.add(mesh);
//             mesh.scale.multiplyScalar(itemScale);
//             mesh.position.y = 0.1;
//             mesh.castShadow = true;
//         });

//         cell.pickableResource = { type, visual, producer: instance.id, minedCell };
//         return true;
//     }
//     return false;
// }

function scan(startX: number, startY: number, sx: number, sy: number, iterations: number, cb: (cell: ICell) => boolean) {
    for (let i = 0; i < iterations; ++i) {
        cellCoords.set(startX + i * sx, startY + i * sy);
        const cell = GameUtils.getCell(cellCoords);
        if (cell && cb(cell)) {
            return true;
        }
    }
    return false;
}

export class BuildingUtils {

    public static tryGetFromAdjacentCells(instance: IBuildingInstance, type: ResourceType | RawResourceType | null) {

        let acceptedType: ResourceType | RawResourceType | null = null;
        const tryConveyor = (cell: ICell, edge: Edge) => {
            if (cell.conveyor) {
                const validInput = (() => {
                    const { startAxis, direction } = cell.conveyor.config;
                    switch (edge) {
                        case "left": return startAxis === "x" && direction.x === 1;
                        case "top": return startAxis === "z" && direction.y === 1;
                        case "right": return startAxis === "x" && direction.x === -1;
                        default: return startAxis === "z" && direction.y === -1; // bottom
                    }
                })();
                if (validInput) {
                    let itemToGet = -1;
                    for (let i = 0; i < cell.conveyor.items.length; i++) {
                        const item = cell.conveyor.items[i];
                        if (type === null) {
                            itemToGet = i;
                            break;
                        }
                        if (item.type === type) {
                            itemToGet = i;
                            break;
                        }
                    }
                    if (itemToGet >= 0) {
                        const item = cell.conveyor.items[itemToGet];
                        utils.fastDelete(cell.conveyor.items, itemToGet);
                        conveyorItems.removeItem(item);
                        acceptedType = item.type;
                        return true;
                    }
                }
            }
            return false;
        };

        const { mapCoords } = instance;
        const size = buildingConfig[instance.buildingType].size;
        if (scan(mapCoords.x, mapCoords.y - 1, 1, 0, size.x, cell => tryConveyor(cell, "top"))) {
            return acceptedType!;
        }
        if (scan(mapCoords.x, mapCoords.y + size.z, 1, 0, size.x, cell => tryConveyor(cell, "bottom"))) {
            return acceptedType!;
        }
        if (scan(mapCoords.x - 1, mapCoords.y, 0, 1, size.z, cell => tryConveyor(cell, "left"))) {
            return acceptedType!;
        }
        if (scan(mapCoords.x + size.x, mapCoords.y, 0, 1, size.z, cell => tryConveyor(cell, "right"))) {
            return acceptedType!;
        }
        return null;        
    }

    public static tryFillAdjacentCells(instance: IBuildingInstance, type: ResourceType | RawResourceType) {
        const tryConveyor = (cell: ICell, edge: Edge) => {
            if (cell.conveyor) {
                const validOutput = (() => {
                    const { startAxis, direction } = cell.conveyor.config;
                    switch (edge) {
                        case "left": return startAxis === "x" && direction.x === -1;
                        case "top": return startAxis === "z" && direction.y === -1;
                        case "right": return startAxis === "x" && direction.x === 1;
                        default: return startAxis === "z" && direction.y === 1; // bottom
                    }
                })();
                if (validOutput) {
                    const added = conveyorItems.addItem(cell, cellCoords, type);
                    if (added) {
                        return true;
                    }
                }
            }
            return false;
        };

        const { mapCoords } = instance;
        const size = buildingConfig[instance.buildingType].size;
        if (scan(mapCoords.x, mapCoords.y - 1, 1, 0, size.x, cell => tryConveyor(cell, "top"))) {
            return true;
        }
        if (scan(mapCoords.x, mapCoords.y + size.z, 1, 0, size.x, cell => tryConveyor(cell, "bottom"))) {
            return true;
        }
        if (scan(mapCoords.x - 1, mapCoords.y, 0, 1, size.z, cell => tryConveyor(cell, "left"))) {
            return true;
        }
        if (scan(mapCoords.x + size.x, mapCoords.y, 0, 1, size.z, cell => tryConveyor(cell, "right"))) {
            return true;
        }
        return false;
    }

    public static produceResource(instance: IBuildingInstance, type: ResourceType | RawResourceType) {
        if (BuildingUtils.tryFillAdjacentCells(instance, type)) {
            return true;
        }

        return false;
        // return tryFillGroundCells(instance, type, minedCell);
    }
}

