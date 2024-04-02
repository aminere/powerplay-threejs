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

        if (buildingType === "mine") {
            console.log("Ignoring mine");
            return;
        }

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
        const resourceCells = new Array<Vector2>();
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords)!;
                cell.buildingId = instanceId;
                if (cell.resource) {
                    resourceCells.push(cellCoords.clone());
                }
            }
        }
        
        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingType,
            visual,
            mapCoords,
            state: (() => {
                // switch (buildingType) {
                //     case "mine": {                       
                //         console.assert(resourceCells.length > 0, "Mine must be placed on a resource");
                //         const mineState: IMineState = {
                //             currentCell: 0,
                //             timer: 0,
                //             outputSlot: 0,
                //             cells: resourceCells
                //         };
                //         return mineState;
                //     }
                // }
                return null;
            })()
        };

        buildings.set(instanceId, buildingInstance);

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
                    state.timer += time.deltaTime;
                    if (state.timer >= miningFrequency) {                       
                        state.timer = 0;
                        const cellCoords = state.cells[state.currentCell];
                        const cell = GameUtils.getCell(cellCoords)!;
                        const resource = cell.resource!;                        
                        resource.amount -= 1;

                        console.log(`Mining ${resource.type}`);

                        if (resource.amount === 0) {
                            resources.clear(cell);
                            if (state.currentCell < state.cells.length - 1) {
                                state.currentCell++;
                            } else {
                                // mine is depleted
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

