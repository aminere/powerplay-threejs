import { AdditiveBlending, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector2, Vector3 } from "three";
import { config } from "./config/config";
import { ICell, IRawResource, ISector } from "./GameTypes";
import { utils } from "../powerplay";
import { meshes } from "../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "./GameDefinitions";
import { trees } from "./Trees";
import { GameUtils } from "./GameUtils";
import { resourceConfig } from "./config/ResourceConfig";

const { cellSize, mapRes } = config.game;
const mapCoords = new Vector2();
const worldPos = new Vector3();

const instanceInfo: { instancedMesh: InstancedMesh, instanceIndex: number } = {
    instancedMesh: null!,
    instanceIndex: 0
};

class Resources {

    public get glassMaterial() { return this._glassMaterial; }

    private _oilMaterial = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .7 });
    private _oilGeometry = new PlaneGeometry(cellSize, cellSize).rotateX(-Math.PI / 2);    
    private _glassMaterial = new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, opacity: .4 });
    private _waterMaterial = new MeshStandardMaterial({ color: 0x5BB0F1, transparent: true, opacity: .6 });

    public create(sector: ISector, sectorCoords: Vector2, localCoords: Vector2, cell: ICell, type: RawResourceType) {

        const resourceInstance = (() => {
            mapCoords.set(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y);
            GameUtils.mapToWorld(mapCoords, worldPos);
            worldPos.y = GameUtils.getMapHeight(mapCoords, localCoords, sector, worldPos.x, worldPos.z);
            const { capacity } = resourceConfig.rawResources[type];

            switch (type) {
                case "wood": {                    
                    trees.createRandomTree(cell, worldPos, instanceInfo);                    
                    const resourceInstance: IRawResource = {
                        visual: instanceInfo.instancedMesh,
                        instanceIndex: instanceInfo.instanceIndex,
                        type,
                        amount: capacity,
                    };
                    return resourceInstance;
                }

                case "water":{
                    const visual = new Mesh(this._oilGeometry, this._waterMaterial);
                    visual.name = type;
                    const localX = localCoords.x * cellSize + cellSize / 2;
                    const localZ = localCoords.y * cellSize + cellSize / 2;
                    visual.position.set(localX, -.2, localZ);
                    sector.layers.resources.add(visual);
                    const resourceInstance: IRawResource = { visual, type, amount: capacity };                    
                    return resourceInstance;
                }

                case "oil": {
                    const visual = new Mesh(this._oilGeometry, this._oilMaterial);
                    visual.name = type;
                    const localX = localCoords.x * cellSize + cellSize / 2;
                    const localZ = localCoords.y * cellSize + cellSize / 2;
                    visual.position.set(localX, -.1, localZ);
                    sector.layers.resources.add(visual);
                    const resourceInstance: IRawResource = { visual, type, amount: capacity };                    
                    return resourceInstance;
                }

                default: {
                    const visual = utils.createObject(sector.layers.resources, type);
                    meshes.load(`/models/resources/${type}.glb`)
                        .then((_meshes) => {
                            for (const _mesh of _meshes) {
                                const mesh = _mesh.clone();
                                mesh.scale.setScalar(cellSize);
                                mesh.castShadow = true;
                                visual.add(mesh);
                            }
                        });

                    const localX = localCoords.x * cellSize + cellSize / 2;
                    const localZ = localCoords.y * cellSize + cellSize / 2;
                    visual.position.set(localX, worldPos.y, localZ);
                    const resourceInstance: IRawResource = { visual, type, amount: capacity };
                    return resourceInstance;
                }
            }
        })();

        cell.resource = resourceInstance;
    }

    public loadModel(type: RawResourceType | ResourceType) {
        return meshes.load(`/models/resources/${type}.glb`).then(([_mesh]) => {
            if (!_mesh.geometry.boundingBox) {
                _mesh.geometry.computeBoundingBox();
            }
            const mesh = _mesh.clone();
            mesh.scale.setScalar(cellSize);
            switch (type) {
                case "ak47": {
                    mesh.scale.multiplyScalar(1.2);
                }
                break;

                case "glass": {
                    mesh.material = this._glassMaterial;
                }
                break;
            }
            return mesh;
        });
    }
}

export const resources = new Resources();

