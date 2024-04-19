import { MathUtils, Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { utils } from "../../engine/Utils";
import { conveyorItems } from "../ConveyorItems";
import { ITruckUnit } from "./TruckUnit";
import { IConveyor } from "../GameTypes";
import { meshes } from "../../engine/resources/Meshes";

const gridNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const neighborCoords = new Vector2();

const slotCount = 3;
const resourcesPerSlot = 5;
const maxResources = slotCount * resourcesPerSlot;

const slotStartZ = -.7;
const slotSpacing = .35;
const slotY = .36;
const slotScaleRange = [.3, .6];

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
            return truck.resources!.amount < maxResources;
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
            root: utils.createObject(truck.mesh, "resources")
        };
    } else {
        if (truck.resources.type !== conveyorResource) {
            // existing resources are lost
            truck.resources.type = conveyorResource;
            truck.resources.amount = 0;
            truck.resources.root.clear();
        }
    }

    const oldAmount = truck.resources.amount;
    const newAmount = oldAmount + 1;
    const currentSlot = oldAmount > 0 ? Math.floor(oldAmount / resourcesPerSlot) : -1;
    const newSlot = Math.floor(newAmount / resourcesPerSlot);
    const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
    if (currentSlot === newSlot) {
        const mesh = truck.resources.root.children[currentSlot];
        mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
    } else {
        console.assert(truck.resources.root.children.length === currentSlot + 1);
        const [_mesh] = meshes.loadImmediate(`/models/resources/${conveyorResource}.glb`);
        const mesh = _mesh.clone();
        mesh.position.set(0, slotY, slotStartZ + newSlot * slotSpacing);
        mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        truck.resources!.root.add(mesh);
    }

    removeConveyorItem(conveyor, itemToGet);
    truck.resources!.amount = newAmount;
}

export function truckUpdate(truck: ITruckUnit) {
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


