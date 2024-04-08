import { Box3, Box3Helper, Object3D, Vector2 } from "three";
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
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { conveyorItems } from "../ConveyorItems";
import { ICell } from "../GameTypes";
import { objects } from "../../engine/resources/Objects";

const { cellSize, mapRes } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;
const cellCoords = new Vector2();

function processOutputCell(cell: ICell, mapCoords: Vector2) {
    if (!cell.pickableResource) {
        return;
    }
    const conveyor = cell.conveyor;
    if (conveyor) {
        const added = conveyorItems.addItem(cell, mapCoords, cell.pickableResource.type);
        if (added) {
            const { visual } = cell.pickableResource;
            visual.removeFromParent();
            cell.pickableResource = undefined;
        }
    }
}

function checkNearbyConveyors(type: ResourceType | RawResourceType, mapCoords: Vector2, dx: number, dy: number) {
    cellCoords.set(mapCoords.x + dx, mapCoords.y + dy);
    const cell = GameUtils.getCell(cellCoords);
    const conveyor = cell?.conveyor;
    if (conveyor) {
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
    return false;
}

class Buildings {

    private _instanceId = 1;
    private _buildings = new Map<BuildingType, {
        prefab: Object3D;
        boundingBox: Box3;
    }>();

    public async preload() {
        // const buildings = await Promise.all(BuildingTypes.map(buildingType => meshes.load(`/models/buildings/${buildingType}.glb`)));
        // for (let i = 0; i < buildings.length; i++) {
        //     const [building] = buildings[i];
        //     building.castShadow = true;
        //     building.receiveShadow = true;
        //     const material = building.material as MeshStandardMaterial;
        //     material.side = FrontSide;
        //     const buildingType = BuildingTypes[i];
        //     const size = buildingSizes[buildingType];
        //     // if (!building.geometry.boundingBox) {
        //     //     building.geometry.computeBoundingBox();
        //     // }
        //     // const boundingBox = building.geometry.boundingBox!.clone();            
        //     // boundingBox.max.y = size.y;
        //     const boundingBox = new Box3();
        //     boundingBox.min.set(0, 0, 0);
        //     boundingBox.max.copy(size);
        //     this._buildings.set(buildingType, {
        //         prefab: building,
        //         boundingBox
        //     });
        // }

        const buildings = await Promise.all(BuildingTypes.map(buildingType => objects.load(`/models/buildings/${buildingType}.json`)));
        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            building.traverse(child => {
                child.castShadow = true;
                child.receiveShadow = true;
            });
            const buildingType = BuildingTypes[i];
            const size = buildingSizes[buildingType];
            const boundingBox = new Box3();
            boundingBox.min.set(0, 0, 0);
            boundingBox.max.copy(size);
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

        const size = buildingSizes.factory;
        const outputX = size.x - 1;
        const outputY = size.z - 1;

        const { mapCoords } = instance;
        cellCoords.set(mapCoords.x + outputX, mapCoords.y + outputY);
        const outputCell = makeUnitAddr();
        computeUnitAddr(cellCoords, outputCell);

        const factoryState: IFactoryState = {
            input,
            output,
            state: FactoryState.idle,
            inputReserve: 0,
            inputAccepFrequency: 1,
            inputTimer: -1,
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

                    const outputX = size.x - 1;
                    const outputY = size.z - 1;

                    console.assert(resourceCells.length > 0, "Mine must be placed on a resource");
                    cellCoords.set(mapCoords.x + outputX, mapCoords.y + outputY);
                    const outputCell = makeUnitAddr();
                    computeUnitAddr(cellCoords, outputCell);

                    const mineState: IMineState = {
                        resourceCells,
                        currentResourceCell: 0,
                        minedResource: null,
                        active: true,
                        depleted: false,
                        outputCell,
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
                const onEdge = i === 0 || j === 0 || i === size.z - 1 || j === size.x - 1;
                cell.building = {
                    instanceId,
                    edge: onEdge                
                };
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
                cell.building = undefined;
            }
        }

        if (buildingType === "mine") {
            // restore resources under the mine
            const state = instance.state as IMineState;
            for (const cellCoord of state.resourceCells) {
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
        } else if (buildingType === "factory") {
            const state = instance.state as IFactoryState;
            const outputCell = getCellFromAddr(state.outputCell);
            if (outputCell.pickableResource) {
                outputCell.pickableResource.visual.removeFromParent();
                outputCell.pickableResource = undefined;
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

                        const outputCell = getCellFromAddr(state.outputCell);
                        if (!outputCell.pickableResource) {
                            if (state.minedResource) {

                                if (outputCell.conveyor) {
                                    if (conveyorItems.addItem(outputCell, state.outputCell.mapCoords, state.minedResource)) {
                                        state.minedResource = null;
                                    }
                                }

                            } else {
                                // start mining a new resource
                                state.active = true;
                                state.timer = 0;
                            }
                        }

                    } else {

                        if (state.timer >= miningFrequency) {
                            const cell = GameUtils.getCell(state.resourceCells[state.currentResourceCell])!;
                            const resource = cell.resource!;

                            const outputCell = getCellFromAddr(state.outputCell);
                            console.assert(!outputCell.pickableResource);

                            resource.amount -= 1;
                            if (resource.amount === 0) {
                                resources.clear(cell);
                                if (state.currentResourceCell < state.resourceCells.length - 1) {
                                    state.currentResourceCell++;
                                } else {
                                    console.log(`${resource.type} mine depleted at ${instance.mapCoords.x}, ${instance.mapCoords.y}`);
                                    state.depleted = true;
                                }
                            }

                            state.active = false;
                            state.minedResource = resource.type;

                            const { sector, localCoords } = state.outputCell;
                            if (outputCell.conveyor) {

                                if (conveyorItems.addItem(outputCell, state.outputCell.mapCoords, state.minedResource)) {
                                    state.minedResource = null;
                                }

                            } else {
                                const visual = utils.createObject(sector.layers.resources, resource.type);
                                visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
                                meshes.load(`/models/resources/${resource.type}.glb`).then(([_mesh]) => {
                                    const mesh = _mesh.clone();
                                    visual.add(mesh);
                                    mesh.position.y = 0.5;
                                    mesh.castShadow = true;
                                });
                                outputCell.pickableResource = {
                                    type: state.minedResource!,
                                    visual
                                };
                                state.minedResource = null;
                            }

                        } else {
                            state.timer += time.deltaTime;
                        }
                    }

                    processOutputCell(getCellFromAddr(state.outputCell), state.outputCell.mapCoords);

                }
                    break;

                case "factory": {
                    const state = instance.state as IFactoryState;
                    const outputCell = getCellFromAddr(state.outputCell);

                    switch (state.state) {
                        case FactoryState.idle: {
                            if (outputCell.pickableResource) {
                                // output full, can't process
                            } else {
                                if (state.inputReserve > 0) {
                                    state.inputReserve--;
                                    state.state = FactoryState.processing;
                                    state.timer = 0;
                                }        
                            }
                        }
                            break;

                        case FactoryState.processing: {
                            const productionTime = 2;
                            if (state.timer >= productionTime) {

                                // production done
                                const { sector, localCoords } = state.outputCell;
                                const outputCell = getCellFromAddr(state.outputCell);

                                if (outputCell.conveyor) {

                                    if (conveyorItems.addItem(outputCell, state.outputCell.mapCoords, state.output)) {
                                        state.state = FactoryState.idle;
                                    }

                                } else {
                                    console.assert(!outputCell.pickableResource);
                                    const visual = utils.createObject(sector.layers.resources, state.output);
                                    visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, (localCoords.y + 1) * cellSize + cellSize / 2);
                                    meshes.load(`/models/resources/${state.output}.glb`).then(([_mesh]) => {
                                        const mesh = _mesh.clone();
                                        visual.add(mesh);
                                        mesh.position.y = 0.5;
                                        mesh.castShadow = true;
                                    });
                                    state.state = FactoryState.idle;
                                    outputCell.pickableResource = {
                                        type: state.output,
                                        visual
                                    };
                                }

                            } else {
                                state.timer += time.deltaTime;
                            }
                        }
                            break;
                    }

                    // check nearby conveyors
                    if (state.inputTimer < 0) {
                        const size = buildingSizes.factory;
                        let inputAccepted = false;
                        for (let x = 0; x < size.x; ++x) {
                            if (checkNearbyConveyors(state.input, instance.mapCoords, x, -1)) {
                                state.inputReserve++;
                                state.inputTimer = state.inputAccepFrequency;
                                inputAccepted = true;
                                break;
                            }
                            if (checkNearbyConveyors(state.input, instance.mapCoords, x, size.z)) {
                                state.inputReserve++;
                                state.inputTimer = state.inputAccepFrequency;
                                inputAccepted = true;
                                break;
                            }
                        }
                        if (!inputAccepted) {
                            for (let z = 0; z < size.z; ++z) {
                                if (checkNearbyConveyors(state.input, instance.mapCoords, -1, z)) {
                                    state.inputReserve++;
                                    state.inputTimer = state.inputAccepFrequency;
                                    break;
                                }
                                if (checkNearbyConveyors(state.input, instance.mapCoords, size.x, z)) {
                                    state.inputReserve++;
                                    state.inputTimer = state.inputAccepFrequency;
                                    break;
                                }
                            }
                        }

                    } else {
                        state.inputTimer -= time.deltaTime;
                    }

                    processOutputCell(outputCell, state.outputCell.mapCoords);
                }
                    break;
            }
        }
    }
}

export const buildings = new Buildings();

