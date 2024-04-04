import { Box3, Box3Helper, FrontSide, MeshStandardMaterial, Object3D, Vector2 } from "three";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { pools } from "../../engine/core/Pools";
import { cmdFogAddCircle, cmdFogRemoveCircle } from "../../Events";
import { GameMapState } from "../components/GameMapState";
import { meshes } from "../../engine/resources/Meshes";
import { BuildingType, BuildingTypes, FactoryState, IBuildingInstance, IFactoryState, IMineState, buildingSizes } from "./BuildingTypes";
import { time } from "../../engine/core/Time";
import { resources } from "../Resources";
import { utils } from "../../engine/Utils";
import { computeUnitAddr, getCellFromAddr, makeUnitAddr } from "../unit/UnitAddr";
import gsap from "gsap";
import { RawResourceType, ResourceType } from "../GameDefinitions";

const { cellSize, mapRes } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;
const cellCoords = new Vector2();

class Buildings {

    private _instanceId = 1;
    private _buildings = new Map<BuildingType, {
        prefab: Object3D;
        boundingBox: Box3;
    }>();

    public async preload() {
        const buildings = await Promise.all(BuildingTypes.map(buildingType => meshes.load(`/models/buildings/${buildingType}.glb`)));
        for (let i = 0; i < buildings.length; i++) {
            const [building] = buildings[i];
            building.castShadow = true;
            building.receiveShadow = true;
            const material = building.material as MeshStandardMaterial;
            material.side = FrontSide;
            const buildingType = BuildingTypes[i];
            const size = buildingSizes[buildingType];
            const boundingBox = new Box3().setFromObject(building);
            boundingBox.max.y = size.y;
            this._buildings.set(buildingType, {
                prefab: building,
                boundingBox
            });
        }
    }

    public getBoundingBox(buildingType: BuildingType) {
        return this._buildings.get(buildingType)!.boundingBox;
    }

    public createFactory(sectorCoords: Vector2, localCoords: Vector2, input: RawResourceType | ResourceType, output: ResourceType) {

        const instance = this.create("factory", sectorCoords, localCoords);

        const { mapCoords } = instance;
        const size = buildingSizes["factory"];
        cellCoords.set(mapCoords.x + size.x - 1, mapCoords.y + size.z - 1);
        const outputCell = makeUnitAddr();
        computeUnitAddr(cellCoords, outputCell);

        cellCoords.set(mapCoords.x, mapCoords.y + size.z - 1);
        const inputCell = makeUnitAddr();
        computeUnitAddr(cellCoords, inputCell);

        const factoryState: IFactoryState = {
            input,
            output,
            state: FactoryState.idle,
            inputCell,
            outputCell,
            timer: 0
        };

        instance.state = factoryState;
    }    

    public create(buildingType: BuildingType, sectorCoords: Vector2, localCoords: Vector2) {

        const { layers, buildings } = GameMapState.instance;

        const instanceId = `${this._instanceId}`;
        this._instanceId++;

        const { prefab, boundingBox } = this._buildings.get(buildingType)!;
        const visual = prefab.clone();
        visual.scale.multiplyScalar(cellSize);
        visual.name = `${buildingType}-${instanceId}`;

        const box3Helper = new Box3Helper(boundingBox);
        visual.add(box3Helper);
        box3Helper.visible = false;

        const mapCoords = new Vector2(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y);
        const size = buildingSizes[buildingType];

        const buildingState = (() => {
            switch (buildingType) {
                case "mine": {
                    const resourceCells = new Array<Vector2>();
                    for (let i = 0; i < size.z; i++) {
                        for (let j = 0; j < size.x; j++) {
                            cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                            const cell = GameUtils.getCell(cellCoords)!;
                            if (cell.resource) {
                                resourceCells.push(cellCoords.clone());
                                cell.resource.visual.visible = false;
                            }
                        }
                    }
    
                    console.assert(resourceCells.length > 0, "Mine must be placed on a resource");
                    const outputCells = [...Array(size.x)].map((_, i) => {
                        cellCoords.set(mapCoords.x + i, mapCoords.y + size.z - 1);
                        const outputCell = makeUnitAddr();
                        computeUnitAddr(cellCoords, outputCell);
                        return outputCell;
                    });
                    const mineState: IMineState = {
                        cells: resourceCells,
                        active: true,
                        depleted: false,
                        currentResource: 0,
                        outputSlot: 0,
                        outputCells,
                        timer: 0
                    };
                    return mineState;
                }

                default:
                    return null;
            }
        })();        

        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingType,
            visual,
            mapCoords,
            state: buildingState,
            deleted: false
        };

