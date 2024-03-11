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

function getConveyorFreeSpace(cell: ICell) {
    const { items } = cell.conveyor!;
    let size = 0;
    for (const item of items) {
        size += item.size;
    }
    return 1 - size;
}

class ConveyorItems {

    private _item!: Mesh;
    private _itemsRoot!: Object3D;
    private _items = new Array<IConveyorItem>();

    public async preload() {
        this._itemsRoot = utils.createObject(gameMapState.layers.conveyors, "items");
        const [item] = await meshes.load("/models/resources/iron-ore.glb");
        item.castShadow = true;
        this._item = item;
    }

    public dispose() {
        this._items.length = 0;
    }

    public update() {

        for (const item of this._items) {
            console.assert(item.localT >= 0 && item.localT <= 1);
            let newT = item.localT + time.deltaTime / cellSize;            
            const halfItemSize = item.size / 2;

            if (newT > 1) {

                const dt = newT - 1;

                // half the item passed to the next conveyor, time to transfer ownership
                const { mapCoords } = item;
                const { endAxis, direction } = item.owner.config;
                const isCorner = endAxis !== undefined;
                if (isCorner) {
                    console.log("todo");
                } else {
                    neighborCoords.addVectors(mapCoords, direction);
                    const nextConveyor = GameUtils.getCell(neighborCoords)!;
                    console.assert(nextConveyor);
                    nextConveyor.conveyor!.items.push(item);
                    item.mapCoords.copy(neighborCoords);

                    const indexInCurrentOwner = item.owner.items.indexOf(item);
                    console.assert(indexInCurrentOwner >= 0);
                    item.owner.items.splice(indexInCurrentOwner, 1);
                    item.owner = nextConveyor.conveyor!;
                }

                newT = dt;                

            } else if (newT > 1 - halfItemSize) {

                const dt = newT - (1 - halfItemSize);

                // reached edge, check if space in next conveyor                
                let canAdvance = true;
                const { mapCoords } = item;
                const { endAxis, direction } = item.owner.config;
                const isCorner = endAxis !== undefined;
                if (isCorner) {
                    console.log("todo");
                } else {
                    neighborCoords.addVectors(mapCoords, direction);
                    const nextConveyor = GameUtils.getCell(neighborCoords);                    
                    if (nextConveyor?.conveyor) {
                        const existingItems = nextConveyor?.conveyor!.items;
                        for (const existingItem of existingItems) {
                            console.assert(existingItem.localT >= 0 && existingItem.localT <= 1);
                            const itemEdge = existingItem.localT - existingItem.size / 2;
                            if (itemEdge < dt) {
                                canAdvance = false;
                                break;
                            }
                        }
                    } else {
                        canAdvance = false;
                    }
                }     
                
                if (!canAdvance) {
                    newT = 1 - halfItemSize;                    
                }             

            } else {

                // check collision with other items in front of this one
                const otherItems = item.owner.items;
                for (const otherItem of otherItems) {
                    if (otherItem === item) {
                        continue;
                    }
                    const otherT = otherItem.localT;
                    if (otherT < newT) {
                        continue;
                    }

                    const halfOtherItemSize = otherItem.size / 2;
                    const otherEdge = otherT - halfOtherItemSize;
                    if (newT + halfItemSize > otherEdge) {
                        newT = otherEdge - halfItemSize;
                        break;
                    }
                }
            }

            const { direction } = item.owner.config;
            const { obj, mapCoords } = item;
            GameUtils.mapToWorld(mapCoords, worldPos);
            const startX = worldPos.x - direction.x * halfCellSize;
            const startZ = worldPos.z - direction.y * halfCellSize;
            obj.position.x = startX + direction.x * newT * cellSize;
            obj.position.z = startZ + direction.y * newT * cellSize;
            item.localT = newT;
        }
    }

    public addItem(cell: ICell, mapCoords: Vector2) {

        const itemSize = 1 / 3;
        const halfItemSize = itemSize / 2;
        const lowestT = halfItemSize;
        const edge = lowestT + halfItemSize;        
        const existingItems = cell.conveyor!.items;
        for (const item of existingItems) {
            const itemEdge = item.localT - item.size / 2;
            if (itemEdge < edge) {
                console.log(`no space in conveyor ${cell.id}`);
                return;
            }
        }
        
        const obj = this._item.clone();
        const bbox = new Box3().setFromObject(obj);
        const box3Helper = new Box3Helper(bbox);
        box3Helper.visible = false;
        obj.add(box3Helper);

        const item: IConveyorItem = {
            size: itemSize,
            obj: obj,
            owner: cell.conveyor!,
            mapCoords: mapCoords.clone(),
            localT: lowestT
        };
        obj.scale.multiplyScalar(cellSize).multiplyScalar(item.size);

        GameUtils.mapToWorld(mapCoords, worldPos);
        const { endAxis, direction } = cell.conveyor!.config;
        const isCorner = endAxis !== undefined;
        if (isCorner) {
            console.log("todo");
        } else {            
            const startX = worldPos.x - direction.x * halfCellSize;
            const startZ = worldPos.z - direction.y * halfCellSize;
            obj.position.x = startX + direction.x * lowestT * cellSize;
            obj.position.z = startZ + direction.y * lowestT * cellSize;
        }

        obj.position.y = conveyorHeight * cellSize;
        this._itemsRoot.add(obj);
        cell.conveyor!.items.push(item);
        this._items.push(item);
    }
}

export const conveyorItems = new ConveyorItems();

