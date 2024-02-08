import { Vector2 } from "three";
import { GameUtils } from "./GameUtils";
import { railFactory } from "./RailFactory";
import { Axis, ICell } from "./GameTypes";
import { pools } from "../engine/core/Pools";
import { gameMapState } from "./components/GameMapState";

export class Rails {
    
    public static clear(cell: ICell) {
        const endCell = cell.rail?.endCell;
        const obj = cell.rail?.obj ?? endCell?.rail?.obj;
        console.assert(obj);
        obj?.removeFromParent();
        delete cell.rail;
        if (endCell) {
            delete endCell.rail;
        }
    }

    public static onDrag(start: Vector2, current: Vector2, dragAxis: Axis, railsOut: ICell[]) {
        const endCell = GameUtils.getCell(current)!;
        if (!endCell || endCell.rail) {
            return;
        }

        const startCell = GameUtils.getCell(start)!;
        if (startCell.rail) {
            return;
        }

        if (start.y === current.y) {
            const dx = current.x - start.x;
            if (dx === 0) {
                const rail = railFactory.makeRail(1, 1);
                Rails.setRail(rail, start, "x");
            } else {
                Rails.setStraightRailX(start, current);
            }
            railsOut.push(startCell);

        } else if (start.x === current.x) {
            const dz = current.y - start.y;
            if (dz === 0) {
                const rail = railFactory.makeRail(1, 0);
                Rails.setRail(rail, start, "z");
            } else {
                Rails.setStraightRailZ(start, current);
            }
            railsOut.push(startCell);

        } else {
            const dx = current.x - start.x;
            const dz = current.y - start.y;
            const adx = Math.abs(dx);
            const adz = Math.abs(dz);
            if (adx === adz) {
                Rails.setCurvedRail(dragAxis, start, current);
                railsOut.push(startCell);
            } else {
                if (dragAxis === "x") {
                    if (adx > adz) {
                        const straightSectionLength = adx - adz - 1;
                        const end1 = new Vector2(start.x + straightSectionLength * Math.sign(dx), start.y);
                        const start2 = new Vector2(end1.x + Math.sign(dx), start.y);
                        const end1Cell = GameUtils.getCell(end1)!;
                        const start2Cell = GameUtils.getCell(start2)!;
                        if (!end1Cell.rail && !start2Cell.rail) {
                            if (straightSectionLength > 0) {
                                Rails.setStraightRailX(start, end1);
                            } else {
                                const rail = railFactory.makeRail(1, 1);
                                Rails.setRail(rail, start, dragAxis);
                            }
                            railsOut.push(startCell);
                            Rails.setCurvedRail(dragAxis, start2, current);
                            const neighbordRail = GameUtils.getCell(start2)!;
                            railsOut.push(neighbordRail);
                        }
                    } else {
                        const straightSectionLength = adz - adx - 1;
                        const end1 = new Vector2(start.x + dx, start.y + Math.abs(dx) * Math.sign(dz));
                        const start2 = new Vector2(end1.x, end1.y + Math.sign(dz));
                        const end1Cell = GameUtils.getCell(end1)!;
                        const start2Cell = GameUtils.getCell(start2)!;
                        if (!end1Cell.rail && !start2Cell.rail) {
                            Rails.setCurvedRail(dragAxis, start, end1);
                            railsOut.push(startCell);
                            if (straightSectionLength > 0) {
                                Rails.setStraightRailZ(start2, current);
                            } else {
                                const rail = railFactory.makeRail(1, 0);
                                Rails.setRail(rail, start2, "z");
                            }
                            railsOut.push(GameUtils.getCell(start2)!);
                        }
                    }
                } else {
                    if (adx > adz) {
                        const straightSectionLength = adx - adz - 1;
                        const end1 = new Vector2(start.x + Math.abs(dz) * Math.sign(dx), start.y + dz);
                        const start2 = new Vector2(end1.x + Math.sign(dx), end1.y);
                        const end1Cell = GameUtils.getCell(end1)!;
                        const start2Cell = GameUtils.getCell(start2)!;
                        if (!end1Cell.rail && !start2Cell.rail) {
                            Rails.setCurvedRail(dragAxis, start, end1);
                            railsOut.push(startCell);

                            if (straightSectionLength > 0) {
                                Rails.setStraightRailX(start2, current);
                            } else {
                                const rail = railFactory.makeRail(1, 1);
                                Rails.setRail(rail, start2, "x");
                            }
                            railsOut.push(GameUtils.getCell(start2)!);
                        }
                    } else {
                        const straightSectionLength = adz - adx - 1;
                        const end1 = new Vector2(start.x, start.y + straightSectionLength * Math.sign(dz));
                        const start2 = new Vector2(start.x, end1.y + Math.sign(dz));
                        const end1Cell = GameUtils.getCell(end1)!;
                        const start2Cell = GameUtils.getCell(start2)!;
                        if (!end1Cell.rail && !start2Cell.rail) {
                            if (straightSectionLength > 0) {
                                Rails.setStraightRailZ(start, end1);
                            } else {
                                const rail = railFactory.makeRail(1, 0);
                                Rails.setRail(rail, start, dragAxis);
                            }
                            railsOut.push(startCell);

                            Rails.setCurvedRail(dragAxis, start2, current);
                            railsOut.push(GameUtils.getCell(start2)!);
                        }
                    }
                }
            }
        }
    }

