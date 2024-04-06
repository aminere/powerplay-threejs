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
import { resourceUtils } from "../ResourceUtils";
import { conveyorItems } from "../ConveyorItems";

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
            if (!building.geometry.boundingBox) {
                building.geometry.computeBoundingBox();
            }
            const boundingBox = building.geometry.boundingBox!.clone();            
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
        const inputCellAddr = makeUnitAddr();
        computeUnitAddr(cellCoords, inputCellAddr);
        const inputCell = getCellFromAddr(inputCellAddr);
        inputCell.acceptsResource = input;

        const factoryState: IFactoryState = {
            input,
            output,
            state: FactoryState.idle,
            inputCell: inputCellAddr,
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
                    cellCoords.set(mapCoords.x, mapCoords.y + size.z - 1);
                    const outputCell = makeUnitAddr();
                    computeUnitAddr(cellCoords, outputCell);

                    const mineState: IMineState = {
                        resourceCells,
                        active: true,
                        outputting: false,
                        depleted: false,
                        currentResource: 0,
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
            const inputCell = getCellFromAddr(state.inputCell);
            inputCell.acceptsResource = undefined;
            if (inputCell.nonPickableResource) {
                inputCell.nonPickableResource.visual.removeFromParent();
                inputCell.nonPickableResource = undefined;
            }
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
                        if (!outputCell.pickableResource && !state.outputting) {
                            state.active = true;
                            state.timer = 0;
                        }                        

                    } else {

                        if (state.timer >= miningFrequency) {
                            const cell = GameUtils.getCell(state.resourceCells[state.currentResource])!;
                            const resource = cell.resource!;                            

                            const outputCell = getCellFromAddr(state.outputCell);
                            console.assert(!outputCell.pickableResource);                           

                            resource.amount -= 1;
                            if (resource.amount === 0) {
                                resources.clear(cell);
                                if (state.currentResource < state.resourceCells.length - 1) {
                                    state.currentResource++;
                                } else {
                                    console.log(`${resource.type} mine depleted at ${instance.mapCoords.x}, ${instance.mapCoords.y}`);
                                    state.depleted = true;
                                }
                            }
                            
                            const { sector, localCoords } = state.outputCell;
                            const visual = utils.createObject(sector.layers.resources, resource.type);
                            visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, (localCoords.y - 1) * cellSize + cellSize / 2);
                            meshes.load(`/models/resources/${resource.type}.glb`).then(([_mesh]) => {
                                const mesh = _mesh.clone();
                                visual.add(mesh);
                                mesh.position.y = 0.5;
                                mesh.castShadow = true;
                            });

                            state.active = false;
                            state.outputting = true;
                            gsap.to(visual.position, {
                                z: visual.position.z + cellSize,
                                duration: 1,
                                delay: .5,
                                onComplete: () => {
                                    state.outputting = false;
                                    outputCell.pickableResource = {
                                        type: resource.type,
                                        visual
                                    };
                                }
                            });

                        } else {
                            state.timer += time.deltaTime;
                        }
                    }

                    // check nearby conveyors
                    const outputCell = getCellFromAddr(state.outputCell);
                    if (outputCell.pickableResource) {
                        const outputCoords = state.outputCell.mapCoords;
                        cellCoords.set(outputCoords.x, outputCoords.y + 1);
                        const conveyorCell = GameUtils.getCell(cellCoords);
                        const conveyor = conveyorCell?.conveyor;
                        if (conveyor) {
                            const added = conveyorItems.addItem(conveyorCell, cellCoords, outputCell.pickableResource.type);
                            if (added) {
                                const { visual } = outputCell.pickableResource;
                                visual.removeFromParent();
                                outputCell.pickableResource = undefined;
                            }
                        }
                    }
                    
                }
                    break;

                case "factory": {
                    const state = instance.state as IFactoryState;
                    const inputCell = getCellFromAddr(state.inputCell);
                    const outputCell = getCellFromAddr(state.outputCell);

                    switch (state.state) {
                        case FactoryState.idle: {                            
                            if (outputCell.pickableResource) {
                                // output full, can't process
                            } else {
                                if (inputCell.nonPickableResource) {
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
                                visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, (localCoords.y - 1) * cellSize + cellSize / 2);
                                meshes.load(`/models/resources/${state.output}.glb`).then(([_mesh]) => {
                                    const mesh = _mesh.clone();
                                    visual.add(mesh);
                                    mesh.position.y = 0.5;
                                    mesh.castShadow = true;
                                });

                                state.state = FactoryState.outputting;
                                gsap.to(visual.position, {
                                    z: visual.position.z + cellSize,
                                    duration: 1,
                                    delay: .5,
                                    onComplete: () => {
                                        state.state = FactoryState.idle;
                                        outputCell.pickableResource = {
                                            type: state.output,
                                            visual
                                        };
                                    }
                                });

                            } else {
                                state.timer += time.deltaTime;
                            }
                        }
                            break;
                    }

                    // check nearby conveyors
                    if (!inputCell.nonPickableResource) {
                        const inputCoords = state.inputCell.mapCoords;
                        cellCoords.set(inputCoords.x, inputCoords.y + 1);
                        const cell = GameUtils.getCell(cellCoords);
                        const conveyor = cell?.conveyor;
                        if (conveyor) {
                            let itemToGet = -1;
                            for (let i = 0; i < conveyor.items.length; i++) {
                                const item = conveyor.items[i];
                                if (item.type === state.input) {
                                    itemToGet = i;
                                    break;
                                }
                            }
                            if (itemToGet >= 0) {
                                const item = conveyor.items[itemToGet];
                                utils.fastDelete(conveyor.items, itemToGet);
                                conveyorItems.removeItem(item);
                                const resourceType = item.type;
                                const { sector, localCoords } = state.inputCell;
                                // this will set inputCell.nonPickableResource
                                resourceUtils.setResource(inputCell, sector, localCoords, resourceType);
                            }
                        }
                    }        
                    
                    if (outputCell.pickableResource) {
                        const outputCoords = state.outputCell.mapCoords;
                        cellCoords.set(outputCoords.x, outputCoords.y + 1);
                        const cell = GameUtils.getCell(cellCoords);
                        const conveyor = cell?.conveyor;
                        if (conveyor) {
                            const added = conveyorItems.addItem(cell, cellCoords, state.output);
                            if (added) {
                                const { visual } = outputCell.pickableResource;
                                visual.removeFromParent();
                                outputCell.pickableResource = undefined;
                            }
                        }
                    }
                }
                    break;
            }
        }
    }
}

export const buildings = new Buildings();

