import { AdditiveBlending, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector2, Vector3 } from "three";
import { config } from "./config/config";
import { ICell, IRawResource, ISector } from "./GameTypes";
import { meshes } from "../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "./GameDefinitions";
import { trees } from "./Trees";
import { GameUtils } from "./GameUtils";
import { resourceConfig } from "./config/ResourceConfig";
import { GameMapState } from "./components/GameMapState";
import { utils } from "../engine/Utils";

const { cellSize, mapRes } = config.game;
const mapCoords = new Vector2();
const worldPos = new Vector3();

const instanceInfo: { instancedMesh: InstancedMesh, instanceIndex: number } = {
    instancedMesh: null!,
    instanceIndex: 0
};

function createLiquidPatch(mapCoords: Vector2, type: "oil" | "water") {
    const visited = new Map<string, boolean>();
    const cells = new Array<Vector2>();
    let iterations = 2000;

    let resourceAmount = 0;
    const id = `${mapCoords.x},${mapCoords.y}`;
    const queue = [id];
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) {
            continue;
        }
        visited.set(current, true);

        const [x, y] = current.split(",").map(Number);
        mapCoords.set(x, y);
        const cell = GameUtils.getCell(mapCoords);
        const resourceType = cell?.resource?.type;
        if (resourceType === type) {
            cells.push(mapCoords.clone());
            console.assert(!cell!.resource!.liquidPatchId);
            cell!.resource!.liquidPatchId = id;
            resourceAmount += cell!.resource!.amount;

            queue.push(`${x + 1},${y}`);
            queue.push(`${x - 1},${y}`);
            queue.push(`${x},${y + 1}`);
            queue.push(`${x},${y - 1}`);
        } 

        --iterations;
        if (iterations < 0) {
            console.warn("createLiquidPatch: too many iterations");
            break;
        }
    }

    return {
        id,
        cells,
        resourceAmount
    };
}

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
                    const [,surface] = config.terrain.liquidDepths[type];
                    visual.position.set(localX, -surface, localZ);
                    sector.layers.resources.add(visual);
                    const resourceInstance: IRawResource = { visual, type, amount: capacity };                    
                    return resourceInstance;
                }

                case "oil": {
                    const visual = new Mesh(this._oilGeometry, this._oilMaterial);
                    visual.name = type;
                    const localX = localCoords.x * cellSize + cellSize / 2;
                    const localZ = localCoords.y * cellSize + cellSize / 2;
                    const [,surface] = config.terrain.liquidDepths[type];
                    visual.position.set(localX, -surface, localZ);
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
    
    public getLiquidPatch(cell: ICell, cellCoords: Vector2) {
        const { liquidPatchId } = cell.resource!;
        if (liquidPatchId) {
            const patch = GameMapState.instance.liquidPatches.get(liquidPatchId);
            console.assert(patch, "MiningState: liquid patch not found");
            return patch!;
        }
        const patch = createLiquidPatch(cellCoords, cell.resource!.type as "oil" | "water");
        GameMapState.instance.liquidPatches.set(patch.id, patch);
        return patch;
    }
}

export const resources = new Resources();

