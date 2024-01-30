import { Camera, Vector2 } from "three";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { engine } from "../../engine/Engine";
import { gameMapState } from "./GameMapState";
import { Elevation } from "../Elevation";
import { MineralType, TileType, TileTypes } from "../GameDefinitions";
import { ICell } from "../GameTypes";
import { Roads } from "../Roads";
import { Rails } from "../Rails";
import { Buildings } from "../Buildings";
import { resources } from "../Resources";
import { Sector } from "../Sector";
import { GameMapProps } from "./GameMapProps";

const { elevationStep, cellSize, mapRes } = config.game;
export function pickSectorTriangle(sectorX: number, sectorY: number, camera: Camera) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorX},${sectorY}`);
    if (!sector) {
        return -1;
    }
    let selectedVertexIndex = -1;
    const plane = pools.plane.getOne();
    const triangle = pools.triangle.getOne();
    const line = pools.line3.getOne();
    const [rayEnd, v1, v2, v3, intersection] = pools.vec3.get(5);
    const normalizedPos = pools.vec2.getOne();
    const { width, height } = engine.screenRect;
    normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
    GameUtils.rayCaster.setFromCamera(normalizedPos, camera);
    const { ray } = GameUtils.rayCaster;
    rayEnd.copy(ray.origin).addScaledVector(ray.direction, 100);
    line.set(ray.origin, rayEnd);
    const geometry = (sector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const indices = geometry.getIndex()!.array;
    const mapSize = mapRes * cellSize;
    const offset = -mapSize / 2;
    const sectorOffsetX = sectorX * mapSize + offset;
    const sectorOffsetY = sectorY * mapSize + offset;
    let distToClosestIntersection = Infinity;
    for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i];
        const i2 = indices[i + 1];
        const i3 = indices[i + 2];
        v1.set(sectorOffsetX + position.getX(i1), position.getY(i1) * elevationStep, sectorOffsetY + position.getZ(i1));
        v2.set(sectorOffsetX + position.getX(i2), position.getY(i2) * elevationStep, sectorOffsetY + position.getZ(i2));
        v3.set(sectorOffsetX + position.getX(i3), position.getY(i3) * elevationStep, sectorOffsetY + position.getZ(i3));
        plane.setFromCoplanarPoints(v1, v2, v3);
        if (plane.normal.dot(ray.direction) < 0) {
            if (plane.intersectLine(line, intersection)) {
                triangle.set(v1, v2, v3);
                if (triangle.containsPoint(intersection)) {
                    const dist = intersection.distanceTo(ray.origin);
                    if (dist < distToClosestIntersection) {
                        distToClosestIntersection = dist;
                        selectedVertexIndex = i;
                    }
                }
            }
        }
    }
    return selectedVertexIndex;
}

export function raycastOnCells(screenPos: Vector2, camera: Camera, cellCoordsOut: Vector2, localCoordsOut?: Vector2) {
    const intersection = pools.vec3.getOne();
    if (!GameUtils.screenCastOnPlane(camera, screenPos, 0, intersection)) {
        return null;
    }
    const sectorCoords = pools.vec2.getOne();    
    GameUtils.worldToMap(intersection, cellCoordsOut);

    if (localCoordsOut) {
        const cellPos = pools.vec3.getOne();
        GameUtils.mapToWorld(cellCoordsOut, cellPos);
        localCoordsOut.set(intersection.x - cellPos.x, intersection.z - cellPos.z);
    }

    let cell = GameUtils.getCell(cellCoordsOut, sectorCoords);
    let sectorX = sectorCoords.x;
    let sectorY = sectorCoords.y;
    let selectedVertexIndex = cell ? pickSectorTriangle(sectorX, sectorY, camera) : -1;

    if (selectedVertexIndex < 0 && cell) {
        // check neighboring sectors, from closest to farthest
        const neighborSectors = new Array<[number, number]>();
        const { sectors } = gameMapState;
        for (const offsetY of [-1, 0, 1]) {
            for (const offsetX of [-1, 0, 1]) {
                if (offsetX === 0 && offsetY === 0) {
                    continue;
                }
                const neighborKey = `${sectorX + offsetX},${sectorY + offsetY}`;
                const neighborSector = sectors.get(neighborKey);
                if (neighborSector) {
                    neighborSectors.push([sectorX + offsetX, sectorY + offsetY]);
                }
            }
        }
        const halfRes = mapRes / 2;
        neighborSectors.sort((a, b) => {
            const aCenterX = a[0] * mapRes + halfRes;
            const aCenterY = a[1] * mapRes + halfRes;
            const cellToSectorDistA = Math.abs(aCenterX - cellCoordsOut.x) + Math.abs(aCenterY - cellCoordsOut.y);
            const bCenterX = b[0] * mapRes + halfRes;
            const bCenterY = b[1] * mapRes + halfRes;
            const cellToSectorDistB = Math.abs(bCenterX - cellCoordsOut.x) + Math.abs(bCenterY - cellCoordsOut.y);
            return cellToSectorDistA - cellToSectorDistB;
        });
        for (const [x, y] of neighborSectors) {
            selectedVertexIndex = pickSectorTriangle(x, y, camera);
            if (selectedVertexIndex >= 0) {
                sectorX = x;
                sectorY = y;
                break;
            }
        }
    }

    if (selectedVertexIndex >= 0) {
        const selectedCell = Math.floor(selectedVertexIndex / 6);
        cellCoordsOut.set(
            sectorX * mapRes + selectedCell % mapRes,
            sectorY * mapRes + Math.floor(selectedCell / mapRes)
        );
        cell = gameMapState.sectors.get(`${sectorX},${sectorY}`)!.cells[selectedCell];
    }

    return cell;
}

export function onDrag(start: Vector2, current: Vector2, props: GameMapProps) { // map coords
    switch (gameMapState.action) {
        case "road": {
            for (const cell of gameMapState.previousRoad) {
                Roads.clear(cell);
            }
            gameMapState.previousRoad.length = 0;
            Roads.onDrag(start, current, gameMapState.previousRoad, gameMapState.initialDragAxis!);
        }
            break;

        case "rail": {
            for (const cell of gameMapState.previousRail) {
                Rails.clear(cell);
            }
            gameMapState.previousRail.length = 0;
            Rails.onDrag(start, current, gameMapState.initialDragAxis!, gameMapState.previousRail);

        } break;

        case "terrain": {
            onTerrain(current, props.tileType);
        } break;
    }
}

export function onBeginDrag(start: Vector2, current: Vector2, props: GameMapProps) { // map coords
    if (start.x === current.x) {
        gameMapState.initialDragAxis = "z";
    } else if (start.y === current.y) {
        gameMapState.initialDragAxis = "x";
    } else {
        if (current.y < start.y) {
            gameMapState.initialDragAxis = "x";
        } else {
            gameMapState.initialDragAxis = "z";
        }
    }

    if (gameMapState.action === "rail") {
        const neighborCoord = pools.vec2.getOne();
        for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoord.set(start.x + offset[0], start.y + offset[1]);
            const neighbor = GameUtils.getCell(neighborCoord);
            const rail = neighbor?.rail
            if (rail) {
                gameMapState.initialDragAxis = rail.axis;
                break;
            }
        }
    }

    onDrag(start, current, props);
}

export function onEndDrag() { // map coords
    gameMapState.previousRoad.length = 0;

    if (gameMapState.previousRail.length > 0) {
        console.assert(gameMapState.action === "rail");
        Rails.onEndDrag(gameMapState.previousRail);
    }

    gameMapState.previousRail.length = 0;
}

export function onCancelDrag() {
    for (const cell of gameMapState.previousRoad) {
        Roads.clear(cell);
    }
    gameMapState.previousRoad.length = 0;

    for (const cell of gameMapState.previousRail) {
        Rails.clear(cell);
    }
    gameMapState.previousRail.length = 0;
}

export function onElevation(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, radius: number, button: number) {
    if (button === 0) {
        Elevation.elevate(mapCoords, sectorCoords, localCoords, 1, radius);
    } else if (button === 2) {
        Elevation.elevate(mapCoords, sectorCoords, localCoords, -1, radius);
    }
}

export function onRoad(mapCoords: Vector2, cell: ICell, button: number) {
    if (button === 0) {
        if (cell.isEmpty) {
            Roads.create(mapCoords);
        }
    } else if (button === 2) {
        if (cell.roadTile !== undefined) {
            Roads.clear(mapCoords);
        }
    }
}

export function onBuilding(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    if (button === 0) {
        if (cell.isEmpty && cell.roadTile === undefined) {
            Buildings.create(sector, localCoords, cell);
        }
    } else if (button === 2) {
        if (cell.building) {
            Buildings.clear(sector, cell);
        }
    }
}

export function onMineral(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number, type: MineralType) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    if (button === 0) {
        if (cell.isEmpty && cell.roadTile === undefined) {
            resources.create(sector, localCoords, cell, type);
        }
    } else if (button === 2) {
        if (cell.resource) {
            resources.clear(sector, cell);
        }
    }
}

export function onTree(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    if (button === 0) {
        if (cell.isEmpty && cell.roadTile === undefined) {
            resources.create(sector, localCoords, cell, "tree");
        }
    } else if (button === 2) {
        if (cell.resource) {
            resources.clear(sector, cell);
        }
    }
}

export function onTerrain(mapCoords: Vector2, tileType: TileType) {
    const [sectorCoords, localCoords] = pools.vec2.get(2);
    GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
    const terrainTileIndex = TileTypes.indexOf(tileType);
    console.assert(terrainTileIndex >= 0);
    const baseTerrainTileIndex = 32;
    const tileIndex = baseTerrainTileIndex + terrainTileIndex;
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    Sector.updateCellTexture(sector, localCoords, tileIndex);
}

