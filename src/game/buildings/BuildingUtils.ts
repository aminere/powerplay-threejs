import { MathUtils, Vector2 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameUtils } from "../GameUtils";
import { utils } from "../../engine/Utils";
import { conveyorItems } from "../ConveyorItems";
import { ICell } from "../GameTypes";
import { IBuildingInstance, buildingSizes } from "./BuildingTypes";
import { config } from "../config";
import { resources } from "../Resources";
import { Trucks } from "../unit/Trucks";
import { ITruckUnit } from "../unit/TruckUnit";
import { meshes } from "../../engine/resources/Meshes";

const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();
const { cellSize } = config.game;
const { itemScale } = config.conveyors;

const { slotCount, resourcesPerSlot, slotScaleRange, slotStart, slotSpacing } = config.trucks;
const truckCapacity = slotCount * resourcesPerSlot;

type Edge = "left" | "right" | "top" | "bottom";

function tryFillGroundCells(instance: IBuildingInstance, type: ResourceType | RawResourceType, minedCell?: ICell) {
    const { mapCoords } = instance;
    const size = buildingSizes[instance.buildingType];

    // find an empty output cell
    const startX = Math.floor(mapCoords.x + size.x / 2);
    const startY = mapCoords.y + size.z;
    cellCoords.set(startX, startY);
    const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
    if (cell?.isWalkable && !cell.pickableResource) {
        const sector = GameUtils.getSector(sectorCoords)!;
        const visual = utils.createObject(sector.layers.resources, type);
        visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);

        resources.loadModel(type).then(mesh => {
            visual.add(mesh);
            mesh.scale.multiplyScalar(itemScale);
            mesh.position.y = 0.1;
            mesh.castShadow = true;
        });

        cell.pickableResource = { type, visual, producer: instance.id, minedCell };
        return true;
    }
    return false;
}

export class BuildingUtils {

    public static tryGetFromAdjacentCell(type: ResourceType | RawResourceType, mapCoords: Vector2, dx: number, dy: number, axis: "x" | "z") {
        cellCoords.set(mapCoords.x + dx, mapCoords.y + dy);
        const cell = GameUtils.getCell(cellCoords);
        if (!cell) {
            return false;
        }

        const conveyor = cell?.conveyor;
        if (conveyor) {

            const validInput = (() => {
                const { startAxis, direction } = conveyor.config;
                if (axis === "z") {
                    if (startAxis === "x") {
                        if (dx < 0) {
                            return direction.x === 1;
                        } else {
                            return direction.x === -1;
                        }
                    }
                } else {
                    if (startAxis === "z") {
                        if (dy < 0) {
                            return direction.y === 1;
                        } else {
                            return direction.y === -1;
                        }
                    }
                }
                return false;
            })();

            if (validInput) {
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

    public static tryGetFromAdjacentCells(instance: IBuildingInstance, type: ResourceType | RawResourceType) {
        const size = buildingSizes[instance.buildingType];
        for (let x = 0; x < size.x; ++x) {
            if (BuildingUtils.tryGetFromAdjacentCell(type, instance.mapCoords, x, -1, "x")) {
                return true;
            }
            if (BuildingUtils.tryGetFromAdjacentCell(type, instance.mapCoords, x, size.z, "x")) {
                return true;
            }
        }
        for (let z = 0; z < size.z; ++z) {
            if (BuildingUtils.tryGetFromAdjacentCell(type, instance.mapCoords, -1, z, "z")) {
                return true;
            }
            if (BuildingUtils.tryGetFromAdjacentCell(type, instance.mapCoords, size.x, z, "z")) {
               return true;
            }
        }
        return false;
    }

    public static tryFillAdjacentCells(instance: IBuildingInstance, type: ResourceType | RawResourceType) {

        const scan = (startX: number, startY: number, sx: number, sy: number, iterations: number, cb: (cell: ICell) => boolean) => {
            for (let i = 0; i < iterations; ++i) {
                cellCoords.set(startX + i * sx, startY + i * sy);
                const cell = GameUtils.getCell(cellCoords);
                if (cell && cb(cell)) {
                    return true;
                }                
            }
            return false;
        };

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

        const tryTruck = (cell: ICell) => {            
            const truck = cell.units?.find(unit => unit.type === "truck") as ITruckUnit;
            if (!truck) {
                return false;
            }
            
            if (truck.motionId > 0) {
                return false;
            }

            if (truck.resources && truck.resources.type === type) {
                if (truck.resources.amount + 1 > truckCapacity) {
                    return false;                    
                }
            }
            
            if (!truck.resources) {
                truck.resources = {
                    type,
                    amount: 0,
                    root: utils.createObject(truck.visual, "resources")
                };
            } else if (truck.resources.type !== type) {
                // existing resources are lost
                truck.resources.type = type;
                truck.resources.amount = 0;
                truck.resources.root.clear();
            }

            const oldAmount = truck.resources.amount;
            const newAmount = oldAmount + 1;
            const currentSlot = Math.floor((oldAmount - 1) / resourcesPerSlot);
            const newSlot = Math.floor((newAmount - 1) / resourcesPerSlot);
            const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
            if (currentSlot === newSlot) {
                const mesh = truck.resources.root.children[currentSlot];
                mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
            } else {
                console.assert(truck.resources.root.children.length === currentSlot + 1);
                const [_mesh] = meshes.loadImmediate(`/models/resources/${type}.glb`);
                const mesh = _mesh.clone();
                mesh.position.set(0, slotStart.y, slotStart.z + newSlot * slotSpacing);
                mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
                truck.resources!.root.add(mesh);
            }
            truck.resources!.amount = newAmount;
            return true;
        };

        const { mapCoords } = instance;
        const size = buildingSizes[instance.buildingType];
        if (scan(mapCoords.x, mapCoords.y - 1, 1, 0, size.x, cell => tryConveyor(cell, "top") || tryTruck(cell))) {
            return true;
        }
        if (scan(mapCoords.x, mapCoords.y + size.z, 1, 0, size.x, cell => tryConveyor(cell, "bottom") || tryTruck(cell))) {
            return true;
        }
        if (scan(mapCoords.x - 1, mapCoords.y, 0, 1, size.z, cell => tryConveyor(cell, "left") || tryTruck(cell))) {
            return true;
        }
        if (scan(mapCoords.x + size.x, mapCoords.y, 0, 1, size.z, cell => tryConveyor(cell, "right") || tryTruck(cell))) {
            return true;
        }

        return false;
    }    

    public static produceResource(instance: IBuildingInstance, type: ResourceType | RawResourceType, minedCell?: ICell) {
        if (BuildingUtils.tryFillAdjacentCells(instance, type)) {
            return true;
        }

        return tryFillGroundCells(instance, type, minedCell);
    }
}

