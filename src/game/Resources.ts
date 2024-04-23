import { InstancedMesh, Vector2, Vector3 } from "three";
import { config } from "./config";
import { ICell, IRawResource, ISector } from "./GameTypes";
import { utils } from "../powerplay";
import { meshes } from "../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "./GameDefinitions";
import { trees } from "./Trees";
import { GameUtils } from "./GameUtils";

const { cellSize, mapRes } = config.game;
const mapCoords = new Vector2();
const worldPos = new Vector3();

const instanceInfo: { instancedMesh: InstancedMesh, instanceIndex: number } = {
    instancedMesh: null!,
    instanceIndex: 0
};

class Resources {
    public create(sector: ISector, sectorCoords: Vector2, localCoords: Vector2, cell: ICell, type: RawResourceType) {

        const resourceInstance = (() => {
            switch (type) {
                case "wood": {
                    mapCoords.set(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y);
                    GameUtils.mapToWorld(mapCoords, worldPos);
                    trees.createRandomTree(cell, worldPos, instanceInfo);
                    const resourceInstance: IRawResource = {
                        visual: instanceInfo.instancedMesh,
                        instanceIndex: instanceInfo.instanceIndex,
                        type,
                        amount: 100,
                    };
                    return resourceInstance;
                }
    
                default: {
                    const positionX = localCoords.x * cellSize + cellSize / 2;
                    const positionZ = localCoords.y * cellSize + cellSize / 2;            
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
                    visual.position.set(positionX, 0, positionZ);
                    const resourceInstance: IRawResource = {
                        visual,
                        type,
                        amount: 100,
                    };
                    return resourceInstance;
                }
            }
        })();

        cell.resource = resourceInstance;
    }

    public clear(cell: ICell) {
        const { visual, instanceIndex } = cell.resource!;
        if (instanceIndex !== undefined) {
            console.assert(cell.resource?.type === "wood");
            trees.removeTree(visual as InstancedMesh, instanceIndex);
        } else {
            cell.resource!.visual.removeFromParent();
        }
        cell.resource = undefined;
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
            }
            return mesh;
        });
    }
}

export const resources = new Resources();

