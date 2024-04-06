import { Box3, Box3Helper, Object3D, Vector2, Vector3 } from "three";
import { ICell, IConveyorItem } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { utils } from "../engine/Utils";
import { time } from "../engine/core/Time";
import { BezierPath } from "./BezierPath";
import { ConveyorUtils } from "./ConveyorUtils";
import { GameMapState } from "./components/GameMapState";
import { RawResourceType, ResourceType } from "./GameDefinitions";
import { meshes } from "../engine/resources/Meshes";

const { conveyorHeight, cellSize, conveyorSpeed } = config.game;
const halfCellSize = cellSize / 2;
const worldPos = new Vector3();
const curvePos = new Vector3();
const neighborCoords = new Vector2();

function makeCurve(xDir: number) {
    const curve = new BezierPath();
    curve.setPoints([
        new Vector3(0, 0, 0),
        new Vector3(0, 0, .5),
        new Vector3(.5 * xDir, 0, 1),
        new Vector3(1 * xDir, 0, 1)
    ]);
    return curve;
}

const curve = makeCurve(1);
const curveFlipped = makeCurve(-1);

function projectOnConveyor(item: IConveyorItem, localT: number) {
    GameUtils.mapToWorld(item.mapCoords, worldPos);
    const { direction, startAxis, endAxis } = item.owner.config;
    const isCorner = endAxis !== undefined;
    const { position } = item.visual;
    if (isCorner) {
        const [flipX, angle] = ConveyorUtils.getConveyorTransform(direction, startAxis);
        const _curve = flipX ? curveFlipped : curve;
        _curve.evaluate(localT, curvePos);
        curvePos
            .applyAxisAngle(GameUtils.vec3.up, angle)
            .multiplyScalar(halfCellSize);

        const sx = endAxis === "x" ? 0 : 1;
        const sz = 1 - sx;
        const startX = worldPos.x - direction.x * sx * halfCellSize;
        const startZ = worldPos.z - direction.y * sz * halfCellSize;
        position.x = startX + curvePos.x;
        position.z = startZ + curvePos.z;

    } else {
        const startX = worldPos.x - direction.x * halfCellSize;
        const startZ = worldPos.z - direction.y * halfCellSize;
        position.x = startX + direction.x * localT * cellSize;
        position.z = startZ + direction.y * localT * cellSize;
    }
}

class ConveyorItems {

    private _itemsRoot!: Object3D;
    private _items = new Array<IConveyorItem>();

    public async preload() {
        this._itemsRoot = utils.createObject(GameMapState.instance.layers.conveyors, "items");        
    }

    public dispose() {
        this._items.length = 0;
    }

    public update() {

        const step = time.deltaTime * conveyorSpeed / cellSize;

        for (const item of this._items) {
            let newT = item.localT + step;
            const halfItemSize = item.size / 2;
            const { endAxis, direction } = item.owner.config;
            const isCorner = endAxis !== undefined;
            const { mapCoords } = item;

            if (newT > 1) {

                // half the item passed to the next conveyor, time to transfer ownership                
                if (isCorner) {
                    const sx = endAxis === "x" ? 1 : 0;
                    const sz = 1 - sx;
                    neighborCoords.x = mapCoords.x + direction.x * sx;
                    neighborCoords.y = mapCoords.y + direction.y * sz;
                } else {
                    neighborCoords.addVectors(mapCoords, direction);
                }            

                const indexInCurrentOwner = item.owner.items.indexOf(item);
                console.assert(indexInCurrentOwner >= 0);
                utils.fastDelete(item.owner.items, indexInCurrentOwner);                
                
                const nextConveyor = GameUtils.getCell(neighborCoords)!;
                nextConveyor.conveyor!.items.push(item);
                item.mapCoords.copy(neighborCoords);
                item.owner = nextConveyor.conveyor!;

                const dt = newT - 1;
                newT = Math.min(dt, step);

            } else if (newT > 1 - halfItemSize) {

                const dt = newT - (1 - halfItemSize);

                // reached edge, check if space in next conveyor
                if (isCorner) {
                    const sx = endAxis === "x" ? 1 : 0;    
                    const sz = 1 - sx;
                    neighborCoords.x = mapCoords.x + direction.x * sx;
                    neighborCoords.y = mapCoords.y + direction.y * sz;
                } else {
                    neighborCoords.addVectors(mapCoords, direction);
                }

                let isBlocked = true;
                const nextConveyor = GameUtils.getCell(neighborCoords);
                if (nextConveyor?.conveyor) {
                    const { startAxis, endAxis } = item.owner.config;
                    const { startAxis: nextStartAxis, direction: nextDirection } = nextConveyor.conveyor.config;
                    const aligned = isCorner ? endAxis === nextStartAxis : startAxis === nextStartAxis;
                    if (aligned) {
                        const sameDirection = (() => {
                            const sx = nextStartAxis === "x" ? 1 : 0;
                            const sy = 1 - sx;
                            return (direction.x * sx === nextDirection.x * sx) && (direction.y * sy === nextDirection.y * sy);                                
                        })();

                        if (sameDirection) {
                            const existingItems = nextConveyor?.conveyor!.items;                            
                            let collisionFound = false;
                            for (const existingItem of existingItems) {
                                const itemEdge = existingItem.localT - existingItem.size / 2;
                                if (itemEdge < dt) {
                                    collisionFound = true;
                                    break;
                                }
                            }

                            if (!collisionFound) {
                                isBlocked = false;
                            }
                        }                       
                    }
                }
                
                if (isBlocked) {
                    newT = Math.max(1 - halfItemSize, item.localT);
                }             

            } else {

                // resolve collisions with other items in front of this one
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
                        newT = Math.max(otherEdge - halfItemSize, item.localT); 
                    }
                }
            }

            projectOnConveyor(item, newT);
            item.localT = newT;
        }
    }

    public addItem(cell: ICell, mapCoords: Vector2, resourceType: RawResourceType | ResourceType) {

        const itemSize = 1 / 3;
        const halfItemSize = itemSize / 2;
        const lowestT = halfItemSize;
        const edge = lowestT + halfItemSize;        
        const existingItems = cell.conveyor!.items;

        for (const item of existingItems) {
            const itemEdge = item.localT - item.size / 2;
            if (itemEdge < edge) {
                console.log(`no space in conveyor ${cell.id}`);
                return false;
            }
        }
        
        const visual = utils.createObject(this._itemsRoot, resourceType);
        meshes.load(`/models/resources/${resourceType}.glb`).then(([_mesh]) => {
            const mesh = _mesh.clone();
            // mesh.castShadow = true;
            if (!mesh.geometry.boundingBox) {
                mesh.geometry.computeBoundingBox();
            }
            const box3Helper = new Box3Helper(mesh.geometry.boundingBox!);
            box3Helper.visible = false;
            mesh.add(box3Helper);
            mesh.scale.multiplyScalar(cellSize).multiplyScalar(itemSize);
            mesh.position.y = conveyorHeight * cellSize;
            visual.add(mesh);
        });        

        const item: IConveyorItem = {
            size: itemSize,
            visual,
            owner: cell.conveyor!,
            mapCoords: mapCoords.clone(),
            localT: lowestT,
            type: resourceType
        };

        projectOnConveyor(item, lowestT);
        cell.conveyor!.items.push(item);
        this._items.push(item);
        return true;
    }

    public removeItem(item: IConveyorItem) {
        // assume it was already removed from the owner conveyor
        const index = this._items.indexOf(item);
        console.assert(index >= 0);
        utils.fastDelete(this._items, index);
        item.visual.removeFromParent();
    }
}

export const conveyorItems = new ConveyorItems();