        buildings.set(instanceId, buildingInstance);
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords)!;
                cell.buildingId = instanceId;
            }
        }

        visual.position.set(
            sectorCoords.x * mapSize + localCoords.x * cellSize + sectorOffset,
            0,
            sectorCoords.y * mapSize + localCoords.y * cellSize + sectorOffset
        );

        layers.buildings.add(visual);

        cellCoords.set(mapCoords.x + Math.round(size.x / 2), mapCoords.y + Math.round(size.z / 2));
        cmdFogAddCircle.post({ mapCoords: cellCoords, radius: 20 });
        return buildingInstance;
    }

    public clear(instanceId: string) {
        const { buildings } = GameMapState.instance;
        const instance = buildings.get(instanceId)!;
        buildings.delete(instanceId);
        instance.deleted = true;
        instance.visual.removeFromParent();

        const mapCoords = pools.vec2.getOne();
        const buildingType = instance.buildingType;
        const size = buildingSizes[buildingType];
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                mapCoords.set(instance.mapCoords.x + j, instance.mapCoords.y + i);
                const cell = GameUtils.getCell(mapCoords)!;
                cell.buildingId = undefined;
            }
        }

        if (buildingType === "mine") {
            // restore resources under the mine
            const state = instance.state as IMineState;
            for (const cellCoord of state.cells) {
                const resourceCell = GameUtils.getCell(cellCoord)!;
                const visual = resourceCell.resource!.visual!;
                console.assert(visual.visible === false);
                visual.visible = true;
            }

            // destroy any resources that were mined but not picked up
            for (let x = 0; x < size.x; x++) {
                cellCoords.set(instance.mapCoords.x + x, instance.mapCoords.y + size.z - 1);
                const cell = GameUtils.getCell(cellCoords)!;
                if (cell.pickableResource) {
                    cell.pickableResource.visual.removeFromParent();
                    cell.pickableResource = undefined;
                }
            }
        }

        mapCoords.set(instance.mapCoords.x + Math.round(size.x / 2), instance.mapCoords.y + Math.round(size.z / 2));
        cmdFogRemoveCircle.post({ mapCoords, radius: 20 });
    }

    public update() {
        const { buildings } = GameMapState.instance;
        for (const instance of buildings.values()) {
            switch (instance.buildingType) {
                case "mine": {
                    const miningFrequency = 2;
                    const state = instance.state as IMineState;
                    if (state.depleted) {
                        break;
                    }

                    if (!state.active) {

                        let outputFull = true;
                        for (let i = 0; i < state.outputCells.length; i++) {
                            const addr = state.outputCells[i];
                            const outputCell = getCellFromAddr(addr);
                            if (!outputCell.pickableResource) {
                                outputFull = false;
                                state.outputSlot = i;
                                break;
                            }
                        }
                        
                        if (!outputFull) {
                            state.active = true;
                            state.timer = 0;
                        }

                    } else {

                        if (state.timer >= miningFrequency) {
                            const cell = GameUtils.getCell(state.cells[state.currentResource])!;
                            const resource = cell.resource!;                            

                            let outputCell = getCellFromAddr(state.outputCells[state.outputSlot]);
                            if (outputCell.pickableResource) {

                                // slot full, find next empty slot
                                const startingSlot = state.outputSlot;
                                state.outputSlot = (state.outputSlot + 1) % state.outputCells.length;
                                while (startingSlot !== state.outputSlot) {
                                    outputCell = getCellFromAddr(state.outputCells[state.outputSlot]);
                                    if (!outputCell.pickableResource) {
                                        break;
                                    }
                                    state.outputSlot = (state.outputSlot + 1) % state.outputCells.length;
                                }                                
                            }

                            if (outputCell.pickableResource) {
                                state.active = false;

                            } else {
                                const { sector, localCoords } = state.outputCells[state.outputSlot];
                                const visual = utils.createObject(sector.layers.resources, resource.type);
                                visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
                                meshes.load(`/models/resources/${resource.type}.glb`).then(([_mesh]) => {
                                    const mesh = _mesh.clone();
                                    visual.add(mesh);
                                    mesh.position.y = 0.5;
                                    mesh.castShadow = true;
                                });
                                outputCell.pickableResource = {
                                    type: resource.type,
                                    visual
                                };
                                state.outputSlot = (state.outputSlot + 1) % state.outputCells.length;

                                resource.amount -= 1;
                                state.timer = 0;
                                if (resource.amount === 0) {
                                    resources.clear(cell);
                                    if (state.currentResource < state.cells.length - 1) {
                                        state.currentResource++;
                                    } else {
                                        console.log(`${resource.type} mine depleted at ${instance.mapCoords.x}, ${instance.mapCoords.y}`);
                                        state.depleted = true;
                                    }
                                }

                            }
                        } else {
                            state.timer += time.deltaTime;
                        }
                    }
                }
                    break;

                case "factory": {
                    const state = instance.state as IFactoryState;
                    switch (state.state) {
                        case FactoryState.idle: {                            
                            const outputCell = getCellFromAddr(state.outputCell);
                            const inputCell = getCellFromAddr(state.inputCell);
                            if (inputCell.nonPickableResource && !outputCell.pickableResource) {
                                state.state = FactoryState.inserting;
                                const visual = inputCell.nonPickableResource.visual;                                
                                gsap.to(visual.position, {
                                    z: visual.position.z - cellSize,
                                    duration: 1,
                                    delay: .5,
                                    onComplete: () => {
                                        state.state = FactoryState.processing;
                                        state.timer = 0;
                                        inputCell.nonPickableResource?.visual.removeFromParent();
                                        inputCell.nonPickableResource = undefined;
                                    }
                                });
                            }
                        }
                            break;

                        case FactoryState.processing: {
                            const productionTime = 2;
                            if (state.timer >= productionTime) {
                                // production done
                                const { sector, localCoords } = state.outputCell;
                                const outputCell = getCellFromAddr(state.outputCell);
                                console.assert(!outputCell.pickableResource);
                                const visual = utils.createObject(sector.layers.resources, state.output);
                                visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
                                meshes.load(`/models/resources/${state.output}.glb`).then(([_mesh]) => {
                                    const mesh = _mesh.clone();
                                    visual.add(mesh);
                                    mesh.position.y = 0.5;
                                    mesh.castShadow = true;
                                });
                                outputCell.pickableResource = {
                                    type: state.output,
                                    visual
                                };
                                state.state = FactoryState.idle;

                            } else {
                                state.timer += time.deltaTime;
                            }
                        }
                            break;
                    }
                }
                    break;
            }
        }
    }
}

export const buildings = new Buildings();

