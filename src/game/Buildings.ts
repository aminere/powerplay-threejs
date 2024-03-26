import { Box3, Box3Helper, Object3D, Vector2 } from "three";
import { config } from "./config";
import { IBuildingInstance } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { pools } from "../engine/core/Pools";
import { objects } from "../engine/resources/Objects";
import { cmdFogAddCircle, cmdFogRemoveCircle } from "../Events";
import { GameMapState } from "./components/GameMapState";
import { BuildingType, BuildingTypes } from "./GameDefinitions";

const { cellSize, mapRes } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;

class Buildings {

    private _instanceId = 1;
    private _buildings = new Map<BuildingType, {
        prefab: Object3D;
        boundingBox: Box3;
    }>();

    public async preload() {
        const buildings = await Promise.all(BuildingTypes.map(buildingType => objects.load(`/models/buildings/${buildingType}.json`)));
        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            const buildingType = BuildingTypes[i];
            const buildingConfig = config.buildings[buildingType];
            const boundingBox = new Box3().setFromObject(building);
            boundingBox.max.y = buildingConfig.size.y;
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
        const obj = prefab.clone();
        obj.scale.multiplyScalar(cellSize);
        obj.name = `${buildingType}-${instanceId}`;
        
        const box3Helper = new Box3Helper(boundingBox);
        obj.add(box3Helper);
        box3Helper.visible = false;

        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingType,
            obj,
            mapCoords: new Vector2(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y)
        };

        buildings.set(instanceId, buildingInstance);

        obj.position.set(
            sectorCoords.x * mapSize + localCoords.x * cellSize + sectorOffset, 
            0,
            sectorCoords.y * mapSize + localCoords.y * cellSize + sectorOffset
        );

        layers.buildings.add(obj);

        const buildingConfig = config.buildings[buildingType];
        const mapCoords = pools.vec2.getOne();
        for (let i = 0; i < buildingConfig.size.z; i++) {
            for (let j = 0; j < buildingConfig.size.x; j++) {
                mapCoords.set(buildingInstance.mapCoords.x + j, buildingInstance.mapCoords.y + i);
                const cell = GameUtils.getCell(mapCoords)!;
                console.assert(cell);
                cell.buildingId = instanceId;
            }
        }
        
        mapCoords.set(buildingInstance.mapCoords.x + Math.round(buildingConfig.size.x / 2), buildingInstance.mapCoords.y + Math.round(buildingConfig.size.z / 2));
        cmdFogAddCircle.post({ mapCoords, radius: 20 });
    }

    public clear(instanceId: string) {
        const { buildings } = GameMapState.instance;
        const instance = buildings.get(instanceId)!;
        buildings.delete(instanceId);
        instance.obj.removeFromParent();

        const mapCoords = pools.vec2.getOne();
        const buildingType = instance.buildingType;
        const buildingConfig = config.buildings[buildingType];
        for (let i = 0; i < buildingConfig.size.z; i++) {
            for (let j = 0; j < buildingConfig.size.x; j++) {
                mapCoords.set(instance.mapCoords.x + j, instance.mapCoords.y + i);
                const cell = GameUtils.getCell(mapCoords)!;
                cell.buildingId = undefined;
            }
        }

        mapCoords.set(instance.mapCoords.x + Math.round(buildingConfig.size.x / 2), instance.mapCoords.y + Math.round(buildingConfig.size.z / 2));
        cmdFogRemoveCircle.post({ mapCoords, radius: 20 });
    }
}

export const buildings = new Buildings();

