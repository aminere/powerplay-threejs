import { BufferGeometry, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, Quaternion, RepeatWrapping, Shader, Texture, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { pools } from "../engine/core/Pools";
import { Axis, ICell } from "./GameTypes";
import { time } from "../engine/core/Time";
import { BezierPath } from "./BezierPath";

const conveyorHeight = .3;
const scaleX = .7;
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

function makeCurvedConveyor(mesh: Mesh) {
    mesh.geometry = (mesh.geometry as THREE.BufferGeometry).clone();
    mesh.geometry.computeBoundingBox();
    const minZ = mesh.geometry.boundingBox!.min.z;
    const maxZ = mesh.geometry.boundingBox!.max.z;
    const halfCell = cellSize / 2;
    const x1 = 0;
    const x2 = halfCell / 2;
    const x3 = halfCell;
    const z1 = 0;
    const z2 = halfCell / 2;
    const z3 = halfCell;
    const curve = new BezierPath();
    curve.setPoints([
        new Vector3(x1, 0, z1),
        new Vector3(x1, 0, z2),
        new Vector3(x2, 0, z3),
        new Vector3(x3, 0, z3)
    ]);

    const vertices = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const [point, bitangent, curvedPos, offset] = pools.vec3.get(4);
    offset.set(0, 0, -halfCell);
    for (let i = 0; i < vertices.count; ++i) {
        const t = (vertices.getZ(i) - minZ) / (maxZ - minZ);
        curve.evaluate(t, point);
        curve.evaluateBitangent(t, bitangent);
        curvedPos.copy(point)
            .add(offset)
            .addScaledVector(bitangent, -vertices.getX(i) * cellSize * scaleX)
            .addScaledVector(GameUtils.vec3.up, vertices.getY(i) * cellSize);
        vertices.setXYZ(i, curvedPos.x, curvedPos.y, curvedPos.z);
    }

    mesh.geometry.computeVertexNormals();
    vertices.needsUpdate = true;
}

function isCornerConveyor(cell: ICell) {
    const direction = cell.conveyor!.direction;
    if (direction) {       
        return Math.abs(direction.x) + Math.abs(direction.y) > 1;
    }
    return false;
}

function deleteConveyor(cell: ICell, baseMesh: InstancedMesh, topMesh: InstancedMesh, cells: ICell[]) {
    const instanceIndex = cell.conveyor!.instanceIndex;
    const count = baseMesh.count;
    const newCount = count - 1;
    for (let i = instanceIndex; i < newCount; i++) {
        baseMesh.getMatrixAt(i + 1, matrix);
        baseMesh.setMatrixAt(i, matrix);
        topMesh.getMatrixAt(i + 1, matrix);
        topMesh.setMatrixAt(i, matrix);
    }

    cells.splice(instanceIndex, 1);
    for (let i = instanceIndex; i < newCount; i++) {
        const cell = cells[i];
        cell.conveyor!.instanceIndex--;
    }
    baseMesh.count = newCount;
    baseMesh.instanceMatrix.needsUpdate = true;
    topMesh.count = newCount;
    topMesh.instanceMatrix.needsUpdate = true;
}

class Conveyors {
    private _conveyors!: InstancedMesh;
    private _conveyorTops!: InstancedMesh;
    private _curvedConveyors!: InstancedMesh;
    private _curvedConveyorTops!: InstancedMesh;
    private _straightCells: ICell[] = [];
    private _curvedCells: ICell[] = [];
    private _topTexture!: Texture;
    private _loaded = false;
    private _disposed = false;

    public async preload() {
        if (this._loaded) {
            gameMapState.layers.conveyors.add(this._conveyors);
            gameMapState.layers.conveyors.add(this._conveyorTops);
            gameMapState.layers.conveyors.add(this._curvedConveyors);
            gameMapState.layers.conveyors.add(this._curvedConveyorTops);
            return;
        }

        this._disposed = false;
        const [conveyor, conveyorTop, curvedConveyor, curvedConveyorTop] = await Promise.all([
            objects.load(`/models/conveyor.json`),            
            objects.load(`/models/conveyor-top.json`),
            objects.load(`/models/conveyor-curved.json`),
            objects.load("/models/conveyor-curved-top.json")
        ]) as [Mesh, Mesh, Mesh, Mesh];

        if (this._disposed) {
            return;
        }

        conveyor.geometry.scale(scaleX, 1, 1);
        const conveyorInstances = createInstancedMesh("conveyors", conveyor.geometry, conveyor.material);
        gameMapState.layers.conveyors.add(conveyorInstances);
        this._conveyors = conveyorInstances;

        conveyorTop.geometry.scale(scaleX, 1, 1);
        const conveyorTopInstances = createInstancedMesh("conveyors-tops", conveyorTop.geometry, conveyorTop.material);
        gameMapState.layers.conveyors.add(conveyorTopInstances);
        this._conveyorTops = conveyorTopInstances;        

        makeCurvedConveyor(curvedConveyor);
        const conveyorCurvedInstances = createInstancedMesh("conveyors-curved", curvedConveyor.geometry, conveyor.material);
        gameMapState.layers.conveyors.add(conveyorCurvedInstances);
        this._curvedConveyors = conveyorCurvedInstances;

        makeCurvedConveyor(curvedConveyorTop);
        const conveyorCurvedTopInstances = createInstancedMesh("conveyors-curved-tops", curvedConveyorTop.geometry, conveyorTop.material);
        gameMapState.layers.conveyors.add(conveyorCurvedTopInstances);
        this._curvedConveyorTops = conveyorCurvedTopInstances;

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
                const angle = getAngleFromDirection(neighborConveyor.direction);
                rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
                matrix.compose(worldPos, rotation, scale);
                this._conveyors.setMatrixAt(neighborConveyor.instanceIndex, matrix);
                this._conveyors.instanceMatrix.needsUpdate = true;
                worldPos.y = conveyorHeight * cellSize;
                matrix.setPosition(worldPos);
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

                // make neighbor into a corner
                this.deleteStraightConveyor(neighborConveyorCell!);

                GameUtils.mapToWorld(neighborConveyorCoord, worldPos);
                rotation.identity();
                // if (direction) {
                //     const angle = getAngleFromDirection(direction);
                //     rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
                // }
                matrix.compose(worldPos, rotation, GameUtils.vec3.one);
                const count = this._curvedConveyors.count;
                this._curvedConveyors.setMatrixAt(count, matrix);
                this._curvedConveyors.count = count + 1;
                this._curvedConveyors.instanceMatrix.needsUpdate = true;
                worldPos.y = conveyorHeight * cellSize;
                matrix.setPosition(worldPos);
                this._curvedConveyorTops.setMatrixAt(count, matrix);
                this._curvedConveyorTops.count = count + 1;
                this._curvedConveyorTops.instanceMatrix.needsUpdate = true;
                neighborConveyorCell!.conveyor!.direction!.add(newDirection);
                console.assert(isCornerConveyor(neighborConveyorCell!));
                neighborConveyorCell!.conveyor!.instanceIndex = count;
                this._curvedCells.push(neighborConveyorCell!);                

            } else {
                this.createConveyor(cell, mapCoords, direction);
            }
        }
    }

    public clear(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        const isCorner = isCornerConveyor(cell);
        if (isCorner) {
            this.deleteCurvedConveyor(cell);
        } else {
            this.deleteStraightConveyor(cell);
        }        
        delete cell.conveyor;
        cell.isEmpty = true;
        cell.flowFieldCost = 1;
    }

    public onDrag(start: Vector2, current: Vector2, cellsOut: Vector2[], dragAxis: Axis) {
        const currentPos = pools.vec2.getOne();
        const scan = (_start: Vector2, direction: Vector2, iterations: number) => {
            console.assert(iterations >= 0);
            for (let i = 0; i <= iterations; ++i) {
                currentPos.copy(_start).addScaledVector(direction, i);
                const cell = GameUtils.getCell(currentPos);
                if (!cell || !cell.isEmpty || cell.roadTile !== undefined) {
                    continue;
                }
                const cellCoords = currentPos.clone();
                cellsOut.push(cellCoords);
                this.create(cellCoords);
            }
        };

        if (dragAxis === "x") {
            const direction = new Vector2(Math.sign(current.x - start.x), 0);
            const iterations = Math.abs(current.x - start.x);
            scan(start, direction, iterations);
            if (current.y !== start.y) {
                const offset2 = new Vector2(0, Math.sign(current.y - start.y));
                const start2 = new Vector2().copy(start).addScaledVector(direction, iterations).add(offset2);
                scan(start2, offset2, Math.abs(current.y - start.y) - 1);
            }
        } else {
            const direction = new Vector2(0, Math.sign(current.y - start.y));
            const iterations = Math.abs(current.y - start.y);
            scan(start, direction, iterations);
            if (current.x !== start.x) {
                const offset2 = new Vector2(Math.sign(current.x - start.x), 0);
                const start2 = new Vector2().copy(start).addScaledVector(direction, iterations).add(offset2);
                scan(start2, offset2, Math.abs(current.x - start.x) - 1);
            }
        }
    }

    public update() {
        if (!this._loaded) {
            return;
        }

        this._topTexture.offset.y -= time.deltaTime;
    }

    public dispose() {
        this._disposed = true;
        this._conveyors.count = 0;
        this._conveyorTops.count = 0;
        this._curvedConveyors.count = 0;
        this._curvedConveyorTops.count = 0;
        this._straightCells.length = 0;
        this._curvedCells.length = 0;
    }

    private createConveyor(cell: ICell, mapCoords: Vector2, direction?: Vector2) {
        GameUtils.mapToWorld(mapCoords, worldPos);

        rotation.identity();
        if (direction) {
            const angle = getAngleFromDirection(direction);
            rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
        }
        matrix.compose(worldPos, rotation, scale);
        const count = this._conveyors.count;
        this._conveyors.setMatrixAt(count, matrix);
        this._conveyors.count = count + 1;
        this._conveyors.instanceMatrix.needsUpdate = true;
        worldPos.y = conveyorHeight * cellSize;
        matrix.setPosition(worldPos);
        this._conveyorTops.setMatrixAt(count, matrix);
        this._conveyorTops.count = count + 1;
        this._conveyorTops.instanceMatrix.needsUpdate = true;
        cell.conveyor = {
            direction: direction?.clone(),
            instanceIndex: count
        };
        cell.isEmpty = false;
        cell.flowFieldCost = 0xffff;
        this._straightCells.push(cell);
    }    

    private deleteStraightConveyor(cell: ICell) {
        deleteConveyor(cell, this._conveyors, this._conveyorTops, this._straightCells);
    }
    private deleteCurvedConveyor(cell: ICell) {
        deleteConveyor(cell, this._curvedConveyors, this._curvedConveyorTops, this._curvedCells);
    }
}

export const conveyors = new Conveyors();

