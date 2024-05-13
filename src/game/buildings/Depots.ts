import { MathUtils, Vector2, Vector3 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { BuildableType, IBuildingInstance, IDepotState } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { evtBuildError, evtBuildingStateChanged } from "../../Events";
import { buildingConfig } from "../config/BuildingConfig";
import { GameMapState } from "../components/GameMapState";
import { config } from "../config/config";
import { resources } from "../Resources";
import { utils } from "../../engine/Utils";

const { mapRes } = config.game;
const cellCoords = new Vector2();
const neighborSectorCoords = new Vector2();

const depotsConfig = {
    slotCount: 9,
    slotsPerRow: 3,
    resourcesPerSlot: 5,
    slotStart: new Vector3(1.23, 0.43, 1.19),
    slotSize: .83,
    slotScaleRange: [.8, 1.3],
    inputFrequency: 1,
    outputFrequency: 1
};

function getFreeSpot(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
    const state = instance.state as IDepotState;
    for (let i = 0; i < state.slots.slots.length; i++) {
        const slot = state.slots.slots[i];
        if (slot.type === null) {
            return i;
        }
        if (slot.type === type && slot.amount < depotsConfig.resourcesPerSlot) {
            return i;
        }
    }
    return -1;
}

export class Depots {

    public static create(sectorCoords: Vector2, localCoords: Vector2) {
        const instance = buildings.create("depot", sectorCoords, localCoords);
        const { slotCount, slotsPerRow, slotStart, slotSize } = depotsConfig;

        const slotsRoot = utils.createObject(instance.visual, "slots");
        for (let i = 0; i < depotsConfig.slotCount; i++) {
            const slot = utils.createObject(slotsRoot, `slot${i}`);
            const row = Math.floor(i / slotsPerRow);
            const col = i % slotsPerRow;
            slot.position.set(
                slotStart.x + col * slotSize,
                slotStart.y,
                slotStart.z + row * slotSize
            );
        }

        const depotState: IDepotState = {
            output: null,
            inputTimer: depotsConfig.inputFrequency,
            outputTimer: depotsConfig.outputFrequency,
            slots: {
                root: slotsRoot,
                slots: [...Array(slotCount)].map(() => {
                    return {
                        type: null,
                        amount: 0
                    }
                })
            }
        };
        instance.state = depotState;
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {

        const slotIndex = getFreeSpot(instance, type);        
        if (slotIndex < 0) {
            return false;
        }

        const { resourcesPerSlot, slotScaleRange } = depotsConfig;
        const state = instance.state as IDepotState;
        const { slots, root: slotsRoot } = state.slots;
        const slot = slots[slotIndex];
        const slotRoot = slotsRoot.children[slotIndex];
        if (slot.type === null) {
            console.assert(slot.amount === 0);            
            console.assert(slotRoot.children.length === 0);
            const [_mesh] = meshes.loadImmediate(`/models/resources/${type}.glb`);
            const mesh = _mesh.clone();
            mesh.castShadow = true;
            if (type === "glass") {
                mesh.material = resources.glassMaterial;
            }
            const slotProgress = 1 / resourcesPerSlot;
            mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
            slotRoot.add(mesh);
            slot.type = type;
        } else {
            console.assert(slot.amount > 0);
            console.assert(slotRoot.children.length === 1);
            const mesh = slotRoot.children[0];
            const slotProgress = (slot.amount + 1) / resourcesPerSlot;
            mesh.scale.setScalar(MathUtils.lerp(slotScaleRange[0], slotScaleRange[1], slotProgress));
        }

        slot.amount = slot.amount + 1;
        evtBuildingStateChanged.post(instance);
        return true;
    }

    public static hasResource(instance: IBuildingInstance, type: RawResourceType | ResourceType, amount: number) {
        const state = instance.state as IDepotState;
        for (const slot of state.slots.slots) {
            if (slot.type === type) {
                if (slot.amount >= amount) {
                    return true;
                }
            }
        }
        return false;
    }

    public static removeResource(instance: IBuildingInstance, type: RawResourceType | ResourceType, amount: number) {
        const state = instance.state as IDepotState;
        const { slots, root: slotsRoot } = state.slots;
        const slotIndex = (() => {
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                if (slot.type === type && slot.amount >= amount) {
                    return i;
                }
            }
            return -1;
        })();

        console.assert(slotIndex >= 0);
        const slot = slots[slotIndex];
        const slotRoot = slotsRoot.children[slotIndex];
        slot.amount -= amount;
        console.assert(slot.amount >= 0);
        if (slot.amount === 0) {
            slot.type = null;
            slotRoot.clear();
        } else {
            const mesh = slotRoot.children[0];
            const slotProgress = slot.amount / depotsConfig.resourcesPerSlot;
            mesh.scale.setScalar(MathUtils.lerp(depotsConfig.slotScaleRange[0], depotsConfig.slotScaleRange[1], slotProgress));
        }

        // clear output if no more resources of that type
        if (type === state.output) {
            const remaining = slots.reduce((acc, slot) => {
                const slotAmount = slot.type === state.output ? slot.amount : 0;            
                return acc + slotAmount;
            }, 0);
            if (remaining === 0) {
                state.output = null;
            }
        }

        evtBuildingStateChanged.post(instance);        
    }

    public static clear(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;
        const { slots, root: slotsRoot } = state.slots;
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            slot.type = null;
            slot.amount = 0;
            const slotRoot = slotsRoot.children[i];
            slotRoot.clear();
        }
        evtBuildingStateChanged.post(instance);
    }

    public static update(instance: IBuildingInstance) {
        // const state = instance.state as IDepotState;
        // if (state.amount > 0) {
        //     if (state.outputTimer < 0) {
        //         console.assert(state.type !== null);
        //         if (BuildingUtils.tryFillAdjacentCells(instance, state.type!)) {
        //             Depots.removeResource(instance);
        //             state.outputTimer = depotsConfig.outputFrequency;
        //         }
        //     } else {
        //         state.outputTimer -= time.deltaTime;
        //     }
        // }

        // const { resourcesPerSlot, slotCount } = depotsConfig;
        // const capacity = slotCount * resourcesPerSlot;
        // if (state.amount < capacity) {
        //     if (state.inputTimer < 0) {
        //         const resourceType = BuildingUtils.tryGetFromAdjacentCells(instance, state.type);
        //         if (resourceType) {
        //             Depots.tryDepositResource(instance, resourceType);
        //             state.inputTimer = depotsConfig.inputFrequency;
        //         }
        //     } else {
        //         state.inputTimer -= time.deltaTime;
        //     }
        // }
    }

    public static getDepotsInRange(_sectorCoords: Vector2, _localCoords: Vector2, buildingType: BuildableType) {
        const { size, buildCost } = buildingConfig[buildingType];

        const validDepots = buildCost.reduce((prev, cur) => {
            const [required] = cur;
            return {
                ...prev,
                [required]: null!
            }
        }, {} as Record<RawResourceType | ResourceType, {
            type: ResourceType | RawResourceType;
            depot: IBuildingInstance;
        }>);

        const { size: depotSize } = buildingConfig["depot"];
        const { range } = config.depots;
        cellCoords.set(_sectorCoords.x * mapRes + _localCoords.x, _sectorCoords.y * mapRes + _localCoords.y);
        const minX = cellCoords.x;
        const maxX = cellCoords.x + (size?.x ?? 0);
        const minY = cellCoords.y;
        const maxY = cellCoords.y + (size?.z ?? 0);
        const { depotsCache } = GameMapState.instance;
        for (const [dx, dy] of [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
            neighborSectorCoords.set(_sectorCoords.x + dx, _sectorCoords.y + dy);
            const sectorId = `${neighborSectorCoords.x},${neighborSectorCoords.y}`;
            const list = depotsCache.get(sectorId);
            if (!list) {
                continue;
            }
            for (const depot of list) {
                const startX = depot.mapCoords.x - range;
                const startY = depot.mapCoords.y - range;
                const endX = startX + range * 2 + depotSize.x;
                const endY = startY + range * 2 + depotSize.z;
                if (endX < minX || startX > maxX || endY < minY || startY > maxY) {
                    continue;
                }
                for (const [required, amount] of buildCost) {
                    const alreadyFound = validDepots[required] !== null;
                    if (alreadyFound) {
                        continue;
                    }
                    if (Depots.hasResource(depot, required, amount)) {
                        validDepots[required] = {
                            type: required,
                            depot
                        };
                    }
                }
            }
        }

        return Object.values(validDepots).filter(Boolean);
    }

    public static testDepots(
        depots: Array<{ type: ResourceType | RawResourceType; depot: IBuildingInstance }>,
        buildingType: BuildableType
    ) {
        if (buildingType === "depot") {
            const { depotsCache } = GameMapState.instance;
            if (depotsCache.size === 0) {
                //first depot is free
                return true;
            }
        }
        const { buildCost } = buildingConfig[buildingType];
        if (Object.keys(depots).length < buildCost.length) {
            const requirements = buildCost.map(([type, amount]) => `${amount} ${type}`).join(" + ");
            evtBuildError.post(`${buildingType} must be built near depots. (Requires ${requirements})`);
            return false;
        }
        return true;
    }

    public static removeFromDepots(
        depots: Array<{ type: ResourceType | RawResourceType; depot: IBuildingInstance }>, 
        buildingType: BuildableType
    ) {
        const { buildCost } = buildingConfig[buildingType];
        for (const [type, amount] of buildCost) {
            const depot = depots.find(d => d.type === type)!;
            console.assert(depot);
            Depots.removeResource(depot.depot, type, amount);
        }
    }
}

