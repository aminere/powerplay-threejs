import { MathUtils, Vector2, Vector3 } from "three";
import { ITruckUnit } from "./TruckUnit";
import { GameUtils } from "../GameUtils";
import { meshes } from "../../engine/resources/Meshes";
import { utils } from "../../engine/Utils";
import { IConveyor } from "../GameTypes";
import { conveyorItems } from "../ConveyorItems";

const gridNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const neighborCoords = new Vector2();

const trucksConfig = {
    slotCount: 3,
    resourcesPerSlot: 5,
    slotStart: new Vector3(0, .36, -.7),    
    slotSpacing: .35,    
    slotScaleRange: [.3, .6]
};

function removeConveyorItem(conveyor: IConveyor, index: number) {
    const item = conveyor.items[index];
    utils.fastDelete(conveyor.items, index);
    conveyorItems.removeItem(item);
};

function tryPickResource(truck: ITruckUnit, conveyor: IConveyor) {    
    const itemToGet = 0;
    const conveyorResource = conveyor.items[itemToGet].type;

    const canPick = (() => {
        if (truck.resources?.type === conveyorResource) {
            const capacity = trucksConfig.slotCount * trucksConfig.resourcesPerSlot;
            return truck.resources!.amount < capacity;
        } else {
            return true;
        }
    })();

    if (!canPick) {
        return;
    }

    if (!truck.resources) {
        truck.resources = {
            type: conveyorResource, 
            amount: 0,
            root: utils.createObject(truck.visual, "resources")
        };
    } else {
        if (truck.resources.type !== conveyorResource) {
            // existing resources are lost
            truck.resources.type = conveyorResource;
            truck.resources.amount = 0;
            truck.resources.root.clear();
        }
    }

    const { resourcesPerSlot, slotScaleRange, slotSpacing, slotStart: slotsStart } = trucksConfig;
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
        const [_mesh] = meshes.loadImmediate(`/models/resources/${conveyorResource}.glb`);
        const mesh = _mesh.clone();
        mesh.position.set(0, slotsStart.y, slotsStart.z + newSlot * slotSpacing);
        mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        truck.resources!.root.add(mesh);
    }

    removeConveyorItem(conveyor, itemToGet);
    truck.resources!.amount = newAmount;
}


export class Trucks {
    
    public static update(truck: ITruckUnit) {
        const isMoving = truck.motionId > 0;
        if (isMoving) {

        } else {
            const { mapCoords } = truck.coords;
            for (const [dx, dy] of gridNeighbors) {
                neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
                const neighborCell = GameUtils.getCell(neighborCoords);
                const conveyor = neighborCell?.conveyor;
                if (conveyor) {
                    if (conveyor.items.length === 0) {
                        continue;
                    }
                    tryPickResource(truck, conveyor);
                }
            }
        }
    }

    public static removeResource(truck: ITruckUnit) {
        const oldAmount = truck.resources!.amount;
        const newAmount = oldAmount - 1;
        const { resourcesPerSlot, slotScaleRange } = trucksConfig;
        const currentSlot = Math.floor(oldAmount / resourcesPerSlot);
        const newSlot = Math.floor(newAmount / resourcesPerSlot);
        const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
        if (currentSlot === newSlot) {
            const mesh = truck.resources!.root.children[currentSlot];
            if (newAmount === 0) {
                mesh.removeFromParent();
            } else {
                mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
            }
        } else {
            const currentSlotMesh = truck.resources!.root.children[currentSlot];
            currentSlotMesh.removeFromParent();
            const newSlotMesh = truck.resources!.root.children[newSlot];
            newSlotMesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        }
        truck.resources!.amount = newAmount;
    }
}

