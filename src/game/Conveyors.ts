import { BufferGeometry, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, Quaternion, RepeatWrapping, Texture, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { pools } from "../engine/core/Pools";
import { Axis, ICell, IConveyorConfig } from "./GameTypes";
import { time } from "../engine/core/Time";
import { BezierPath } from "./BezierPath";

const conveyorHeight = .3;
const scaleX = .6;
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

function makeCurvedConveyor(mesh: Mesh, xDir: number) {
    const curvedMesh = mesh.clone();
    curvedMesh.geometry = (curvedMesh.geometry as THREE.BufferGeometry).clone();
    curvedMesh.geometry.computeBoundingBox();
    const minZ = curvedMesh.geometry.boundingBox!.min.z;
    const maxZ = curvedMesh.geometry.boundingBox!.max.z;
    const halfCell = 1 / 2;
    const x1 = 0;
    const x2 = halfCell / 2 * xDir;
    const x3 = halfCell * xDir;
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

    const vertices = curvedMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const [point, bitangent, curvedPos, offset] = pools.vec3.get(4);
    offset.set(0, 0, -halfCell);
    for (let i = 0; i < vertices.count; ++i) {
        const t = (vertices.getZ(i) - minZ) / (maxZ - minZ);
        curve.evaluate(t, point);
        curve.evaluateBitangent(t, bitangent);
        curvedPos.copy(point)
            .add(offset)
            .addScaledVector(bitangent, -vertices.getX(i) * scaleX)
            .addScaledVector(GameUtils.vec3.up, vertices.getY(i));
        vertices.setXYZ(i, curvedPos.x, curvedPos.y, curvedPos.z);
    }

    curvedMesh.geometry.computeVertexNormals();
    vertices.needsUpdate = true;
    return curvedMesh;
}

function isCornerConveyor(cell: ICell) {
    const config = cell.conveyor!.config;
    if (config) {       
        return Math.abs(config.direction.x) + Math.abs(config.direction.y) > 1;
    }
    return false;
}

class Conveyors {
    private _conveyors!: InstancedMesh;
    private _conveyorTops!: InstancedMesh;
    private _curvedConveyor!: Mesh;
    private _invCurvedConveyor!: Mesh;
    private _curvedConveyorTop!: Mesh;
    private _invCurvedConveyorTop!: Mesh;
    private _straightCells: ICell[] = [];
    private _topTexture!: Texture;
    private _loaded = false;
    private _disposed = false;

    public async preload() {
        if (this._loaded) {
            gameMapState.layers.conveyors.add(this._conveyors);
            gameMapState.layers.conveyors.add(this._conveyorTops);
            return;
        }

        this._disposed = false;
        const [conveyor, conveyorTop, curvedConveyor0, curvedConveyorTop0] = await Promise.all([
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

        this._curvedConveyor = makeCurvedConveyor(curvedConveyor0, 1);
        this._invCurvedConveyor = makeCurvedConveyor(curvedConveyor0, -1);
        this._curvedConveyorTop = makeCurvedConveyor(curvedConveyorTop0, 1);
        this._invCurvedConveyorTop = makeCurvedConveyor(curvedConveyorTop0, -1);
        this._curvedConveyorTop.material = conveyorTop.material;
        this._invCurvedConveyorTop.material = conveyorTop.material;

        const topTexture = (conveyorTop.material as MeshBasicMaterial).map!;
        topTexture.wrapT = RepeatWrapping;        
        this._topTexture = topTexture;
        this._loaded = true;
    }

    public create(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        console.assert(cell.isEmpty);

        let neighborConveyorCell: ICell | null = null;
        const [neighborCoord, neighborConveyorCoord] = pools.vec2.get(2);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoord.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighborCell = GameUtils.getCell(neighborCoord);
            if (neighborCell?.conveyor) {
                neighborConveyorCell = neighborCell;
                neighborConveyorCoord.copy(neighborCoord);
                if (neighborCell.conveyor.config) {
                    break;
                }
            }
        }

        if (neighborConveyorCell) {
            console.assert(neighborConveyorCell.conveyor);
            const { config } = neighborConveyorCell.conveyor!;
            if (config) {

                const dx = mapCoords.x - neighborConveyorCoord.x;
                const dy = mapCoords.y - neighborConveyorCoord.y;
                const perpendicular = Math.abs(config.direction.x) !== Math.abs(dx);
                if (perpendicular) {
                    const newDirection = pools.vec2.getOne();
                    newDirection.set(dx, dy);
                    
                    this.createStraightConveyor(cell, mapCoords, {
                        direction: newDirection.clone(),
                        startAxis: config.startAxis === "x" ? "z" : "x"
                    });
    
                    // make neighbor into a corner
                    console.log(`making neighbor into a corner at ${neighborConveyorCoord.x}, ${neighborConveyorCoord.y} (id ${neighborConveyorCell.id})`);
                    this.deleteStraightConveyor(neighborConveyorCell!);    
                    
                    const neighborConfig = neighborConveyorCell!.conveyor!.config!;
                    console.log(`direction before: ${neighborConfig.direction.x}, ${neighborConfig.direction.y} (startAxis: ${neighborConfig.startAxis})`);
                    neighborConfig.direction.add(newDirection);
                    console.log(`direction after: ${neighborConfig.direction.x}, ${neighborConfig.direction.y} (startAxis: ${neighborConfig.startAxis})`);
                    GameUtils.mapToWorld(neighborConveyorCoord, worldPos);
                    
                    const [invertedMesh, angle] = (() => {
                        if (neighborConfig.direction.x > 0) {
                            if (neighborConfig.direction.y < 0) {
                                if (neighborConfig.startAxis === "x") {
                                    return [false, Math.PI / 2];
                                } else {
                                    return [true, Math.PI];
                                }
                            } else {
                                if (neighborConfig.startAxis === "x") {
                                    return [true, Math.PI / 2];
                                } else {
                                    return [false, 0];
                                }
                            }
                        } else {
                            if (neighborConfig.direction.y < 0) {
                                if (neighborConfig.startAxis === "x") {
                                    return [true, -Math.PI / 2];
                                } else {
                                    return [false, Math.PI];
                                }                            
                            } else {
                                if (neighborConfig.startAxis === "x") {
                                    return [false, -Math.PI / 2];
                                } else {
                                    return [true, 0];
                                }
                            }
                        }                    
                    })();
                   
                    const baseMesh = invertedMesh ? this._invCurvedConveyor.clone() : this._curvedConveyor.clone();
                    const topMesh = invertedMesh ? this._invCurvedConveyorTop.clone() : this._curvedConveyorTop.clone();
                    baseMesh.position.copy(worldPos);
                    if (angle !== 0) {
                        baseMesh.quaternion.setFromAxisAngle(GameUtils.vec3.up, angle);
                    }
                    baseMesh.scale.copy(scale);
                    baseMesh.add(topMesh);
                    topMesh.position.y = conveyorHeight;
                    gameMapState.layers.conveyors.add(baseMesh);
                    
                    console.assert(isCornerConveyor(neighborConveyorCell!));
                    console.assert(!neighborConveyorCell!.isEmpty);
                    neighborConveyorCell!.conveyor!.instanceIndex = -1;
                    neighborConveyorCell!.conveyor!.mesh = baseMesh;
                    console.log(neighborConveyorCell?.conveyor);
    
                } else {
                    this.createStraightConveyor(cell, mapCoords, { 
                        direction: config.direction.clone(),
                        startAxis: config.startAxis
                    });
                }

            } else {

                const neighborConveyor = neighborConveyorCell.conveyor!;
                const dx = mapCoords.x - neighborConveyorCoord.x;
                const dy = mapCoords.y - neighborConveyorCoord.y;
                console.assert(!neighborConveyor.config);
                neighborConveyor.config = {
                    direction: new Vector2(dx, dy),
                    startAxis: dx === 0 ? "z" : "x"
                };
                this.createStraightConveyor(cell, mapCoords, { 
                    direction: neighborConveyor.config.direction.clone(),
                    startAxis: neighborConveyor.config.startAxis
                });
                console.assert(!isCornerConveyor(neighborConveyorCell));
                console.assert(!isCornerConveyor(cell));

                // update neighbor
                console.log(`updating neighbor config at ${neighborConveyorCoord.x}, ${neighborConveyorCoord.y} (id ${neighborConveyorCell.id})`);
                GameUtils.mapToWorld(neighborConveyorCoord, worldPos);
                const angle = getAngleFromDirection(neighborConveyor.config.direction);
                rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
                matrix.compose(worldPos, rotation, scale);
                this._conveyors.setMatrixAt(neighborConveyor.instanceIndex, matrix);
                this._conveyors.instanceMatrix.needsUpdate = true;
                worldPos.y = conveyorHeight * cellSize;
                matrix.setPosition(worldPos);
                this._conveyorTops.setMatrixAt(neighborConveyor.instanceIndex, matrix);
                this._conveyorTops.instanceMatrix.needsUpdate = true;
            }
        } else {
            this.createStraightConveyor(cell, mapCoords);
        }        
    }

    public clear(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        const isCorner = isCornerConveyor(cell);
        console.log(`clearing conveyor at ${mapCoords.x}, ${mapCoords.y} (id ${cell.id}), isCorner: ${isCorner}`);
        console.log(cell.conveyor);
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
        this._straightCells.length = 0;
    }

    private createStraightConveyor(cell: ICell, mapCoords: Vector2, config?: IConveyorConfig) {
        GameUtils.mapToWorld(mapCoords, worldPos);

        rotation.identity();
        if (config) {
            const angle = getAngleFromDirection(config.direction);
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
            config: config ? { 
                direction: config.direction.clone(),
                startAxis: config.startAxis
             } : undefined,
            instanceIndex: count
        };
        console.assert(!isCornerConveyor(cell));
        cell.isEmpty = false;
        cell.flowFieldCost = 0xffff;
        this._straightCells.push(cell);

        console.log(`created conveyor at ${mapCoords.x}, ${mapCoords.y} (id: ${cell.id}), isCorner: ${isCornerConveyor(cell)}`);
        console.log(cell.conveyor!.config);
    }    

    private deleteStraightConveyor(cell: ICell) {
        console.log(`deleting straight conveyor at ${cell.id}`);
        const instanceIndex = cell.conveyor!.instanceIndex;
        const count = this._conveyors.count;
        const newCount = count - 1;
        for (let i = instanceIndex; i < newCount; i++) {
            this._conveyors.getMatrixAt(i + 1, matrix);
            this._conveyors.setMatrixAt(i, matrix);
            this._conveyorTops.getMatrixAt(i + 1, matrix);
            this._conveyorTops.setMatrixAt(i, matrix);
        }

        this._straightCells.splice(instanceIndex, 1);
        for (let i = instanceIndex; i < newCount; i++) {
            const cell = this._straightCells[i];
            cell.conveyor!.instanceIndex--;
        }
        this._conveyors.count = newCount;
        this._conveyors.instanceMatrix.needsUpdate = true;
        this._conveyorTops.count = newCount;
        this._conveyorTops.instanceMatrix.needsUpdate = true;
    }

    private deleteCurvedConveyor(cell: ICell) {
        cell.conveyor!.mesh!.removeFromParent();
    }
}

export const conveyors = new Conveyors();

