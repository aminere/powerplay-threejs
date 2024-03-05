import { BufferGeometry, InstancedMesh, Material, Matrix4, Mesh, Quaternion, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { pools } from "../engine/core/Pools";
import { ICell } from "./GameTypes";

const conveyorHeight = .3;
const maxConveyors = 500;
const matrix = new Matrix4();
const worldPos = new Vector3();
const rotation = new Quaternion();
const { cellSize } = config.game;
const scale = new Vector3(1, 1, 1).multiplyScalar(cellSize);
const up = new Vector3(0, 1, 0);

function createInstancedMesh(name: string, geometry: BufferGeometry, material: Material | Material[]) {
    const mesh = new InstancedMesh(geometry, material, maxConveyors);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.count = 0;
    return mesh;
}

class Conveyors {
    private _conveyors!: InstancedMesh;
    private _conveyorTops!: InstancedMesh;

    public async preload() {
        const [conveyor, conveyorTop] = await Promise.all([
            objects.load(`/models/conveyor.json`), 
            objects.load(`/models/conveyor-top.json`)
        ]) as [Mesh, Mesh];

        const conveyorInstances = createInstancedMesh("conveyors", conveyor.geometry, conveyor.material);       
        gameMapState.layers.conveyors.add(conveyorInstances);
        this._conveyors = conveyorInstances;

        const conveyorTopInstances = createInstancedMesh("conveyors-tops", conveyorTop.geometry, conveyorTop.material);       
        gameMapState.layers.conveyors.add(conveyorTopInstances);
        this._conveyorTops = conveyorTopInstances;
    }

    public create(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        console.assert(cell.isEmpty);
        
        const neighborInfo = (() => {
            let neighborCell: ICell | null = null;
            const [neighborCoord, neighborConveyorCoord] = pools.vec2.get(2);
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                neighborCoord.set(mapCoords.x + dx, mapCoords.y + dy);
                const _cell = GameUtils.getCell(neighborCoord);
                if (_cell?.conveyor) {
                    if (_cell.conveyor.attached) {
                        return [_cell, neighborCoord] as const;
                    } else {
                        neighborCell = _cell;
                        neighborConveyorCoord.copy(neighborCoord);
                    }
                }
            }
            if (neighborCell) {
                return [neighborCell, neighborConveyorCoord] as const;
            } else {
                return null;
            }
        })();

        const angle = (() => {
            if (neighborInfo) {
                const [, neighborCoord] = neighborInfo;
                const dx = neighborCoord.x - mapCoords.x;
                const dy = neighborCoord.y - mapCoords.y;
                if (dx === 0) {
                    if (dy < 0) {
                        return Math.PI;
                    }
                } else {
                    if (dx < 0) {
                        return -Math.PI / 2;
                    }
                    return Math.PI / 2;
                }
            }
            return 0;
        })();

        GameUtils.mapToWorld(mapCoords, worldPos);
        worldPos.x -= cellSize / 2;
        worldPos.z -= cellSize / 2;
        rotation.identity();
        matrix.compose(worldPos, rotation, scale);
        const count = this._conveyors.count;
        this._conveyors.setMatrixAt(count, matrix);
        this._conveyors.count = count + 1;
        this._conveyors.instanceMatrix.needsUpdate = true;
        worldPos.x += cellSize / 2;
        worldPos.z += cellSize / 2;
        worldPos.y = conveyorHeight * cellSize;
        rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
        matrix.compose(worldPos, rotation, scale);
        this._conveyorTops.setMatrixAt(count, matrix);
        this._conveyorTops.count = count + 1;
        this._conveyorTops.instanceMatrix.needsUpdate = true;

        cell.conveyor = {
            angle,
            attached: neighborInfo !== null,
            instanceIndex: count
        };

        if (neighborInfo) {
            const [neighborCell, neighborCoord] = neighborInfo;
            console.assert(neighborCell.conveyor);
            const neighborConveyor = neighborCell.conveyor!;            
            neighborConveyor.angle = angle;
            neighborConveyor.attached = true;
            GameUtils.mapToWorld(neighborCoord, worldPos);
            worldPos.y = conveyorHeight * cellSize;
            rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
            matrix.compose(worldPos, rotation, scale);
            this._conveyorTops.setMatrixAt(neighborConveyor.instanceIndex, matrix);
            this._conveyorTops.instanceMatrix.needsUpdate = true;
        }
    }

    public clear(mapCoords: Vector2) {
    }
}

export const conveyors = new Conveyors();

