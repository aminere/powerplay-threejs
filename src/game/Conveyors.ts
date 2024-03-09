import { DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, RepeatWrapping, Texture, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { pools } from "../engine/core/Pools";
import { Axis, ICell, IConveyorItem } from "./GameTypes";
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
    private _item!: Mesh;
    private _straightCells: ICell[] = [];
    private _topTexture!: Texture;
    private _loaded = false;
    private _disposed = false;
    private _activeConveyors = new Map<string, {
        cell: ICell;
        mapCoords: Vector2;
    }>();

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
        const conveyorInstances = ConveyorUtils.createInstancedMesh("conveyors", conveyor.geometry, baseMaterial);
        gameMapState.layers.conveyors.add(conveyorInstances);
        this._conveyors = conveyorInstances;

        conveyorTop.geometry.scale(conveyorWidth, 1, 1);
        const topMaterial = conveyorTop.material as MeshBasicMaterial;
        const conveyorTopInstances = ConveyorUtils.createInstancedMesh("conveyors-tops", conveyorTop.geometry, topMaterial);
        gameMapState.layers.conveyors.add(conveyorTopInstances);
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
        this._items = utils.createObject(gameMapState.layers.conveyors, "items");
        const [item] = await meshes.load("/models/resources/iron-ore.glb");
        this._item = item;
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
            items: []
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
            gameMapState.layers.conveyors.add(baseMesh);
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
        
        cell.isEmpty = false;
        cell.flowFieldCost = 0xffff;
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

    public createAndFit(mapCoords: Vector2) {
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

        const cell = GameUtils.getCell(mapCoords)!;
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
    
                    const defaultAxis = "z";
                    const direction = new Vector2(0, 1);
                    if (newAxis === defaultAxis) {
                        if (neighborStartAxis === newAxis) {
                            if (!direction.equals(neighborDir)) {
                                direction.copy(neighborDir);
                            }
    
                        } else {
                            if (neighborInfo.isExit) {
                                direction.set(dx, dy);
                            } else {
                                direction.set(-dx, -dy);
                            }                        
                        }
    
                    } else {                    
                        if (neighborInfo.isExit) {
                            direction.set(dx, dy);
                        } else {
                            direction.set(-dx, -dy);
                        }                                        
                    }
    
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
                    // TODO align to the second neighbor and/or align the second neighbor                    
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
        delete cell.conveyor;
        cell.isEmpty = true;
        cell.flowFieldCost = 1;
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
        delete cell.conveyor;
        cell.isEmpty = true;
        cell.flowFieldCost = 1;
    }

    public onDrag(start: Vector2, end: Vector2, cellsOut: Vector2[], dragAxis: Axis) {
        const [mapCoords, offset2, start2, dir, cornerDir] = pools.vec2.get(5);

        const create = (coords: Vector2, direction: Vector2, axis: Axis, endAxis?: Axis) => {
            const cell = GameUtils.getCell(coords);
            if (!cell || !cell.isEmpty || cell.roadTile !== undefined) {
                return;
            }
            cellsOut.push(coords.clone());
            this.create(cell, coords, direction, axis, endAxis);
        };

        const scan = (origin: Vector2, direction: Vector2, iterations: number, axis: Axis) => {
            for (let i = 0; i <= iterations; ++i) {
                mapCoords.copy(origin).addScaledVector(direction, i);
                create(mapCoords, direction, axis);
            }
        };

        if (dragAxis === "x") {
            dir.set(Math.sign(end.x - start.x), 0);
            const xIterations = Math.abs(end.x - start.x);
            scan(start, dir, xIterations - 1, dragAxis);
            if (end.y !== start.y) {
                
                start2.copy(start).addScaledVector(dir, xIterations);
                const dy = Math.sign(end.y - start.y);
                offset2.set(0, dy);

                if (end.x !== start.x) {                    
                    const dx = Math.sign(end.x - start.x);
                    cornerDir.set(dx, dy);
                    create(start2, cornerDir, dragAxis, ConveyorUtils.getPerpendicularAxis(dragAxis));

                } else {
                    create(start, offset2, "z");
                }

                start2.y += dy;
                const yIterations = Math.abs(end.y - start.y);
                scan(start2, offset2, yIterations - 1, "z");

            } else {
                create(end, dir, dragAxis);
            }

        } else {
            dir.set(0, Math.sign(end.y - start.y));
            const yIterations = Math.abs(end.y - start.y);
            scan(start, dir, yIterations - 1, dragAxis);
            if (end.x !== start.x) {

                start2.copy(start).addScaledVector(dir, yIterations);
                const dx = Math.sign(end.x - start.x);
                offset2.set(dx, 0);                

                if (end.y !== start.y) {
                    const dy = Math.sign(end.y - start.y);
                    cornerDir.set(dx, dy);
                    create(start2, cornerDir, dragAxis, ConveyorUtils.getPerpendicularAxis(dragAxis));

                } else {
                    create(start, offset2, "x");
                }
                
                start2.x += dx;
                const xIterations = Math.abs(end.x - start.x);
                scan(start2, offset2, xIterations - 1, "x");
            } else {
                create(end, dir, dragAxis);
            }
        }
    }

    public update() {
        if (!this._loaded) {
            return;
        }

        this._topTexture.offset.y -= time.deltaTime;

        // for (const [, info] of this._activeConveyors) {
        //     GameUtils.mapToWorld(info.mapCoords, worldPos);
        //     if (ConveyorUtils.isCorner(info.cell)) {
        //     } else {
        //         const { startAxis, direction } = info.cell.conveyor!.config!;
        //         for (const { size, obj } of info.cell.conveyor!.items) {
        //             const localX = obj.position.x - worldPos.x;
        //             const localZ = obj.position.z - worldPos.z;
        //             obj.position.x += time.deltaTime * direction.x;
        //             obj.position.z += time.deltaTime * direction.y;
        //         }
        //     }
        // }
    }

    public dispose() {
        this._disposed = true;
        this._conveyors.count = 0;
        this._conveyorTops.count = 0;
        this._straightCells.length = 0;
    }

    public addItem(cell: ICell, mapCoords: Vector2) {
        const obj = this._item.clone();
        GameUtils.mapToWorld(mapCoords, obj.position);
        obj.position.y = conveyorHeight * cellSize;
        this._items.add(obj);

        const item: IConveyorItem = {
            size: .3,
            obj: obj
        };
        cell.conveyor!.items.push(item);
        if (!this._activeConveyors.has(cell.id)) {
            this._activeConveyors.set(cell.id, {
                cell,
                mapCoords: mapCoords.clone()
            });
        }
    }
}

export const conveyors = new Conveyors();

