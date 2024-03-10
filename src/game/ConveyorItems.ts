import { Box3, Box3Helper, Mesh, Object3D, Vector2, Vector3 } from "three";
import { ICell, IConveyorItem } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { utils } from "../engine/Utils";
import { gameMapState } from "./components/GameMapState";
import { meshes } from "../engine/resources/Meshes";
import { time } from "../engine/core/Time";

const { conveyorHeight, cellSize } = config.game;
const halfCellSize = cellSize / 2;
const worldPos = new Vector3();
const neighborCoords = new Vector2();
const itemsToDelete = new Array<[number, ICell, ICell, Vector2]>();

function getConveyorFreeSpace(cell: ICell) {
    const { items } = cell.conveyor!;
    let size = 0;
    for (const item of items) {
        size += item.size;
    }
    return 1 - size;
}

class ConveyorItems {
    
    private _items!: Object3D;
    private _item!: Mesh;
    private _activeConveyors = new Map<string, {
        cell: ICell;
        mapCoords: Vector2;
    }>();

    public async preload() {
        this._items = utils.createObject(gameMapState.layers.conveyors, "items");
        const [item] = await meshes.load("/models/resources/iron-ore.glb");
        this._item = item;
    }

    public update() {
        for (const [, info] of this._activeConveyors) {
            GameUtils.mapToWorld(info.mapCoords, worldPos);
            const { items, config } = info.cell.conveyor!;
            const { direction, startAxis, endAxis } = config;
            const isCorner = endAxis !== undefined;
            itemsToDelete.length = 0;
            for (let i = 0; i < items.length; ++i) {
                const item = items[i];
                const { obj, size } = item;
                if (isCorner) {

                } else {
                    if (startAxis === "x") {
                        const dx = direction.x * time.deltaTime;
                        const localX = obj.position.x - worldPos.x;
                        const newLocalX = localX + dx;
                        const newEdge = newLocalX + (size / 2) * direction.x;
                        const outOfBounds = Math.abs(newEdge) > halfCellSize;
                        if (outOfBounds) {
                            // reached bound
                            neighborCoords.addVectors(info.mapCoords, direction);
                            const nextConveyor = GameUtils.getCell(neighborCoords);
                            if (nextConveyor?.conveyor) {
                                const freeSpace = getConveyorFreeSpace(nextConveyor);
                                if (freeSpace - item.size > 0) {
                                    itemsToDelete.push([i, info.cell, nextConveyor, neighborCoords.clone()]);
                                }                                
                            }
                        } else {
                            obj.position.x += dx;
                        }
                    }
                }
            }            
        }

        for (const [index, conveyor, nextConveyor, mapCoords] of itemsToDelete) {
            const { items } = conveyor.conveyor!;
            const item = items[index];

            items.splice(index, 1);
            if (items.length === 0) {
                console.log(`removing conveyor ${conveyor.id}`);
                this._activeConveyors.delete(conveyor.id);
            }

            nextConveyor.conveyor!.items.push(item);                
            if (!this._activeConveyors.has(nextConveyor.id)) {
                console.log(`activating conveyor ${nextConveyor.id}`);
                this._activeConveyors.set(nextConveyor.id, {
                    cell: nextConveyor,
                    mapCoords
                });
            }
        }
    }

    public addItem(cell: ICell, mapCoords: Vector2) {
        const obj = this._item.clone();
        const bbox = new Box3().setFromObject(obj);
        const box3Helper = new Box3Helper(bbox);
        obj.add(box3Helper);

        const item: IConveyorItem = {
            size: 1 / 3,
            obj: obj
        };
        obj.scale.multiplyScalar(cellSize).multiplyScalar(item.size);

        GameUtils.mapToWorld(mapCoords, obj.position);
        obj.position.y = conveyorHeight * cellSize;
        this._items.add(obj);
        cell.conveyor!.items.push(item);

        if (!this._activeConveyors.has(cell.id)) {
            this._activeConveyors.set(cell.id, {
                cell,
                mapCoords: mapCoords.clone()
            });
        }
    }
}

export const conveyorItems = new ConveyorItems();

