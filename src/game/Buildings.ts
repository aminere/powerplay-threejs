import { Box3, Box3Helper, Object3D, Vector2 } from "three";
import { config } from "./config";
import { IBuildingInstance } from "./GameTypes";
import { gameMapState } from "./components/GameMapState";
import { GameUtils } from "./GameUtils";
import { pools } from "../engine/core/Pools";
import { objects } from "../engine/resources/Objects";

const { cellSize, mapRes } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;

class Buildings {

    private _instanceId = 1;
    private _buildings = new Map<string, {
        prefab: Object3D;
        boundingBox: Box3;
    }>();

    public async preload() {
        const buildindIds = Object.keys(config.buildings);
        const buildings = await Promise.all(buildindIds.map(buildingId => objects.load(`/models/buildings/${buildingId}.json`)));
        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            const buildingId = buildindIds[i];
            const buildingConfig = config.buildings[buildingId];
            const boundingBox = new Box3().setFromObject(building);
            boundingBox.max.y = buildingConfig.size.y;
            this._buildings.set(buildingId, {
                prefab: building,
                boundingBox
            });
        }
    }

    public getBoundingBox(buildingId: string) {
        return this._buildings.get(buildingId)!.boundingBox;
    }

    public create(buildingId: string, sectorCoords: Vector2, localCoords: Vector2) {

        const { layers } = gameMapState;

        const instanceId = `${this._instanceId}`;
        this._instanceId++;

        const { prefab, boundingBox }  = this._buildings.get(buildingId)!;
        const obj = prefab.clone();
        obj.scale.multiplyScalar(cellSize);
        obj.name = `${buildingId}-${instanceId}`;
        
        const box3Helper = new Box3Helper(boundingBox);
        obj.add(box3Helper);
        box3Helper.visible = false;

        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingId,
            obj,
            mapCoords: new Vector2(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y)
        };

        const buildings = gameMapState.instance!.buildings;
        buildings.set(instanceId, buildingInstance);

        obj.position.set(
            sectorCoords.x * mapSize + localCoords.x * cellSize + sectorOffset, 
            0,
            sectorCoords.y * mapSize + localCoords.y * cellSize + sectorOffset
        );

        layers.buildings.add(obj);

        const buildingConfig = config.buildings[buildingId];
        const mapCoords = pools.vec2.getOne();
        for (let i = 0; i < buildingConfig.size.z; i++) {
            for (let j = 0; j < buildingConfig.size.x; j++) {
                mapCoords.set(sectorCoords.x * mapRes + localCoords.x + j, sectorCoords.y * mapRes + localCoords.y + i);
                const cell = GameUtils.getCell(mapCoords)!;
                console.assert(cell);
                cell.buildingId = instanceId;
                cell.isEmpty = false;
                cell.flowFieldCost = 0xffff;
            }
        }        
    }

    public clear(instanceId: string) {
        const buildings = gameMapState.instance!.buildings;
        const instance = buildings.get(instanceId)!;
        buildings.delete(instanceId);
        instance.obj.removeFromParent();

        const mapCoords = pools.vec2.getOne();
        const buildingId = instance.buildingId;
        const buildingConfig = config.buildings[buildingId];
        for (let i = 0; i < buildingConfig.size.z; i++) {
            for (let j = 0; j < buildingConfig.size.x; j++) {
                mapCoords.set(instance.mapCoords.x + j, instance.mapCoords.y + i);
                const cell = GameUtils.getCell(mapCoords)!;
                if (cell) {
                    delete cell.buildingId;
                    console.assert(!cell.resource);
                    cell.isEmpty = true;
                    cell.flowFieldCost = 1;
                }
            }
        }
    }
}

export const buildings = new Buildings();

