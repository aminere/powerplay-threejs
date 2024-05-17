import { Color, MathUtils, Vector2, Vector3 } from "three";
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
import { BuildingUtils } from "./BuildingUtils";
import { time } from "../../engine/core/Time";
import { GameUtils } from "../GameUtils";
import gsap from "gsap";
import { Sector } from "../Sector";

const { mapRes, cellSize } = config.game;
const cellCoords = new Vector2();
const neighborSectorCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();
const worldPos = new Vector3();
const minCell = new Vector2();
const maxCell = new Vector2();
const highlightColor = new Color(0, 1, 0);
const white = new Color(1, 1, 1);

const depotsConfig = {
    slotCount: 9,
    slotsPerRow: 3,
    resourcesPerSlot: 5,
    slotStart: new Vector3(1.23, 0.43, 1.19),
    slotSize: .83,
    slotScaleRange: [.8, 1.3],
    inputFrequency: 1,
    outputFrequency: 1,
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

class Depots {

    private _highlighted = false;

    public create(sectorCoords: Vector2, localCoords: Vector2) {
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
            autoOutput: false,
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

    public tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {

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

    public hasResource(instance: IBuildingInstance, type: RawResourceType | ResourceType, amount: number) {
        const reserves = this.getReservesPerType(instance);
        const reserve = reserves[type] ?? 0;
        return reserve >= amount;
    }

    public removeResource(
        instance: IBuildingInstance, 
        type: RawResourceType | ResourceType, 
        _amount: number,
    ) {
        const state = instance.state as IDepotState;
        const { slots, root: slotsRoot } = state.slots;

        const removeOne = () => {
            const amount = 1;
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
        }
        
        for (let i = 0; i < _amount; i++) {
            removeOne();
        }

        evtBuildingStateChanged.post(instance);
    }

    public clear(instance: IBuildingInstance) {
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

    public update(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;        

        if (state.autoOutput) {
            const reserve = state.slots.slots.reduce((prev, cur) => prev + (cur?.amount ?? 0), 0);
            if (reserve > 0) {
                if (state.outputTimer < 0) {
                    const output = (() => {
                        if (state.output) {
                            return state.output;
                        }
                        return state.slots.slots.find(slot => slot.amount > 0)!.type!;
                    })();
                    console.assert(output);
                    if (this.output(instance, output)) {
                        state.outputTimer = depotsConfig.outputFrequency;
                    }
                } else {
                    state.outputTimer -= time.deltaTime;
                }
            }
        }
        
        if (state.inputTimer < 0) {
            const { resourcesPerSlot } = depotsConfig;
            for (const slot of state.slots.slots) {
                if (slot.amount < resourcesPerSlot) {
                    const resourceType = BuildingUtils.tryGetFromAdjacentCells(instance, slot.type);
                    if (resourceType) {
                        this.tryDepositResource(instance, resourceType);
                        state.inputTimer = depotsConfig.inputFrequency;
                        break;
                    }
                }
            }                
        } else {
            state.inputTimer -= time.deltaTime;
        }        
    }

    public getDepotsInRange(_sectorCoords: Vector2, _localCoords: Vector2, buildingType: BuildableType) {
        const { size } = buildingConfig[buildingType];
        const { size: depotSize } = buildingConfig["depot"];
        const depots: IBuildingInstance[] = [];
        const { range } = config.depots;
        cellCoords.set(_sectorCoords.x * mapRes + _localCoords.x, _sectorCoords.y * mapRes + _localCoords.y);
        const minX = cellCoords.x;
        const maxX = cellCoords.x + (size?.x ?? 1) - 1;
        const minY = cellCoords.y;
        const maxY = cellCoords.y + (size?.z ?? 1) - 1;
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
                const endX = startX + range * 2 + depotSize.x - 1;
                const endY = startY + range * 2 + depotSize.z - 1;
                if (endX < minX || startX > maxX || endY < minY || startY > maxY) {
                    continue;
                }
                depots.push(depot);
            }
        }
        return depots;
    }

    public testDepots(depots: IBuildingInstance[], buildingType: BuildableType, showError = true) {

        const { depotsCache } = GameMapState.instance;
        if (buildingType === "depot") {            
            if (depotsCache.size === 0) {
                //first depot is free
                return true;
            }
        }

        if (depots.length === 0) {
            if (showError) {
                evtBuildError.post(`${buildingType} must be built near depots`);
            }            
            return false;
        }

        const { buildCost } = buildingConfig[buildingType];
        const validDepots = new Map<ResourceType | RawResourceType, IBuildingInstance>();

        for (const [required, amount] of buildCost) {
            const alreadyFound = validDepots.get(required) !== undefined;
            if (alreadyFound) {
                continue;
            }
            for (const depot of depots) {
                if (this.hasResource(depot, required, amount)) {
                    validDepots.set(required, depot);
                }
            }
        }

        if (validDepots.size < buildCost.length) {
            const requirements = buildCost.map(([type, amount]) => `${amount} ${type}`).join(" + ");
            if (showError) {
                evtBuildError.post(`Not enough resources in nearby depots to build ${buildingType}. (Requires ${requirements})`);
            }
            return false;
        }
        return true;
    }

    public removeFromDepots(depots: IBuildingInstance[], buildingType: BuildableType, buildingCoords: Vector2) {
        const { buildCost } = buildingConfig[buildingType];
        const { flyingItems } = GameMapState.instance.layers;
        for (const [type, amount] of buildCost) {
            const depot = depots.find(depot => this.hasResource(depot, type, amount))!;            
            console.assert(depot);
            if (!depot) {
                continue;
            }

            this.removeResource(depot, type, amount);
            
            // animation effect, send resource to the top of the building            
            const { size } = buildingConfig[buildingType];            
            const sizeX = size?.x ?? 0;
            const sizeZ = size?.z ?? 0;
            cellCoords.set(Math.round(buildingCoords.x + sizeX / 2), Math.round(buildingCoords.y + sizeZ / 2));
            GameUtils.mapToWorld(cellCoords, worldPos);
            worldPos.setY(size?.y ?? .2);
            
            const [_mesh] = meshes.loadImmediate(`/models/resources/${type}.glb`);            
            const tl = gsap.timeline();
            const { size: depotSize } = buildingConfig.depot;
            for (let i = 0; i < amount; ++i) {
                const mesh = _mesh.clone();
                const { position } = depot.visual;
                mesh.position.set(
                    position.x + (depotSize.x * cellSize) / 2,
                    position.y + depotsConfig.slotStart.y,
                    position.z + (depotSize.z * cellSize) / 2
                );
                flyingItems.add(mesh);
                tl.to(mesh!.position, { 
                    ...worldPos, 
                    duration: .4,
                    onComplete: () => {
                        mesh.removeFromParent();
                    }
                }, "<.2");
            }
        }
    }

    public output(instance: IBuildingInstance, type: ResourceType | RawResourceType) {
        if (BuildingUtils.produceResource(instance, type)) {
            this.removeResource(instance, type, 1);
            evtBuildingStateChanged.post(instance);
            return true;
        }
        return false;
    }

    public getReservesPerType(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;
        return state.slots.slots
            .filter(slot => slot.type !== null)
            .reduce((prev, cur) => {
                const amount = prev[cur.type!] ?? 0;
                prev[cur.type!] = amount + cur.amount;
                return prev;
            }, {} as Record<ResourceType | RawResourceType, number>);
    }

    public toggleAutoOutput(instance: IBuildingInstance) {
        const state = instance.state as IDepotState;
        state.autoOutput = !state.autoOutput;
        evtBuildingStateChanged.post(instance);
    }

    public highlightDepotRanges(highlight: boolean) {
        if (highlight === this._highlighted) {
            return;
        }

        this._highlighted = highlight;
        const { range } = config.depots;
        const { size: depotSize } = buildingConfig.depot;
        const { depotsCache } = GameMapState.instance;
        for (const [sectorId, depots] of depotsCache) {
            const [sectorX, sectorY] = sectorId.split(",").map(Number);
            sectorCoords.set(sectorX, sectorY);
            for (const depot of depots) {
                minCell.set(depot.mapCoords.x - range, depot.mapCoords.y - range);
                maxCell.set(minCell.x + range * 2 + depotSize.x, minCell.y + range * 2 + depotSize.z);
                for (let y = minCell.y; y < maxCell.y; y++) {
                    for (let x = minCell.x; x < maxCell.x; x++) {
                        cellCoords.set(x, y);
                        if (GameUtils.getCell(cellCoords, sectorCoords, localCoords)) {
                            const sector = GameUtils.getSector(sectorCoords)!;
                            Sector.updateHighlightTexture(sector, localCoords, highlight ? highlightColor : white);
                        }
                    }
                }
            }
        }
    }

    // public static showDepotSelection() {
    //     const { range } = config.depots;
    //     minCell.set(selection.building.mapCoords.x - range, selection.building.mapCoords.y - range);
    //     maxCell.set(minCell.x + range * 2 + size.x, minCell.y + range * 2 + size.z);
    //     showSelectionLines(minCell, maxCell);
    // }
}

export const depots = new Depots();

