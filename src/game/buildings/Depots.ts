import { MathUtils, Vector2, Vector3 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { IBuildingInstance, IDepotState } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";

const depotsConfig = {
    slotCount: 9,
    slotsPerRow: 3,
    resourcesPerSlot: 3,
    slotStart: new Vector3(1.23, 0.43, 1.19),
    slotSize: .83,
    slotScaleRange: [.8, 1.3]
};

export class Depots {
    public static create(sectorCoords: Vector2, localCoords: Vector2, type: RawResourceType | ResourceType) {
        const instance = buildings.create("depot", sectorCoords, localCoords);
        const depotState: IDepotState = { type, amount: 0 };
        instance.state = depotState;
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        const state = instance.state as IDepotState;        
        if (state.type !== type) {
            return false;
        }

        const { resourcesPerSlot, slotScaleRange, slotCount, slotsPerRow, slotSize, slotStart } = depotsConfig;
        const oldAmount = state.amount;
        const newAmount = oldAmount + 1;
        const capacity = slotCount * resourcesPerSlot;
        if (newAmount > capacity) {
            return false;
        }

        const currentSlot = Math.floor((oldAmount - 1) / resourcesPerSlot);
        const newSlot = Math.floor((newAmount - 1) / resourcesPerSlot);
        const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
        if (currentSlot === newSlot) {
            const mesh = instance.visual.children[currentSlot];
            mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        } else {
            console.assert(instance.visual.children.length === currentSlot + 1);
            const [_mesh] = meshes.loadImmediate(`/models/resources/${type}.glb`);
            const mesh = _mesh.clone();
            mesh.castShadow = true;
            
            const row = Math.floor(newSlot / slotsPerRow);
            const col = newSlot % slotsPerRow;
            mesh.position.set(
                slotStart.x + col * slotSize,
                slotStart.y, 
                slotStart.z + row * slotSize
            );

            mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
            instance.visual.add(mesh);
        }

        state.amount = newAmount;
        return true;
    }

    public static removeResource(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;
        const oldAmount = state.amount;
        const newAmount = oldAmount - 1;
        const { resourcesPerSlot, slotScaleRange } = depotsConfig;
        const currentSlot = Math.floor((oldAmount - 1) / resourcesPerSlot);
        const newSlot = Math.floor((newAmount - 1) / resourcesPerSlot);
        const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
        if (currentSlot === newSlot || newSlot < 0) {
            const mesh = instance.visual.children[currentSlot];
            if (newAmount === 0) {
                mesh.removeFromParent();
            } else {
                mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
            }
        } else {
            const currentSlotMesh = instance.visual.children[currentSlot];
            currentSlotMesh.removeFromParent();
            const newSlotMesh = instance.visual.children[newSlot];
            newSlotMesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        }
        state.amount = newAmount;
    }
}

