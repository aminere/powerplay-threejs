import { DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, RepeatWrapping, Texture, Vector2, Vector3 } from "three";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { Axis, ICell } from "./GameTypes";
import { time } from "../engine/core/Time";
import { ConveyorUtils } from "./ConveyorUtils";
import { conveyorItems } from "./ConveyorItems";
import { pools } from "../engine/core/Pools";
import { GameMapState } from "./components/GameMapState";

const matrix = new Matrix4();
const worldPos = new Vector3();
const rotation = new Quaternion();
const { cellSize, conveyorWidth, conveyorHeight, conveyorSpeed } = config.game;
const scale = new Vector3(1, 1, 1).multiplyScalar(cellSize);
const neighborCoords = new Vector2();

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
        const { layers } = GameMapState.instance;
        if (this._loaded) {
            layers.conveyors.add(this._conveyors);
            layers.conveyors.add(this._conveyorTops);
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
        baseMaterial.side = DoubleSide;
        const curvedBaseMaterial = curvedConveyor0.material as MeshBasicMaterial;
        curvedBaseMaterial.side = DoubleSide;

        conveyor.geometry.scale(conveyorWidth, 1, 1);
        const conveyorInstances = ConveyorUtils.createInstancedMesh("conveyors", conveyor.geometry, baseMaterial);
        layers.conveyors.add(conveyorInstances);
        this._conveyors = conveyorInstances;

        conveyorTop.geometry.scale(conveyorWidth, 1, 1);
        const topMaterial = conveyorTop.material as MeshBasicMaterial;
        const conveyorTopInstances = ConveyorUtils.createInstancedMesh("conveyors-tops", conveyorTop.geometry, topMaterial);
        layers.conveyors.add(conveyorTopInstances);
        this._conveyorTops = conveyorTopInstances;

        this._curvedConveyor = ConveyorUtils.makeCurvedConveyor(curvedConveyor0, 1);
        this._invCurvedConveyor = ConveyorUtils.makeCurvedConveyor(curvedConveyor0, -1);
        this._curvedConveyorTop = ConveyorUtils.makeCurvedConveyor(curvedConveyorTop0, 1);
        this._invCurvedConveyorTop = ConveyorUtils.makeCurvedConveyor(curvedConveyorTop0, -1);
        this._curvedConveyorTop.material = topMaterial;
        this._invCurvedConveyorTop.material = topMaterial;

        conveyorTopInstances.receiveShadow = true;
        this._curvedConveyorTop.receiveShadow = true;
        this._invCurvedConveyorTop.receiveShadow = true;

        const topTexture = topMaterial.map!;
        topTexture.wrapT = RepeatWrapping;
        this._topTexture = topTexture;
        this._loaded = true;
    }

    public create(cell: ICell, mapCoords: Vector2, direction: Vector2, startAxis: Axis, endAxis?: Axis) {
        console.assert(cell.isEmpty);
        console.assert(!cell.conveyor);

        cell.conveyor = {
            config: {
                direction: direction.clone(),
                startAxis: startAxis,
                endAxis
            },
            visual: {},
            items: [],
        };

        GameUtils.mapToWorld(mapCoords, worldPos);
        if (endAxis !== undefined) {

            const [invertedMesh, angle] = ConveyorUtils.getConveyorTransform(direction, startAxis);
            const baseMesh = invertedMesh ? this._invCurvedConveyor.clone() : this._curvedConveyor.clone();
            const topMesh = invertedMesh ? this._invCurvedConveyorTop.clone() : this._curvedConveyorTop.clone();
            baseMesh.position.copy(worldPos);
            baseMesh.quaternion.setFromAxisAngle(GameUtils.vec3.up, angle);
            baseMesh.scale.copy(scale);
            baseMesh.add(topMesh);
            topMesh.position.y = conveyorHeight;
            GameMapState.instance.layers.conveyors.add(baseMesh);
            cell.conveyor.config.endAxis = ConveyorUtils.getPerpendicularAxis(startAxis);
            cell.conveyor.visual.mesh = baseMesh;

        } else {

            const count = this._conveyors.count;
            this.setStraightTransform(worldPos, direction, count);
            this._conveyors.count = count + 1;
            this._conveyorTops.count = count + 1;
            this._straightCells.push(cell);
            cell.conveyor!.visual.instanceIndex = count;
        }        
    }

    private setStraightTransform(position: Vector3, direction: Vector2, instanceIndex: number) {
        const angle = ConveyorUtils.getAngle(direction);
        rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
        matrix.compose(position, rotation, scale);
        this._conveyors.setMatrixAt(instanceIndex, matrix);
        this._conveyors.instanceMatrix.needsUpdate = true;
        worldPos.copy(position);
        worldPos.y = conveyorHeight * cellSize;
        matrix.setPosition(worldPos);
        this._conveyorTops.setMatrixAt(instanceIndex, matrix);
        this._conveyorTops.instanceMatrix.needsUpdate = true;
    }

    public createAndFit(cell: ICell, mapCoords: Vector2) {

        const edgeNeighbors: Array<[ICell, Vector2, {
            neighborCount: number;
            isExit: boolean;
        }]> = [];

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighborCell = GameUtils.getCell(neighborCoords);
            const conveyor = neighborCell?.conveyor;
            if (!conveyor) {
                continue;
            }

            const neighborInfo = (() => {
                const isCorner = conveyor.config.endAxis !== undefined;
                if (!isCorner) {
                    const isExit = ConveyorUtils.isStraightExit(neighborCell, neighborCoords);
                    const isEntry = ConveyorUtils.isStraightEntry(neighborCell, neighborCoords);
                    const neighborCount = isExit ? (isEntry ? 0 : 1) : (isEntry ? 1 : 2);
                    return { neighborCount, isExit };
                } else {
                    // assuming no loose corners exist
                    return { neighborCount: 2, isExit: false };
                }
            })();

            const isEdge = neighborInfo.neighborCount < 2;
            if (isEdge) {
                edgeNeighbors.push([neighborCell, neighborCoords.clone(), neighborInfo]);
                if (edgeNeighbors.length === 2) {
                    break;
                }
            }
        }

        if (edgeNeighbors.length > 0) {

            for (let i = 0; i < edgeNeighbors.length; ++i) {
                const [neighborCell, neighborCoords, neighborInfo] = edgeNeighbors[i];
                const { direction: neighborDir, startAxis: neighborStartAxis, endAxis: neighborEndAxis } = neighborCell.conveyor!.config;
                const dx = mapCoords.x - neighborCoords.x;
                const dy = mapCoords.y - neighborCoords.y;
                const newAxis = dx === 0 ? "z" : "x";
                const neighborIsCorner = neighborEndAxis !== undefined;
                console.assert(!neighborIsCorner);

                if (i === 0) {

                    const direction = (() => {
                        if (neighborStartAxis === newAxis) {
                            return neighborDir.clone();
                        } else {
                            if (neighborInfo.isExit) {
                                return new Vector2(dx, dy);
                            } else {
                                return new Vector2(-dx, -dy);
                            }
                        }
                    })();

                    this.create(cell, mapCoords, direction, newAxis);

                    // align neighbor
                    const { neighborCount } = neighborInfo;
                    const { visual: neighborVisual } = neighborCell.conveyor!;
                    if (neighborStartAxis !== newAxis) {

                        if (neighborCount === 0) {
                            neighborDir.copy(direction);
                            neighborCell.conveyor!.config.startAxis = newAxis;
                            GameUtils.mapToWorld(neighborCoords, worldPos);
                            this.setStraightTransform(worldPos, neighborDir, neighborVisual.instanceIndex!);

                        } else {
                            // become a corner
                            console.assert(neighborCount === 1);
                            neighborDir.add(direction);
                            this.clearStraightConveyor(neighborCell);
                            const newNeighborAxis = neighborInfo.isExit ? ConveyorUtils.getPerpendicularAxis(newAxis) : newAxis;
                            this.create(neighborCell, neighborCoords, neighborDir, newNeighborAxis, ConveyorUtils.getPerpendicularAxis(newNeighborAxis));
                        }
                    }

                } else {

                    // TODO align with the second neighbor

                }
            }

        } else {
            this.create(cell, mapCoords, new Vector2(0, 1), "z");
        }

    }

    public clear(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords)!;
        const { endAxis } = cell.conveyor!.config;
        const isCorner = endAxis !== undefined;
        if (isCorner) {
            this.clearCurvedConveyor(cell);
        } else {
            this.clearStraightConveyor(cell);
        }
    }

    public clearLooseCorners(mapCoords: Vector2) {
        // Turn loose corners into straights
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighborCell = GameUtils.getCell(neighborCoords);
            if (!neighborCell?.conveyor) {
                continue;
            }
            const { startAxis, endAxis, direction } = neighborCell.conveyor.config;
            const isCorner = endAxis !== undefined;
            if (isCorner) {
                const isExit = ConveyorUtils.isCornerExit(neighborCell, neighborCoords);
                this.clearCurvedConveyor(neighborCell);
                const newAxis = isExit ? startAxis : ConveyorUtils.getPerpendicularAxis(startAxis);
                const sx = newAxis === "x" ? 1 : 0;
                const sy = 1 - sx;
                direction.set(direction.x * sx, direction.y * sy);
                this.create(neighborCell, neighborCoords, direction, newAxis);
            }
        }
    }

    public clearCurvedConveyor(cell: ICell) {
        const { visual } = cell.conveyor!;
        visual.mesh!.removeFromParent();
        cell.conveyor = undefined;
    }

    public clearStraightConveyor(cell: ICell) {
        const { visual } = cell.conveyor!;
        const instanceIndex = visual.instanceIndex!;
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
            const { visual: cellVisual } = cell.conveyor!;
            cellVisual.instanceIndex = cellVisual.instanceIndex! - 1;
        }
        this._conveyors.count = newCount;
        this._conveyors.instanceMatrix.needsUpdate = true;
        this._conveyorTops.count = newCount;
        this._conveyorTops.instanceMatrix.needsUpdate = true;
        cell.conveyor = undefined;
    }

    public update() {
        console.assert(this._loaded);
        this._topTexture.offset.y -= time.deltaTime * conveyorSpeed / cellSize;
        conveyorItems.update();
    }

    public dispose() {
        this._disposed = true;
        this._conveyors.count = 0;
        this._conveyorTops.count = 0;
        this._straightCells.length = 0;
    }  
    
    public onDrag(start: Vector2, end: Vector2, dragAxis: Axis, cellsOut: Vector2[]) {
        const [mapCoords, offset2, start2, dir, cornerDir] = pools.vec2.get(5);

        // const isPerpendicularEdge = (cell: ICell, coords: Vector2, axis: Axis) => {
        //     if (!cell?.conveyor) {
        //         return false;
        //     }
        //     const { startAxis, endAxis } = cell.conveyor.config;
        //     const isCorner = endAxis !== undefined;
        //     if (isCorner) {
        //         return false;
        //     }

        //     const isEntry = ConveyorUtils.isStraightEntry(cell, coords);
        //     const isExit =  ConveyorUtils.isStraightExit(cell, coords);
        //     const isEdge = isEntry || isExit;
        //     if (isEdge) {
        //         const isPerpendicular = startAxis !== axis;
        //         return isPerpendicular
        //     }            
            
        //     return false;
        // };

        const create = (coords: Vector2, direction: Vector2, axis: Axis, endAxis?: Axis) => {
            const cell = GameUtils.getCell(coords);
            if (!cell || !cell.isEmpty || cell.roadTile !== undefined) {
                return;
            }
            cellsOut.push(coords.clone());
            this.create(cell, coords, direction, axis, endAxis);

            // const fit = coords.equals(start) || coords.equals(end);
            // if (fit) {

            //     // try align with perpendicular neighbors if any
            //     const perpendicularNeighbor = (() => {
            //         if (axis === "x") {
            //             neighborCoords.set(coords.x, coords.y - 1);
            //             const neighbor1 = GameUtils.getCell(neighborCoords);
            //             const neighbor1Info = neighbor1 ? isPerpendicularEdge(neighbor1, neighborCoords, axis) : false;
            //             if (neighbor1Info) {
            //                 return neighborCoords.clone();
            //             }
            //             neighborCoords.set(coords.x, coords.y + 1);
            //             const neighbor2 = GameUtils.getCell(neighborCoords);
            //             const neighbor2Info = neighbor2 ? isPerpendicularEdge(neighbor2, neighborCoords, axis) : false;
            //             if (neighbor2Info) {
            //                 return neighborCoords.clone();
            //             }
            //         } else {
            //             neighborCoords.set(coords.x + 1, coords.y);
            //             const neighbor1 = GameUtils.getCell(neighborCoords);
            //             const neighbor1Info = neighbor1 ? isPerpendicularEdge(neighbor1, neighborCoords, axis) : false;
            //             if (neighbor1Info) {
            //                 return neighborCoords.clone();
            //             }
            //             neighborCoords.set(coords.x - 1, coords.y);
            //             const neighbor2 = GameUtils.getCell(neighborCoords);
            //             const neighbor2Info = neighbor2 ? isPerpendicularEdge(neighbor2, neighborCoords, axis) : false;
            //             if (neighbor2Info) {
            //                 return neighborCoords.clone();
            //             }
            //         }
            //         return null;
            //     })();

            //     if (perpendicularNeighbor) {
            //         const _neighborCoords = perpendicularNeighbor;
            //         cornerDir.copy(direction).add(_neighborCoords).sub(coords);                    
            //         this.create(cell, coords, cornerDir, axis, ConveyorUtils.getPerpendicularAxis(axis));

            //     } else {
            //         this.create(cell, coords, direction, axis, endAxis);
            //     }                

            // } else {
            //     this.create(cell, coords, direction, axis, endAxis);
            // }            
        };
        
        const scan = (origin: Vector2, direction: Vector2, iterations: number, axis: Axis) => {
            for (let i = 0; i <= iterations; ++i) {
                mapCoords.copy(origin).addScaledVector(direction, i);
                create(mapCoords, direction, axis);
            }
        };
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if (dragAxis === "x") {
            dir.set(Math.sign(dx), 0);
            const xIterations = Math.abs(dx);
            scan(start, dir, xIterations - 1, dragAxis);
            if (end.y !== start.y) {

                start2.copy(start).addScaledVector(dir, xIterations);
                const dirY = Math.sign(dy);
                offset2.set(0, dirY);

                if (end.x !== start.x) {
                    const dirX = Math.sign(dx);
                    cornerDir.set(dirX, dirY);
                    create(start2, cornerDir, dragAxis, ConveyorUtils.getPerpendicularAxis(dragAxis));

                } else {
                    create(start, offset2, "z");
                }

                start2.y += dirY;
                const yIterations = Math.abs(dy);
                scan(start2, offset2, yIterations - 1, "z");

            } else {
                if (dx !== 0) {
                    create(end, dir, dragAxis);
                }
            }

        } else {
            dir.set(0, Math.sign(dy));
            const yIterations = Math.abs(dy);
            scan(start, dir, yIterations - 1, dragAxis);
            if (end.x !== start.x) {

                start2.copy(start).addScaledVector(dir, yIterations);
                const dirX = Math.sign(dx);
                offset2.set(dirX, 0);

                if (end.y !== start.y) {
                    const dirY = Math.sign(dy);
                    cornerDir.set(dirX, dirY);
                    create(start2, cornerDir, dragAxis, ConveyorUtils.getPerpendicularAxis(dragAxis));

                } else {
                    create(start, offset2, "x");
                }

                start2.x += dirX;
                const xIterations = Math.abs(dx);
                scan(start2, offset2, xIterations - 1, "x");
            } else {
                if (dy !== 0) {
                    create(end, dir, dragAxis);
                }
            }
        }
    }
}

export const conveyors = new Conveyors();

