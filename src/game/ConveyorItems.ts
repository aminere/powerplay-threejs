import { Box3, Box3Helper, Mesh, Object3D, Vector2, Vector3 } from "three";
import { ICell, IConveyorItem } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { utils } from "../engine/Utils";
import { gameMapState } from "./components/GameMapState";
import { meshes } from "../engine/resources/Meshes";
import { time } from "../engine/core/Time";
import { BezierPath } from "./BezierPath";
import { ConveyorUtils } from "./ConveyorUtils";

const { conveyorHeight, cellSize } = config.game;
const halfCellSize = cellSize / 2;
const worldPos = new Vector3();
const curvePos = new Vector3();
const neighborCoords = new Vector2();

function makeCurve(xDir: number) {
    const x1 = 0;
    const x2 = .5;
    const x3 = 1;
    const z1 = 0;
    const z2 = .5;
    const z3 = 1;
    const curve = new BezierPath();
    curve.setPoints([
        new Vector3(x1, 0, z1),
        new Vector3(x1, 0, z2),
        new Vector3(x2 * xDir, 0, z3),
        new Vector3(x3 * xDir, 0, z3)
    ]);
    return curve;
}

const curve = makeCurve(1);
const curveFlipped = makeCurve(-1);

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
            const { endAxis, direction } = item.owner.config;
            const isCorner = endAxis !== undefined;
            const { obj } = item;

            if (newT > 1) {

                const dt = newT - 1;

                // half the item passed to the next conveyor, time to transfer ownership                
                if (isCorner) {
                    const sx = endAxis === "x" ? 1 : 0;
                    const sz = 1 - sx;
                    neighborCoords.x = item.mapCoords.x + direction.x * sx;
                    neighborCoords.y = item.mapCoords.y + direction.y * sz;
                } else {
                    neighborCoords.addVectors(item.mapCoords, direction);
                }

                const nextConveyor = GameUtils.getCell(neighborCoords)!;
                console.assert(nextConveyor);
                nextConveyor.conveyor!.items.push(item);
                item.mapCoords.copy(neighborCoords);

                const indexInCurrentOwner = item.owner.items.indexOf(item);
                console.assert(indexInCurrentOwner >= 0);
                item.owner.items.splice(indexInCurrentOwner, 1);
                item.owner = nextConveyor.conveyor!;

                newT = dt;                

            } else if (newT > 1 - halfItemSize) {

                const dt = newT - (1 - halfItemSize);

                // reached edge, check if space in next conveyor
                let canAdvance = true;
                if (isCorner) {
                    const sx = endAxis === "x" ? 1 : 0;    
                    const sz = 1 - sx;
                    neighborCoords.x = item.mapCoords.x + direction.x * sx;
                    neighborCoords.y = item.mapCoords.y + direction.y * sz;
                } else {
                    neighborCoords.addVectors(item.mapCoords, direction);
                }

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

            GameUtils.mapToWorld(item.mapCoords, worldPos);
            const { direction: currentDir, startAxis: currentStartAxis, endAxis: currentEndAxis } = item.owner.config;
            const currentIsConer = currentEndAxis !== undefined;
            if (currentIsConer) {                
                const [flipX, angle] = ConveyorUtils.getConveyorTransform(currentDir, currentStartAxis);
                const _curve = flipX ? curveFlipped : curve;
                _curve.evaluate(newT, curvePos);
                curvePos.applyAxisAngle(GameUtils.vec3.up, angle);
                curvePos.multiplyScalar(halfCellSize);

                const sx = currentEndAxis === "x" ? 0 : 1;
                const sz = 1 - sx;
                const startX = worldPos.x - currentDir.x * sx * halfCellSize;
                const startZ = worldPos.z - currentDir.y * sz * halfCellSize;
                obj.position.x = startX + curvePos.x;
                obj.position.z = startZ + curvePos.z;

            } else {
                const startX = worldPos.x - currentDir.x * halfCellSize;
                const startZ = worldPos.z - currentDir.y * halfCellSize;
                obj.position.x = startX + currentDir.x * newT * cellSize;
                obj.position.z = startZ + currentDir.y * newT * cellSize;
            }

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

