import { InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RepeatWrapping, Texture, Vector2, Vector3 } from "three";
import { GameUtils } from "./GameUtils";
import { config } from "./config/config";
import { Axis, ICell } from "./GameTypes";
import { time } from "../engine/core/Time";
import { conveyorUtils } from "./ConveyorUtils";
import { conveyorItems } from "./ConveyorItems";
import { GameMapState } from "./components/GameMapState";
import { textures } from "../engine/resources/Textures";
import { meshes } from "../engine/resources/Meshes";
import { IBuildingInstance } from "../powerplay";
import { buildingConfig } from "./config/BuildingConfig";

const matrix = new Matrix4();
const worldPos = new Vector3();
const rotation = new Quaternion();
const { cellSize } = config.game;
const { width, height, speed } = config.conveyors;
const mapCoords = new Vector2();
const offset2 = new Vector2();
const start2 = new Vector2();
const dir = new Vector2();
const cornerDir = new Vector2();

const scale = new Vector3(1, 1, 1).multiplyScalar(cellSize);
const neighborCoords = new Vector2();

interface INeighborInfo {
    neighborCount: number;
    isExit: boolean;
}

function getConveyorDirection(
    axis: Axis, 
    neighborStartAxis: Axis, 
    neighborDir: Vector2, 
    neighborInfo:INeighborInfo,
    dx: number,
    dy: number
) {
    if (neighborStartAxis === axis) {
        return neighborDir.clone();
    } else {
        if (neighborInfo.isExit) {
            return new Vector2(dx, dy);
        } else {
            return new Vector2(-dx, -dy);
        }
    }
}

class Conveyors {
    private _conveyors!: InstancedMesh;
    private _conveyorTops!: InstancedMesh;
    private _curvedConveyor!: Mesh;
    private _invCurvedConveyor!: Mesh;
    private _curvedConveyorTop!: Mesh;
    private _invCurvedConveyorTop!: Mesh;
    private _straightConveyor!: Mesh;
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
        const [_conveyor, _conveyorTop, _curvedConveyor0, _curvedConveyorTop0] = await Promise.all([
            meshes.load(`/models/conveyor.glb`),
            meshes.load(`/models/conveyor-top.glb`),
            meshes.load(`/models/conveyor-curved.glb`),
            meshes.load("/models/conveyor-curved-top.glb")
        ]) as [Mesh[], Mesh[], Mesh[], Mesh[]];

        if (this._disposed) {
            return;
        }

        const conveyor = _conveyor[0];
        const conveyorTop = _conveyorTop[0];
        const curvedConveyor0 = _curvedConveyor0[0];
        const curvedConveyorTop0 = _curvedConveyorTop0[0];
        const baseMaterial = conveyor.material as MeshBasicMaterial;

        conveyor.geometry.scale(width, 1, 1);
        const conveyorInstances = conveyorUtils.createInstancedMesh("conveyors", conveyor.geometry, baseMaterial);
        conveyorInstances.castShadow = true;
        layers.conveyors.add(conveyorInstances);
        this._conveyors = conveyorInstances;

        conveyorTop.geometry.scale(width, 1, 1);
        const topMaterial = conveyorTop.material as MeshStandardMaterial;
        topMaterial.metalness = 0;

        const conveyorTopInstances = conveyorUtils.createInstancedMesh("conveyors-tops", conveyorTop.geometry, topMaterial);
        layers.conveyors.add(conveyorTopInstances);
        this._conveyorTops = conveyorTopInstances;

        this._curvedConveyor = conveyorUtils.makeCurvedConveyor(curvedConveyor0, 1);
        this._invCurvedConveyor = conveyorUtils.makeCurvedConveyor(curvedConveyor0, -1);
        this._curvedConveyorTop = conveyorUtils.makeCurvedConveyor(curvedConveyorTop0, 1);
        this._invCurvedConveyorTop = conveyorUtils.makeCurvedConveyor(curvedConveyorTop0, -1);
        this._curvedConveyorTop.material = topMaterial;
        this._invCurvedConveyorTop.material = topMaterial;

        this._straightConveyor = conveyor.clone();
        this._straightConveyor.castShadow = true;
        const straightConveyorTop = conveyorTop.clone();
        straightConveyorTop.position.setY(height);
        this._straightConveyor.add(straightConveyorTop);

        conveyorTopInstances.receiveShadow = true;
        this._curvedConveyorTop.receiveShadow = true;
        this._invCurvedConveyorTop.receiveShadow = true;

