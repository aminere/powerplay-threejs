import { Box3, Box3Helper, Object3D, Vector2 } from "three";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { pools } from "../../engine/core/Pools";
import { cmdFogAddCircle, cmdFogRemoveCircle } from "../../Events";
import { GameMapState } from "../components/GameMapState";
import { meshes } from "../../engine/resources/Meshes";
import { BuildingType, BuildingTypes, IBuildingInstance, IMineState, buildingSizes } from "./BuildingTypes";
import { time } from "../../engine/core/Time";
import { resources } from "../Resources";
import { utils } from "../../engine/Utils";

const { cellSize, mapRes } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;
const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();

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

    public create(buildingType: BuildingType, sectorCoords: Vector2, localCoords: Vector2) {

        const { layers, buildings } = GameMapState.instance;

        const instanceId = `${this._instanceId}`;
        this._instanceId++;

        const { prefab, boundingBox }  = this._buildings.get(buildingType)!;
        const visual = prefab.clone();
        visual.scale.multiplyScalar(cellSize);
        visual.name = `${buildingType}-${instanceId}`;
        
        const box3Helper = new Box3Helper(boundingBox);
        visual.add(box3Helper);
        box3Helper.visible = false;

        const mapCoords = new Vector2(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y);
        const size = buildingSizes[buildingType];
        
        let buildingInstance: IBuildingInstance | null = null;
        if (buildingType === "mine") {

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
            buildingInstance = {
                id: instanceId,
                buildingType,
                visual,
                mapCoords,
                state: {
                    currentCell: 0,
                    timer: 0,
                    outputSlot: 0,
                    cells: resourceCells,
                    active: true
                }
            }

        } else {
            buildingInstance = {
                id: instanceId,
                buildingType,
                visual,
                mapCoords,
                state: null // TODO
            }
        }

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
    }

    public clear(instanceId: string) {
        const { buildings } = GameMapState.instance;
        const instance = buildings.get(instanceId)!;
        buildings.delete(instanceId);
        instance.visual.removeFromParent();

        const mapCoords = pools.vec2.getOne();
        const buildingType = instance.buildingType;
        const size = buildingSizes[buildingType];
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                mapCoords.set(instance.mapCoords.x + j, instance.mapCoords.y + i);
                const cell = GameUtils.getCell(mapCoords)!;

                if (buildingType === "mine") {
                    const state = instance.state as IMineState;
                    for (const cellCoord of state.cells) {
                        const resourceCell = GameUtils.getCell(cellCoord)!;
                        const visual = resourceCell.resource!.visual!;
                        console.assert(visual.visible === false);
                        visual.visible = true;
                    }
                }

                cell.buildingId = undefined;
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
                    if (!state.active) {
                        break;
                    }
                    
                    if (state.timer >= miningFrequency) {                        
                        const cellCoords = state.cells[state.currentCell];
                        const cell = GameUtils.getCell(cellCoords)!;
                        const resource = cell.resource!;                       
                        
                        const size = buildingSizes[instance.buildingType];
                        cellCoords.set(instance.mapCoords.x + state.outputSlot, instance.mapCoords.y + size.z - 1);
                        let outputCell = GameUtils.getCell(cellCoords, sectorCoords, localCoords)!;
                        if (outputCell.pickableResource) {
                            state.outputSlot = (state.outputSlot + 1) % size.x;
                            cellCoords.set(instance.mapCoords.x + state.outputSlot, instance.mapCoords.y + size.z - 1);
                            outputCell = GameUtils.getCell(cellCoords, sectorCoords, localCoords)!;
                        }

                        if (!outputCell.pickableResource) {
                            const sector = GameUtils.getSector(sectorCoords)!;
                            const visual = utils.createObject(sector.layers.resources, resource.type);
                            visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
                            meshes.load(`/models/resources/${resource.type}.glb`).then(([mesh]) => visual.add(mesh));                            
                            outputCell.pickableResource = {
                                type: resource.type,
                                visual
                            };
                            state.outputSlot = (state.outputSlot + 1) % size.x;

                            resource.amount -= 1;
                            state.timer = 0;
                            if (resource.amount === 0) {
                                resources.clear(cell);
                                if (state.currentCell < state.cells.length - 1) {
                                    state.currentCell++;
                                } else {
                                    console.log(`${resource.type} mine depleted at ${instance.mapCoords.x}, ${instance.mapCoords.y}`);
                                    state.active = false;
                                }
                            }      

                        } else {
                            console.log(`${resource.type} mine output is full`);
                        }                  
                    } else {
                        state.timer += time.deltaTime;
                    }
                }
                break;
            }
        }
    }
}

export const buildings = new Buildings();

