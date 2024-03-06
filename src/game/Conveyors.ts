import { BufferGeometry, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, Quaternion, RepeatWrapping, Shader, Texture, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { pools } from "../engine/core/Pools";
import { ICell } from "./GameTypes";
import { time } from "../engine/core/Time";

const conveyorHeight = .3;
const maxConveyors = 500;
const matrix = new Matrix4();
const worldPos = new Vector3();
const rotation = new Quaternion();
const { cellSize } = config.game;
const scale = new Vector3(1, 1, 1).multiplyScalar(cellSize);

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

function getAngleFromDirection(direction: Vector2) {    
    if (direction.x === 0) {
        if (direction.y > 0) {
            return 0;
        }
        return Math.PI;
    } else {
        if (direction.x > 0) {
            return Math.PI / 2;
        }
        return -Math.PI / 2;
    }
}

class Conveyors {
    private _conveyors!: InstancedMesh;
    private _conveyorTops!: InstancedMesh;
    private _cells: ICell[] = [];
    private _topTexture!: Texture;
    private _loaded = false;

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

        const topTexture = (conveyorTop.material as MeshBasicMaterial).map!;
        topTexture.wrapT = RepeatWrapping;
        this._topTexture = topTexture;
        this._loaded = true;
    }

    public create(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        console.assert(cell.isEmpty);        

        let direction: Vector2 | null = null;
        let neighborConveyorCell: ICell | null = null;
        const [neighborCoord, neighborConveyorCoord] = pools.vec2.get(2);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoord.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighborCell = GameUtils.getCell(neighborCoord);
            if (neighborCell?.conveyor) {
                neighborConveyorCell = neighborCell;
                neighborConveyorCoord.copy(neighborCoord);
                if (neighborCell.conveyor.direction) {
                    direction = neighborCell.conveyor.direction;
                    break;
                }
            }
        }

        if (!direction) {
            if (neighborConveyorCell) {
                const neighborConveyor = neighborConveyorCell.conveyor!;
                const dx = mapCoords.x - neighborConveyorCoord.x;
                const dy = mapCoords.y - neighborConveyorCoord.y;
                console.assert(!neighborConveyor.direction);
                neighborConveyor.direction = new Vector2(dx, dy);
                this.createConveyor(cell, mapCoords, neighborConveyor.direction);

                // update neighbor
                GameUtils.mapToWorld(neighborConveyorCoord, worldPos);
                worldPos.y = conveyorHeight * cellSize;
                const angle = getAngleFromDirection(neighborConveyor.direction);
                rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
                matrix.compose(worldPos, rotation, scale);
                this._conveyorTops.setMatrixAt(neighborConveyor.instanceIndex, matrix);
                this._conveyorTops.instanceMatrix.needsUpdate = true;
            } else {
                this.createConveyor(cell, mapCoords);
            }
        } else {            
            const dx = mapCoords.x - neighborConveyorCoord.x;
            const dy = mapCoords.y - neighborConveyorCoord.y;
            const perpendicular = Math.abs(direction.x) !== dx;
            if (perpendicular) {
                const newDirection = pools.vec2.getOne();
                newDirection.set(dx, dy);
                this.createConveyor(cell, mapCoords, newDirection);
            } else {
                this.createConveyor(cell, mapCoords, direction);
            }
        }
    }

    public clear(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        const instanceIndex = cell.conveyor!.instanceIndex;
        const count = this._conveyors.count;
        const newCount = count - 1;
        for (let i = instanceIndex; i < newCount; i++) {
            this._conveyors.getMatrixAt(i + 1, matrix);
            this._conveyors.setMatrixAt(i, matrix);
            this._conveyorTops.getMatrixAt(i + 1, matrix);
            this._conveyorTops.setMatrixAt(i, matrix);            
        }

        this._cells.splice(instanceIndex, 1);
        for (let i = instanceIndex; i < newCount; i++) {
            const cell = this._cells[i];
            cell.conveyor!.instanceIndex--;
        }

        this._conveyors.count = newCount;
        this._conveyorTops.count = newCount;
        this._conveyors.instanceMatrix.needsUpdate = true;
        this._conveyorTops.instanceMatrix.needsUpdate = true;
        delete cell.conveyor;
        cell.isEmpty = true;
        cell.flowFieldCost = 1;
    }

    public update() {
        if (!this._loaded) {
            return;
        }

        this._topTexture.offset.y -= time.deltaTime;
    }

    private createConveyor(cell: ICell, mapCoords: Vector2, direction?: Vector2) {
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
        if (direction) {
            const angle = getAngleFromDirection(direction);
            rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
        }
        matrix.compose(worldPos, rotation, scale);
        this._conveyorTops.setMatrixAt(count, matrix);
        this._conveyorTops.count = count + 1;
        this._conveyorTops.instanceMatrix.needsUpdate = true;
        cell.conveyor = {
            direction: direction?.clone(),
            instanceIndex: count
        };
        cell.isEmpty = false;
        cell.flowFieldCost = 0xffff;
        this._cells.push(cell);
    }

}

export const conveyors = new Conveyors();