    public static onEndDrag(rail: ICell[]) {
        // link to neighbors
        for (const cell of rail) {
            const neighborCoord = pools.vec2.getOne();
            const { mapCoords, endCell, axis } = cell.rail!;
            for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                neighborCoord.set(mapCoords.x + offset[0], mapCoords.y + offset[1]);
                const neighbor = GameUtils.getCell(neighborCoord);
                if (neighbor === endCell) {
                    continue;
                }
                if (neighbor?.rail) {
                    if (axis === neighbor.rail.axis) {
                        const [offsetX, offsetZ] = offset;
                        if ((axis === "x" && offsetZ !== 0) || (axis === "z" && offsetX !== 0)) {
                            continue;
                        }
                        if (!cell.rail!.neighbors) {
                            cell.rail!.neighbors = { x: {}, z: {} };
                        }
                        if (!neighbor.rail.neighbors) {
                            neighbor.rail.neighbors = { x: {}, z: {} };
                        }
                        const _offset = axis === "x" ? offsetX : offsetZ;
                        const dir = Math.sign(_offset);
                        cell.rail!.neighbors[axis][`${dir}`] = neighbor;
                        neighbor.rail!.neighbors[axis][`${-dir}`] = cell;
                    }
                }
            }

            if (endCell) {
                const { mapCoords: mapCoords2, endCell: endCell2, axis: axis2 } = endCell.rail!;
                for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    neighborCoord.set(mapCoords2.x + offset[0], mapCoords2.y + offset[1]);
                    const neighbor = GameUtils.getCell(neighborCoord);
                    if (neighbor === endCell2) {
                        continue;
                    }
                    if (neighbor?.rail) {
                        if (axis2 === neighbor.rail.axis) {
                            const [offsetX, offsetZ] = offset;
                            if ((axis2 === "x" && offsetZ !== 0) || (axis2 === "z" && offsetX !== 0)) {
                                continue;
                            }
                            if (!endCell.rail!.neighbors) {
                                endCell.rail!.neighbors = { x: {}, z: {} };
                            }
                            if (!neighbor.rail.neighbors) {
                                neighbor.rail.neighbors = { x: {}, z: {} };
                            }
                            const _offset = axis2 === "x" ? offsetX : offsetZ;
                            const dir = Math.sign(_offset);
                            endCell.rail!.neighbors[axis2][`${dir}`] = neighbor;
                            neighbor.rail!.neighbors[axis2][`${-dir}`] = endCell;
                        }
                    }
                }
            }
        }
    }

    private static setRail(
        rail: THREE.Object3D,
        startCoords: Vector2,
        startAxis: Axis,
        endCoords?: Vector2,
        endAxis?: Axis
    ) {
        const [sectorCoords, sectorCoords2] = pools.vec2.get(2);
        const startCell = GameUtils.getCell(startCoords, sectorCoords)!;
        const endCell = endCoords ? GameUtils.getCell(endCoords, sectorCoords2)! : undefined;

        GameUtils.mapToWorld(startCoords, rail.position);
        gameMapState.layers.rails.add(rail);
        startCell.rail = {
            obj: rail,
            axis: startAxis,
            endCell,
            worldPos: rail.position.clone(),
            tip: "start",
            mapCoords: startCoords.clone()
        };        
        if (endCoords) {
            console.assert(endAxis);
            const endPos = pools.vec3.getOne();
            GameUtils.mapToWorld(endCoords!, endPos)
            endCell!.rail = {
                obj: rail,
                axis: endAxis!,
                endCell: startCell,
                worldPos: endPos.clone(),
                tip: "end",
                mapCoords: endCoords!.clone()
            };
        }
    }

    private static setStraightRailX(start: Vector2, end: Vector2) {
        const dx = end.x - start.x;
        const rail = railFactory.makeRail(Math.abs(dx) + 1, dx > 0 ? 1 : 3);
        Rails.setRail(rail, start, "x", end, "x");
    }

    private static setStraightRailZ(start: Vector2, end: Vector2) {
        const dz = end.y - start.y;
        const rail = railFactory.makeRail(Math.abs(dz) + 1, dz > 0 ? 0 : 2);
        Rails.setRail(rail, start, "z", end, "z");
    }

    private static setCurvedRail(initialDirection: Axis, start: Vector2, end: Vector2) {
        const dx = end.x - start.x;
        const dz = end.y - start.y;
        const adx = Math.abs(dx);
        const [directionX, rotation] = (() => {
            if (initialDirection === "z") {
                if (dz > 0) {
                    if (dx > 0) {
                        return [1, 0];
                    } else {
                        return [-1, 0];
                    }
                } else {
                    if (dx > 0) {
                        return [-1, 2];
                    } else {
                        return [1, 2];
                    }
                }
            } else {
                if (dz > 0) {
                    if (dx > 0) {
                        return [-1, 1];
                    } else {
                        return [1, 3];
                    }
                } else {
                    if (dx > 0) {
                        return [1, 1];
                    } else {
                        return [-1, 3];
                    }
                }
            }
        })();
        const rail = railFactory.makeCurvedRail(adx + 1, rotation, directionX);
        Rails.setRail(rail, start, initialDirection, end, initialDirection === "x" ? "z" : "x");
    }
}
