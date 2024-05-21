import { Box3, BufferAttribute, BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D, Vector2 } from "three";
import { config } from "../config/config";
import { GameUtils } from "../GameUtils";
import { cmdFogAddCircle, cmdFogRemoveCircle, evtBuildingCreated } from "../../Events";
import { GameMapState } from "../components/GameMapState";
import { meshes } from "../../engine/resources/Meshes";
import { BuildingType, BuildingTypes, IBuildingInstance, IMineState } from "./BuildingTypes";
import { Mines } from "./Mines";
import { Factories } from "./Factories";
import { depots } from "./Depots";
import { Incubators } from "./Incubators";
import { utils } from "../../engine/Utils";
import { buildingConfig } from "../config/BuildingConfig";
import { Assemblies } from "./Assemblies";
import { elevation } from "../Elevation";

const { cellSize, mapRes, elevationStep } = config.game;
const verticesPerRow = mapRes + 1;
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

    public create(buildingType: BuildingType, _sectorCoords: Vector2, _localCoords: Vector2) {
        const instanceId = `${this._instanceId}`;
        this._instanceId++;

        const instance = this._buildings.get(buildingType)!;
        const visual = instance.prefab.clone();
        visual.scale.multiplyScalar(cellSize);
        visual.name = `${buildingType}-${instanceId}`;
        
        // const box3Helper = new Box3Helper(instance.boundingBox);
        // visual.add(box3Helper);
        // box3Helper.visible = true;

        const { size, hitpoints } = buildingConfig[buildingType];
        const mapCoords = new Vector2(_sectorCoords.x * mapRes + _localCoords.x, _sectorCoords.y * mapRes + _localCoords.y);
        const buildingInstance: IBuildingInstance = {
            id: instanceId,
            buildingType,
            visual,
            mapCoords,
            state: null,
            deleted: false,
            hitpoints
        };

        const { layers, buildings } = GameMapState.instance;
        buildings.set(instanceId, buildingInstance);

        if (buildingType === "depot") {
            const { depotsCache } = GameMapState.instance;
            const sectorId = `${_sectorCoords.x},${_sectorCoords.y}`;
            const list = depotsCache.get(sectorId);
            if (list) {
                list.push(buildingInstance);
            } else {
                depotsCache.set(sectorId, [buildingInstance]);
            }
        }
        
        let maxY = 0;
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords)!;
                cell.building = instanceId;

                const x = Math.floor(localCoords.x / 2);
                const y = Math.floor(localCoords.y / 2);
                const cellIndex2x2 = y * (mapRes / 2) + x;
                const sector = GameUtils.getSector(sectorCoords)!;
                const cell2x2 = sector.cells2x2[cellIndex2x2];
                cell2x2.building = instanceId;                

                const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
                const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
                const position = geometry.getAttribute("position") as BufferAttribute;  
                const y0 = position.getY(startVertexIndex);
                const y1 = position.getY(startVertexIndex + 1);
                const y2 = position.getY(startVertexIndex + verticesPerRow + 1);
                const y3 = position.getY(startVertexIndex + verticesPerRow);                
                maxY = Math.max(maxY, y0, y1, y2, y3);
            }
        }

        elevation.elevate(mapCoords, size.x, size.z, maxY, false);
        visual.position.set(
            _sectorCoords.x * mapSize + _localCoords.x * cellSize + sectorOffset,
            maxY * elevationStep,
            _sectorCoords.y * mapSize + _localCoords.y * cellSize + sectorOffset
        );

        layers.buildings.add(visual);
        cellCoords.set(mapCoords.x + Math.round(size.x / 2), mapCoords.y + Math.round(size.z / 2));
        cmdFogAddCircle.post({ mapCoords: cellCoords, radius: 20 });
        evtBuildingCreated.post(buildingInstance);
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
                const cell = GameUtils.getCell(cellCoords, undefined, localCoords)!;
                cell.building = undefined;

                const x = Math.floor(localCoords.x / 2);
                const y = Math.floor(localCoords.y / 2);
                const cellIndex2x2 = y * (mapRes / 2) + x;
                const sector = GameUtils.getSector(sectorCoords)!;
                const cell2x2 = sector.cells2x2[cellIndex2x2];
                cell2x2.building = undefined;
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
                if (list.length === 0) {
                    depotsCache.delete(sectorId);
                }
            }
            break;
        }

        cellCoords.set(instance.mapCoords.x + Math.round(size.x / 2), instance.mapCoords.y + Math.round(size.z / 2));
        cmdFogRemoveCircle.post({ mapCoords: cellCoords, radius: 20 });
    }

    public update() {
        const { buildings } = GameMapState.instance;
        buildings.forEach(instance => {
            switch (instance.buildingType) {
                case "mine": Mines.update(instance); break;
                case "factory": Factories.update(instance); break;
                case "depot": depots.update(instance); break;
                case "incubator": Incubators.update(instance); break;
                case "assembly": Assemblies.update(instance); break;
            }
        });
    }
}

export const buildings = new Buildings();

