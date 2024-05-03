import { MathUtils, Vector2, Vector3 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { IBuildingInstance, IDepotState } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { BuildingUtils } from "./BuildingUtils";
import { time } from "../../engine/core/Time";
import { evtBuildingStateChanged } from "../../Events";

const depotsConfig = {
    slotCount: 9,
    slotsPerRow: 3,
    resourcesPerSlot: 3,
    slotStart: new Vector3(1.23, 0.43, 1.19),
    slotSize: .83,
    slotScaleRange: [.8, 1.3],
    inputFrequency: 1,
    outputFrequency: 1
};

export class Depots {

    public static create(sectorCoords: Vector2, localCoords: Vector2) {
        const instance = buildings.create("depot", sectorCoords, localCoords);
        const { resourcesPerSlot, slotCount } = depotsConfig;

        const capacity = slotCount * resourcesPerSlot;
        const depotState: IDepotState = {
            type: null, 
            amount: 0,
            capacity,
            inputTimer: -1,
            outputTimer: -1
     };
        instance.state = depotState;
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        const state = instance.state as IDepotState;        
        if (state.type !== type) {
            if (state.type !== null) {
                return false;
            }
        }

        const { resourcesPerSlot, slotScaleRange, slotsPerRow, slotSize, slotStart } = depotsConfig;
        const oldAmount = state.amount;
        const newAmount = oldAmount + 1;
        if (newAmount > state.capacity) {
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
        state.type = type;
        evtBuildingStateChanged.post(instance);
        return true;
    }

    public static removeResource(instance: IBuildingInstance, amount?: number) {
        const state = instance.state as IDepotState;
        const oldAmount = state.amount;
        const newAmount = oldAmount - (amount ?? 1);
        const { resourcesPerSlot, slotScaleRange } = depotsConfig;
        const currentSlot = Math.floor((oldAmount - 1) / resourcesPerSlot);
        const newSlot = Math.floor((newAmount - 1) / resourcesPerSlot);
        const slotProgress = (newAmount / resourcesPerSlot) - newSlot;
        if (currentSlot === newSlot || newSlot < 0) {            
            if (newAmount === 0) {
                instance.visual.clear();
                state.type = null;
            } else {
                const mesh = instance.visual.children[currentSlot];
                mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
            }
        } else {
            console.assert(newSlot < currentSlot);
            for (let i = currentSlot; i > newSlot; i--) {
                const currentSlotMesh = instance.visual.children[i];
                currentSlotMesh.removeFromParent();
            }
            const newSlotMesh = instance.visual.children[newSlot];
            newSlotMesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        }
        state.amount = newAmount;
        evtBuildingStateChanged.post(instance);
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;

        if (state.outputTimer < 0) {
            if (state.amount > 0) {
                console.assert(state.type !== null);
                if (BuildingUtils.tryFillAdjacentCells(instance, state.type!)) {
                    Depots.removeResource(instance);
                    state.outputTimer = depotsConfig.outputFrequency;
                }    
            }
        } else {
            state.outputTimer -= time.deltaTime;
        }

        if (state.inputTimer < 0) {
            const { resourcesPerSlot, slotCount } = depotsConfig;
            const capacity = slotCount * resourcesPerSlot;
            if (state.amount < capacity) {
                const resourceType = BuildingUtils.tryGetFromAdjacentCells(instance, state.type);
                if (resourceType) {
                    Depots.tryDepositResource(instance, resourceType);
                    state.inputTimer = depotsConfig.inputFrequency;                    
                }
            }
        } else {
            state.inputTimer -= time.deltaTime;
        }
    }
}

