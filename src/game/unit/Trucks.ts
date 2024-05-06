import { MathUtils } from "three";
import { ITruckUnit } from "./TruckUnit";
import { config } from "../config/config";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { utils } from "../../engine/Utils";
import { meshes } from "../../engine/resources/Meshes";

const { resourcesPerSlot, slotScaleRange, slotCount, slotStart, slotSpacing } = config.trucks;
const truckCapacity = resourcesPerSlot * slotCount;

export class Trucks {    

    public static tryDepositResource(truck: ITruckUnit, type: RawResourceType | ResourceType) {
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
    }

    public static removeResource(truck: ITruckUnit) {
        const oldAmount = truck.resources!.amount;
        const newAmount = oldAmount - 1;
        const currentSlot = Math.floor((oldAmount - 1) / resourcesPerSlot);
        const newSlot = Math.floor((newAmount - 1) / resourcesPerSlot);
        const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
        if (currentSlot === newSlot || newSlot < 0) {
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

