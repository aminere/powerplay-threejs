import { Box3, Material, MeshStandardMaterial, Object3D, Vector2 } from "three";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { cmdFogAddCircle, cmdFogRemoveCircle, evtBuildingStateChanged } from "../../Events";
import { GameMapState } from "../components/GameMapState";
import { meshes } from "../../engine/resources/Meshes";
import { BuildingType, BuildingTypes, IBuildingInstance, IMineState } from "./BuildingTypes";
import { Mines } from "./Mines";
import { Factories } from "./Factories";
import { Depots } from "./Depots";
import { Incubators } from "./Incubators";
import { utils } from "../../engine/Utils";
import { buildingConfig } from "./BuildingConfig";

const { cellSize, mapRes } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;
const cellCoords = new Vector2();
const sectorCoords = new Vector2();

class Buildings {

    private _instanceId = 1;
    private _buildings = new Map<BuildingType, {
        prefab: Object3D;
        boundingBox: Box3;
    }>();

    public async preload() {
        if (this._buildings.size > 0) {
            return;
        }

        const buildings = await Promise.all(BuildingTypes.map(buildingType => meshes.load(`/models/buildings/${buildingType}.glb`)));
        for (let i = 0; i < buildings.length; i++) {
            const [building] = buildings[i];
            const buildingType = BuildingTypes[i];

            const material = building.material as MeshStandardMaterial;
            material.color.setHex((() => {
                switch (buildingType) {
                    case "factory": return 0xFFD9D6;
                    case "mine": return 0xD2F7FE;
                    default: return 0xFFFFFF;
                }
            })())

            building.castShadow = true;
            building.receiveShadow = true;

            const size = buildingConfig[buildingType].size;
            const boundingBox = new Box3();
            boundingBox.min.set(0, 0, 0);
            boundingBox.max.copy(size);
            this._buildings.set(buildingType, {
                prefab: building,
                boundingBox
            });
        }

        // const buildings = await Promise.all(BuildingTypes.map(buildingType => objects.load(`/models/buildings/${buildingType}.json`)));
        // for (let i = 0; i < buildings.length; i++) {
        //     const building = buildings[i];
        //     building.traverse(child => {
        //         child.castShadow = true;
        //         child.receiveShadow = true;
        //     });
        //     const buildingType = BuildingTypes[i];
        //     const size = buildingSizes[buildingType];
        //     const boundingBox = new Box3();
        //     boundingBox.min.set(0, 0, 0);
        //     boundingBox.max.copy(size);
        //     this._buildings.set(buildingType, {
        //         prefab: building,
        //         boundingBox
        //     });
        // }
    }

    public getBoundingBox(buildingType: BuildingType) {
        return this._buildings.get(buildingType)!.boundingBox;
    }

    public create(buildingType: BuildingType, sectorCoords: Vector2, localCoords: Vector2) {
        const instanceId = `${this._instanceId}`;
        this._instanceId++;

        const instance = this._buildings.get(buildingType)!;
        const visual = instance.prefab.clone();
        visual.scale.multiplyScalar(cellSize);
        visual.name = `${buildingType}-${instanceId}`;
        
        // const box3Helper = new Box3Helper(instance.boundingBox);
        // visual.add(box3Helper);
        // box3Helper.visible = false;

        const mapCoords = new Vector2(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y);
        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingType,
            visual,
            mapCoords,
            state: null,
            deleted: false
        };

        const { layers, buildings } = GameMapState.instance;
        buildings.set(instanceId, buildingInstance);

        if (buildingType === "depot") {
            const { depotsCache } = GameMapState.instance;
            const sectorId = `${sectorCoords.x},${sectorCoords.y}`;
            const list = depotsCache.get(sectorId);
            if (list) {
                list.push(buildingInstance);
            } else {
                depotsCache.set(sectorId, [buildingInstance]);
            }
        }

        const size = buildingConfig[buildingType].size;
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords)!;
                cell.building = instanceId;
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

    public createHologram(buildingType: BuildingType) {
        const instance = this._buildings.get(buildingType)!;
        const visual = instance.prefab.clone();
        visual.scale.multiplyScalar(cellSize);
        visual.name = `${buildingType}`;

        if (buildingType === "incubator") {
            meshes.load("/models/buildings/incubator-glass.glb").then(([_mesh]) => {
                const mesh = _mesh.clone();
                mesh.castShadow = true;
                const glass = mesh.material as Material;
                glass.transparent = true;
                glass.opacity = 0.6;
                mesh.renderOrder = 1;
                visual.add(mesh);
            });    
        }

        return visual;
    }

    public clear(instanceId: string) {
        const { buildings } = GameMapState.instance;
        const instance = buildings.get(instanceId)!;
        buildings.delete(instanceId);
        instance.deleted = true;
        instance.visual.removeFromParent();

        const buildingType = instance.buildingType;
        const size = buildingConfig[buildingType].size;
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                cellCoords.set(instance.mapCoords.x + j, instance.mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords)!;
                cell.building = undefined;
            }
        }

        switch (buildingType) {
            case "mine": {
                // restore resources under the mine
                const state = instance.state as IMineState;
                for (const cellCoord of state.resourceCells) {
                    const resourceCell = GameUtils.getCell(cellCoord)!;
                    const visual = resourceCell.resource!.visual!;
                    console.assert(visual.visible === false);
                    visual.visible = true;
                }                
            }
                break;

            case "depot": {
                // remove from the depot cache
                const { depotsCache } = GameMapState.instance;
                GameUtils.getCell(instance.mapCoords, sectorCoords)
                const sectorId = `${sectorCoords.x},${sectorCoords.y}`;
                const list = depotsCache.get(sectorId)!;
                const index = list.findIndex(item => item.id === instanceId);
                utils.fastDelete(list, index);
            }
            break;
        }

        cellCoords.set(instance.mapCoords.x + Math.round(size.x / 2), instance.mapCoords.y + Math.round(size.z / 2));
        cmdFogRemoveCircle.post({ mapCoords: cellCoords, radius: 20 });
        evtBuildingStateChanged.post(instance);
    }

    public update() {
        const { buildings } = GameMapState.instance;
        buildings.forEach(instance => {
            switch (instance.buildingType) {
                case "mine": Mines.update(instance); break;
                case "factory": Factories.update(instance); break;
                case "depot": Depots.update(instance); break;
                case "incubator": Incubators.update(instance); break;
            }
        });
    }
}

export const buildings = new Buildings();

