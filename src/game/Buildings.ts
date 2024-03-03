import { Object3D, Vector2 } from "three";
import { config } from "./config";
import { IBuildingInstance } from "./GameTypes";
import { gameMapState } from "./components/GameMapState";
import { GameUtils } from "./GameUtils";
import { pools } from "../engine/core/Pools";
import { objects } from "../engine/resources/Objects";

const { cellSize, mapRes } = config.game;

class Buildings {

    private _buildings = new Map<string, Object3D>();

    public preload() {
        return Promise.all(Object.keys(config.buildings).map(buildingId => objects.load(`/models/buildings/${buildingId}.json`)))
            .then(buildings => {
                buildings.forEach((building, i) => {
                    const buildingId = Object.keys(config.buildings)[i];
                    this._buildings.set(buildingId, building);
                });
            });
    }

    public create(buildingId: string, sectorCoords: Vector2, localCoords: Vector2) {

        const { sectors } = gameMapState;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;        

        const instanceId = `${sector.layers.buildings.children.length}`;
        const buildingPrefab = this._buildings.get(buildingId)!;
        const obj = buildingPrefab.clone();
        obj.name = `${buildingId}-${instanceId}`;
        obj.position.set(localCoords.x * cellSize, 0, localCoords.y * cellSize);        

        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingId,
            obj,
            mapCoords: new Vector2(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y)
        };

        const buildings = gameMapState.instance!.buildings;
        buildings.set(instanceId, buildingInstance);
        sector.layers.buildings.add(obj);

        const buildingConfig = config.buildings[buildingId];
        const mapCoords = pools.vec2.getOne();
        for (let i = 0; i < buildingConfig.size.y; i++) {
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
        for (let i = 0; i < buildingConfig.size.y; i++) {
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