        const topTexture = textures.load("/images/conveyor2.png");
        topMaterial.map = topTexture;
        topTexture.wrapT = RepeatWrapping;
        this._topTexture = topTexture;
        topMaterial.color.setHex(0xD1D1D1);
        this._loaded = true;
    }

    public dispose() {
        this._disposed = true;

        if (this._loaded) {
            this._conveyors.count = 0;
            this._conveyorTops.count = 0;
            this._straightCells.length = 0;
        }
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

            const [invertedMesh, angle] = conveyorUtils.getConveyorTransform(direction, startAxis);
            const baseMesh = invertedMesh ? this._invCurvedConveyor.clone() : this._curvedConveyor.clone();
            const topMesh = invertedMesh ? this._invCurvedConveyorTop.clone() : this._curvedConveyorTop.clone();
            baseMesh.position.copy(worldPos);
            baseMesh.quaternion.setFromAxisAngle(GameUtils.vec3.up, angle);
            baseMesh.scale.copy(scale);
            baseMesh.add(topMesh);
            topMesh.position.y = height;
            GameMapState.instance.layers.conveyors.add(baseMesh);
            cell.conveyor.config.endAxis = conveyorUtils.getPerpendicularAxis(startAxis);
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
        const angle = conveyorUtils.getAngle(direction);
        rotation.setFromAxisAngle(GameUtils.vec3.up, angle);
        matrix.compose(position, rotation, scale);
        this._conveyors.setMatrixAt(instanceIndex, matrix);
        this._conveyors.instanceMatrix.needsUpdate = true;
        worldPos.copy(position);
        worldPos.y = height * cellSize;
        matrix.setPosition(worldPos);
        this._conveyorTops.setMatrixAt(instanceIndex, matrix);
        this._conveyorTops.instanceMatrix.needsUpdate = true;
    }

    public createAndFit(cell: ICell, mapCoords: Vector2) {

        const edgeNeighbors: Array<[ICell, Vector2, {
            neighborCount: number;
            isExit: boolean;
        }]> = [];

        let buildingNeighbor: IBuildingInstance | null = null;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighborCell = GameUtils.getCell(neighborCoords);

            const building = neighborCell?.building;
            if (building) {
                buildingNeighbor = building;
                break;
            }

            const conveyor = neighborCell?.conveyor;
            if (conveyor) {
                const neighborInfo = (() => {
                    const isCorner = conveyor.config.endAxis !== undefined;
                    if (!isCorner) {
                        const isExit = conveyorUtils.isStraightExit(neighborCell, neighborCoords);
                        const isEntry = conveyorUtils.isStraightEntry(neighborCell, neighborCoords);
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
                }
            }
        }

        if (buildingNeighbor) {
            // align with building
            const { mapCoords: buildingCoords, buildingType } = buildingNeighbor;
            if (mapCoords.x < buildingCoords.x) {
                this.create(cell, mapCoords, new Vector2(-1, 0), "x"); // left
                return;
            } else if (mapCoords.y < buildingCoords.y) {
                this.create(cell, mapCoords, new Vector2(0, -1), "z") // top
                return;
            } else {
                const size = buildingConfig[buildingType].size;
                if (mapCoords.x === buildingCoords.x + size.x) {
                    this.create(cell, mapCoords, new Vector2(1, 0), "x"); // right
                    return;
                } else {
                    this.create(cell, mapCoords, new Vector2(0, 1), "z"); // bottom
                    return;
                }
            }

        }
        
        if (edgeNeighbors.length > 0) {
            if (edgeNeighbors.length === 1) {
                const [neighborCell, neighborCoords, neighborInfo] = edgeNeighbors[0];
                const { direction: neighborDir, startAxis: neighborStartAxis, endAxis: neighborEndAxis } = neighborCell.conveyor!.config;
                const dx = mapCoords.x - neighborCoords.x;
                const dy = mapCoords.y - neighborCoords.y;
                const newAxis = dx === 0 ? "z" : "x";
                const neighborIsCorner = neighborEndAxis !== undefined;
                console.assert(!neighborIsCorner);

                const direction = getConveyorDirection(
                    newAxis,
                    neighborStartAxis,
                    neighborDir,
                    neighborInfo,
                    dx,
                    dy
                );
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

                        const serializedItems = conveyorUtils.serializeItems(neighborCell.conveyor!);
                        this.clearStraightConveyor(neighborCell);
                        const newNeighborAxis = neighborInfo.isExit ? conveyorUtils.getPerpendicularAxis(newAxis) : newAxis;
                        this.create(neighborCell, neighborCoords, neighborDir, newNeighborAxis, conveyorUtils.getPerpendicularAxis(newNeighborAxis));
                        conveyorItems.addSerializedItems(neighborCell, neighborCoords, serializedItems);
                    }
                }
                return;

            } else {
                for (let i = 0; i < edgeNeighbors.length; ++i) {
                    const [neighborCell, neighborCoords, neighborInfo] = edgeNeighbors[i];
                    const { direction: neighborDir, startAxis: neighborStartAxis } = neighborCell.conveyor!.config;
                    const dx = mapCoords.x - neighborCoords.x;
                    const dy = mapCoords.y - neighborCoords.y;
                    const newAxis = dx === 0 ? "z" : "x";
                    if (newAxis !== neighborStartAxis) {
                        continue;
                    }
                    const direction = getConveyorDirection(
                        newAxis,
                        neighborStartAxis,
                        neighborDir,
                        neighborInfo,
                        dx,
                        dy
                    );
                    this.create(cell, mapCoords, direction, newAxis);
                    return;
                }
            }
        }

        // fallback
        this.create(cell, mapCoords, new Vector2(0, 1), "z");
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

    public clearPreview() {
        GameMapState.instance.layers.conveyorsPreview.clear();
    }

    public createPreview(mapCoords: Vector2, direction: Vector2, startAxis: Axis, endAxis?: Axis) {
        const mesh = (() => {
            GameUtils.mapToWorld(mapCoords, worldPos);
            if (endAxis !== undefined) {
                const [invertedMesh, angle] = conveyorUtils.getConveyorTransform(direction, startAxis);
                const baseMesh = invertedMesh ? this._invCurvedConveyor.clone() : this._curvedConveyor.clone();
                const topMesh = invertedMesh ? this._invCurvedConveyorTop.clone() : this._curvedConveyorTop.clone();
                baseMesh.position.copy(worldPos);
                baseMesh.quaternion.setFromAxisAngle(GameUtils.vec3.up, angle);
                baseMesh.scale.copy(scale);
                baseMesh.add(topMesh);
                topMesh.position.y = height;                
                return baseMesh;    
            } else {
                const _mesh = this._straightConveyor.clone();
                _mesh.position.copy(worldPos);
                const angle = conveyorUtils.getAngle(direction);
                _mesh.quaternion.setFromAxisAngle(GameUtils.vec3.up, angle);
                _mesh.scale.copy(scale);
                return _mesh;
            }
        })();
        const { conveyorsPreview } = GameMapState.instance.layers;
        conveyorsPreview.add(mesh);
        const configId = `${direction.x},${direction.y},${startAxis},${endAxis ?? "none"}`;
        mesh.name = configId;
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
                const isExit = conveyorUtils.isCornerExit(neighborCell, neighborCoords);
                const isEntry = conveyorUtils.isCornerEntry(neighborCell, neighborCoords);
                if (isEntry || isExit) {
                    const serializedItems = conveyorUtils.serializeItems(neighborCell.conveyor);
                    this.clearCurvedConveyor(neighborCell);
                    const newAxis = isExit ? startAxis : conveyorUtils.getPerpendicularAxis(startAxis);
                    const sx = newAxis === "x" ? 1 : 0;
                    const sy = 1 - sx;
                    direction.set(direction.x * sx, direction.y * sy);
                    this.create(neighborCell, neighborCoords, direction, newAxis);
                    conveyorItems.addSerializedItems(neighborCell, neighborCoords, serializedItems);
                } else {
                    // this is a corner that is connected on both ends, leave it alone
                }
            }
        }
    }

    public clearCurvedConveyor(cell: ICell) {
        const { visual } = cell.conveyor!;
        visual.mesh!.removeFromParent();
        // remove items
        for (const item of cell.conveyor!.items) {
            conveyorItems.removeItem(item);
        }
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

        // remove items
        for (const item of cell.conveyor!.items) {
            conveyorItems.removeItem(item);
        }

        cell.conveyor = undefined;
    }

    public update() {
        const dy = time.deltaTime * speed / cellSize;
        this._topTexture.offset.y -= dy;
        conveyorItems.update();
    }

    public onDrag(start: Vector2, end: Vector2, dragAxis: Axis, cellsOut: Vector2[]) {       

        // const isPerpendicularEdge = (cell: ICell, coords: Vector2, axis: Axis) => {
        //     if (!cell?.conveyor) {
        //         return false;
        //     }
        //     const { startAxis, endAxis } = cell.conveyor.config;
        //     const isCorner = endAxis !== undefined;
        //     if (isCorner) {
        //         return false;
        //     }

        //     const isEntry = conveyorUtils.isStraightEntry(cell, coords);
        //     const isExit =  conveyorUtils.isStraightExit(cell, coords);
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
            this.createPreview(coords, direction, axis, endAxis);

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
            //         this.create(cell, coords, cornerDir, axis, conveyorUtils.getPerpendicularAxis(axis));

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
                    create(start2, cornerDir, dragAxis, conveyorUtils.getPerpendicularAxis(dragAxis));

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
                    create(start2, cornerDir, dragAxis, conveyorUtils.getPerpendicularAxis(dragAxis));

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

