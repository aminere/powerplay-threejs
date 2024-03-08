import { DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, RepeatWrapping, Texture, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { pools } from "../engine/core/Pools";
import { Axis, ICell, IConveyorConfig } from "./GameTypes";
import { time } from "../engine/core/Time";
import { ConveyorUtils } from "./ConveyorUtils";
import { utils } from "../engine/Utils";
import { meshes } from "../engine/resources/Meshes";

const matrix = new Matrix4();
const worldPos = new Vector3();
const rotation = new Quaternion();
const { cellSize, conveyorWidth, conveyorHeight } = config.game;
const scale = new Vector3(1, 1, 1).multiplyScalar(cellSize);
const neighborCoords = new Vector2();

class Conveyors {
    private _conveyors!: InstancedMesh;
    private _conveyorTops!: InstancedMesh;
    private _curvedConveyor!: Mesh;
    private _invCurvedConveyor!: Mesh;
    private _curvedConveyorTop!: Mesh;
    private _invCurvedConveyorTop!: Mesh;
    private _items!: Object3D;
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
        
        const baseMaterial = conveyor.material as MeshBasicMaterial;
        baseMaterial.transparent = true;
        baseMaterial.opacity = .9;
        baseMaterial.side = DoubleSide;
        const curvedBaseMaterial = curvedConveyor0.material as MeshBasicMaterial;
        curvedBaseMaterial.transparent = true;
        curvedBaseMaterial.opacity = .9;
        curvedBaseMaterial.side = DoubleSide;

        conveyor.geometry.scale(conveyorWidth, 1, 1);
        const conveyorInstances = ConveyorUtils.createInstancedMesh("conveyors", conveyor.geometry, conveyor.material);
        gameMapState.layers.conveyors.add(conveyorInstances);
        this._conveyors = conveyorInstances;

        conveyorTop.geometry.scale(conveyorWidth, 1, 1);
        const conveyorTopInstances = ConveyorUtils.createInstancedMesh("conveyors-tops", conveyorTop.geometry, conveyorTop.material);
        gameMapState.layers.conveyors.add(conveyorTopInstances);
        this._conveyorTops = conveyorTopInstances;

        this._curvedConveyor = ConveyorUtils.makeCurvedConveyor(curvedConveyor0, 1);
        this._invCurvedConveyor = ConveyorUtils.makeCurvedConveyor(curvedConveyor0, -1);
        this._curvedConveyorTop = ConveyorUtils.makeCurvedConveyor(curvedConveyorTop0, 1);
        this._invCurvedConveyorTop = ConveyorUtils.makeCurvedConveyor(curvedConveyorTop0, -1);
        this._curvedConveyorTop.material = conveyorTop.material;
        this._invCurvedConveyorTop.material = conveyorTop.material;

        const topTexture = (conveyorTop.material as MeshBasicMaterial).map!;
        topTexture.wrapT = RepeatWrapping;        
        this._topTexture = topTexture;
        this._items = utils.createObject(gameMapState.layers.conveyors, "items");
        this._loaded = true;
    }

    public create(mapCoords: Vector2, isDragging = false) {
        const cell = GameUtils.getCell(mapCoords)!;
        console.assert(cell.isEmpty);

        let neighborConveyorCell: ICell | null = null;
        const neighborConveyorCoords = pools.vec2.getOne();
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighborCell = GameUtils.getCell(neighborCoords);
            if (neighborCell?.conveyor) {
                if (isDragging) {
                    if (!neighborCell.previewConveyor) {
                        continue;
                    }
                }

                neighborConveyorCell = neighborCell;
                neighborConveyorCoords.copy(neighborCoords);
                if (neighborCell.conveyor.config) {
                    break;
                }
            }
        }

        if (neighborConveyorCell) {
            const dx = mapCoords.x - neighborConveyorCoords.x;
            const dy = mapCoords.y - neighborConveyorCoords.y;
            const neighborConfig = neighborConveyorCell.conveyor!.config;
            if (neighborConfig) {
                if (ConveyorUtils.isCorner(neighborConveyorCell)) {
                    const neighborIsExit = ConveyorUtils.isCornerExit(neighborConveyorCell, neighborConveyorCoords);
                    const neighborIsEntry = ConveyorUtils.isCornerEntry(neighborConveyorCell, neighborConveyorCoords);
                    const isEdge = neighborIsExit || neighborIsEntry;
                    if (isEdge) {
                        const atCornerEntry = ConveyorUtils.getCornerEntryCoords(neighborConveyorCell, neighborConveyorCoords).equals(mapCoords);
                        const atCornerExit = ConveyorUtils.getCornerExitCoords(neighborConveyorCell, neighborConveyorCoords).equals(mapCoords);
                        if (atCornerEntry || atCornerExit) {
                            if (atCornerEntry) {
                                console.assert(!atCornerExit);
                                this.createStraightConveyor(cell, mapCoords, {
                                    startAxis: neighborConfig.startAxis,
                                    direction: new Vector2(-dx, -dy)
                                });

                            } else {
                                console.assert(atCornerExit);
                                this.createStraightConveyor(cell, mapCoords, {
                                    startAxis: ConveyorUtils.getPerpendicularAxis(neighborConfig.startAxis),
                                    direction: new Vector2(dx, dy)
                                });
                            }

                        } else {

                            // TODO change the corner
                            this.createStraightConveyor(cell, mapCoords);
                        }
                    } else {
                        
                        // can't hook to this neighbor because it's connected by two ends
                        this.createStraightConveyor(cell, mapCoords);
                    }
                   
                } else {

                    const perpendicular = Math.abs(neighborConfig.direction.x) !== Math.abs(dx);
                    if (perpendicular) {

                        const neighborIsExit = ConveyorUtils.isStraightExit(neighborConveyorCell, neighborConveyorCoords);
                        const neighborIsEntry = ConveyorUtils.isStraightEntry(neighborConveyorCell, neighborConveyorCoords);
                        const isEdge = neighborIsExit || neighborIsEntry;
                        if (isEdge) {

                            const startAxis = ConveyorUtils.getPerpendicularAxis(neighborConfig.startAxis);
                            const newDirection = (() => {
                                if (neighborConfig.startAxis === "z") {
                                    if (neighborIsExit) {
                                        return new Vector2(dx, 0);
                                    } else {
                                        return new Vector2(-dx, 0);
                                    }
                                } else {
                                    if (neighborIsExit) {
                                        return new Vector2(0, dy);
                                    } else {
                                        return new Vector2(0, -dy);
                                    }
                                }
                            })();

                            this.createStraightConveyor(cell, mapCoords, { direction: newDirection, startAxis });

                            const canAffectNeighbor = !isDragging || neighborConveyorCell.previewConveyor;
                            if (canAffectNeighbor) {
                                this.curveStraightConveyor(neighborConveyorCell, neighborConveyorCoords, newDirection, neighborIsEntry);                            
                            }

                        } else {

                            // can't hook to this neighbor because it's connected by two ends
                            this.createStraightConveyor(cell, mapCoords);
                        }                       

                    } else {

                        this.createStraightConveyor(cell, mapCoords, { 
                            direction: neighborConfig.direction.clone(),
                            startAxis: neighborConfig.startAxis
                        });                        
                    }
                }               

            } else {

                // neighbor has not been configured yet
                const neighborConveyor = neighborConveyorCell.conveyor!;
                const config: IConveyorConfig = { direction: new Vector2(dx, dy), startAxis: dx === 0 ? "z" : "x" };
                this.createStraightConveyor(cell, mapCoords, config);

                const canAffectNeighbor = !isDragging || neighborConveyorCell.previewConveyor;
                if (canAffectNeighbor) {
                    // update neighbor
                    console.assert(!neighborConveyor.config);
                    neighborConveyor.config = { direction: config.direction.clone(), startAxis: config.startAxis };
                    GameUtils.mapToWorld(neighborConveyorCoords, worldPos);
                    const angle = ConveyorUtils.getAngleFromDirection(neighborConveyor.config.direction);
                    rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
                    matrix.compose(worldPos, rotation, scale);
                    this._conveyors.setMatrixAt(neighborConveyor.instanceIndex, matrix);
                    this._conveyors.instanceMatrix.needsUpdate = true;
                    worldPos.y = conveyorHeight * cellSize;
                    matrix.setPosition(worldPos);
                    this._conveyorTops.setMatrixAt(neighborConveyor.instanceIndex, matrix);
                    this._conveyorTops.instanceMatrix.needsUpdate = true;
                }                
            }
        } else {
            this.createStraightConveyor(cell, mapCoords);
        }        
    }

    public clear(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        if (ConveyorUtils.isCorner(cell)) {
            this.deleteCurvedConveyor(cell);
        } else {            
            this.deleteStraightConveyor(cell);
        }
        delete cell.conveyor;
        delete cell.previewConveyor;
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
                cell.previewConveyor = true;
                const cellCoords = currentPos.clone();
                cellsOut.push(cellCoords);
                this.create(cellCoords, true);
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

    public onEndDrag(cells: Vector2[]) {
        for (const coord of cells) {
            const cell = GameUtils.getCell(coord)!;
            console.assert(cell.previewConveyor);
            delete cell.previewConveyor;
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

    public addItem(cell: ICell, mapCoords: Vector2) {        
        meshes.load("/models/resources/iron-ore.glb").then(([mesh]) => {
            // TODO
        });        
    }

    private createStraightConveyor(cell: ICell, mapCoords: Vector2, config?: IConveyorConfig) {
        GameUtils.mapToWorld(mapCoords, worldPos);

        rotation.identity();
        if (config) {
            const angle = ConveyorUtils.getAngleFromDirection(config.direction);
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
            instanceIndex: count,
            items: []
        };
        cell.isEmpty = false;
        cell.flowFieldCost = 0xffff;
        this._straightCells.push(cell);
    }    

    private curveStraightConveyor(cell: ICell, mapCoords: Vector2, newDirection: Vector2, flipAxis: boolean) {
        this.deleteStraightConveyor(cell);    
        cell.conveyor!.config!.direction.add(newDirection);
        if (flipAxis) {
            cell.conveyor!.config!.startAxis = ConveyorUtils.getPerpendicularAxis(cell.conveyor!.config!.startAxis);
        }
                       
        GameUtils.mapToWorld(mapCoords, worldPos);
        const [invertedMesh, angle] = ConveyorUtils.getConveyorTransform(cell.conveyor!.config!);
        const baseMesh = invertedMesh ? this._invCurvedConveyor.clone() : this._curvedConveyor.clone();
        const topMesh = invertedMesh ? this._invCurvedConveyorTop.clone() : this._curvedConveyorTop.clone();
        baseMesh.position.copy(worldPos);
        baseMesh.quaternion.setFromAxisAngle(GameUtils.vec3.up, angle);
        baseMesh.scale.copy(scale);
        baseMesh.add(topMesh);
        topMesh.position.y = conveyorHeight;
        gameMapState.layers.conveyors.add(baseMesh);    
        cell.conveyor!.instanceIndex = -1;
        cell.conveyor!.mesh = baseMesh;
    }

    private deleteStraightConveyor(cell: ICell) {
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

