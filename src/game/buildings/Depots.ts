import { MathUtils, Vector2, Vector3 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { BuildableType, IBuildingInstance, IDepotState } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { BuildingUtils } from "./BuildingUtils";
import { time } from "../../engine/core/Time";
import { evtBuildError, evtBuildingStateChanged } from "../../Events";
import { buildingConfig } from "../config/BuildingConfig";
import { GameMapState } from "../components/GameMapState";
import { config } from "../config/config";

const { mapRes } = config.game;
const cellCoords = new Vector2();
const neighborSectorCoords = new Vector2();

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

function canAcceptResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
    const state = instance.state as IDepotState;
    if (state.type !== type) {
        if (state.type !== null) {
            return false;
        }
    }
    return state.amount < state.capacity;
}

export class Depots {

    public static create(sectorCoords: Vector2, localCoords: Vector2) {
        const instance = buildings.create("depot", sectorCoords, localCoords);
        const { resourcesPerSlot, slotCount } = depotsConfig;

        const capacity = slotCount * resourcesPerSlot;
        const depotState: IDepotState = {
            type: null,
            amount: 0,
            capacity,
            inputTimer: depotsConfig.inputFrequency,
            outputTimer: depotsConfig.outputFrequency
        };
        instance.state = depotState;
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        if (!canAcceptResource(instance, type)) {
            return false;
        }

        const { resourcesPerSlot, slotScaleRange, slotsPerRow, slotSize, slotStart } = depotsConfig;
        const state = instance.state as IDepotState;
        const oldAmount = state.amount;
        const newAmount = oldAmount + 1;
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

    public static clear(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;
        state.amount = 0;
        state.type = null;
        instance.visual.clear();
        evtBuildingStateChanged.post(instance);
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;
        if (state.amount > 0) {
            if (state.outputTimer < 0) {
                console.assert(state.type !== null);
                if (BuildingUtils.tryFillAdjacentCells(instance, state.type!)) {
                    Depots.removeResource(instance);
                    state.outputTimer = depotsConfig.outputFrequency;
                }
            } else {
                state.outputTimer -= time.deltaTime;
            }
        }

        const { resourcesPerSlot, slotCount } = depotsConfig;
        const capacity = slotCount * resourcesPerSlot;
        if (state.amount < capacity) {
            if (state.inputTimer < 0) {
                const resourceType = BuildingUtils.tryGetFromAdjacentCells(instance, state.type);
                if (resourceType) {
                    Depots.tryDepositResource(instance, resourceType);
                    state.inputTimer = depotsConfig.inputFrequency;
                }
            } else {
                state.inputTimer -= time.deltaTime;
            }
        }
    }

    public static getDepotsInRange(_sectorCoords: Vector2, _localCoords: Vector2, buildingType: BuildableType) {
        const { size, buildCost } = buildingConfig[buildingType];
        const { depotsCache } = GameMapState.instance;
        cellCoords.set(_sectorCoords.x * mapRes + _localCoords.x, _sectorCoords.y * mapRes + _localCoords.y);
        const { range } = config.depots;

        const validDepots = buildCost.reduce((prev, cur) => {
            const [required] = cur;
            return {
                ...prev,
                [required]: null!
            }
        }, {} as Record<RawResourceType | ResourceType, IBuildingInstance>);

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
                const endX = startX + range * 2 + (size?.x ?? 1);
                const endY = startY + range * 2 + (size?.z ?? 1);
                if (cellCoords.x >= startX && cellCoords.x < endX && cellCoords.y >= startY && cellCoords.y < endY) {
                    const state = depot.state as IDepotState;

                    for (const [required, amount] of buildCost) {
                        const alreadyFound = validDepots[required] !== null;
                        if (alreadyFound) {
                            continue;
                        }
                        if (state.type === required && state.amount >= amount) {
                            validDepots[required] = depot;
                        }
                    }
                }
            }
        }

        return Object.values(validDepots).filter(Boolean);
    }

    public static testDepots(depots: IBuildingInstance[], buildingType: BuildableType) {
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

    public static removeFromDepots(depots: IBuildingInstance[], buildingType: BuildableType) {
        const { buildCost } = buildingConfig[buildingType];
        for (const depot of depots) {
            const depotState = depot.state as IDepotState;
            const [, cost] = buildCost.find(([type]) => type === depotState.type!)!;
            Depots.removeResource(depot, cost);
        }
    }
}

