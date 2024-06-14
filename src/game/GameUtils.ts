
import { Camera, Vector2, Vector3, Raycaster, Plane, Line3, Mesh, BufferGeometry, BufferAttribute, MathUtils } from "three";
import { config } from "./config/config";
import { GameMapState } from "./components/GameMapState";
import { ICell, ISector } from "./GameTypes";
import { engine } from "../engine/Engine";

const { mapRes, cellSize, elevationStep } = config.game;
const halfRes = mapRes / 2;
const verticesPerRow = mapRes + 1;
const mapSize = mapRes * cellSize;
const halfMapSize = mapSize / 2;
const halfCellSize = cellSize / 2;
const cellOffset = -halfMapSize + halfCellSize;
const normalizedPos = new Vector3();
const normalizedPos2d = new Vector2();
const ground = new Plane();
const line = new Line3();
const rayEnd = new Vector3();

type TCellCache = {
    cell: ICell;
    sectorCoords: Vector2;
    localCoords: Vector2;
};

const cellCache = new Map<string, TCellCache>();

export class GameUtils {

    public static vec3 = {
        zero: new Vector3(),
        right: new Vector3(1, 0, 0),
        up: new Vector3(0, 1, 0),
        forward: new Vector3(0, 0, 1),
        one: new Vector3(1, 1, 1)
    };

    public static rayCaster = new Raycaster();

    public static worldToScreen(worldPos: Vector3, camera: Camera, screenPosOut: Vector3) {
        const { width, height } = engine.screenRect;
        normalizedPos.copy(worldPos).project(camera);
        screenPosOut.x = (normalizedPos.x + 1) / 2 * width;
        screenPosOut.y = -(normalizedPos.y - 1) / 2 * height;
        return screenPosOut;
    }

    public static mapToWorld(mapCoords: Vector2, worldPosOut: Vector3) {
        return worldPosOut.set(mapCoords.x * cellSize + cellOffset, 0, mapCoords.y * cellSize + cellOffset);
    }

    public static worldToMap(worldPos: Vector3, mapCoordsOut: Vector2) {
        mapCoordsOut.set(Math.floor(worldPos.x / cellSize) + halfRes, Math.floor(worldPos.z / cellSize) + halfRes);
        return mapCoordsOut;
    }

    public static clearCellCache() {
        cellCache.clear();
    }
    
    public static getCell(mapCoords: Vector2, sectorCoordsOut?: Vector2, localCoordsOut?: Vector2) {
        const cacheKey = `${mapCoords.x},${mapCoords.y}`;
        const cached = cellCache.get(cacheKey);
        if (cached) {
            sectorCoordsOut?.copy(cached.sectorCoords);
            localCoordsOut?.copy(cached.localCoords);
            return cached.cell;
        }

        const { sectors } = GameMapState.instance;
        const sectorX = Math.floor(mapCoords.x / mapRes);
        const sectorY = Math.floor(mapCoords.y / mapRes);
        sectorCoordsOut?.set(sectorX, sectorY);
        const sector = sectors.get(`${sectorX},${sectorY}`);
        if (!sector) {
            return null;
        }
        const sectorStartX = sectorX * mapRes;
        const sectorStartY = sectorY * mapRes;
        const localX = mapCoords.x - sectorStartX;
        const localY = mapCoords.y - sectorStartY;
        localCoordsOut?.set(localX, localY);

        const cell = sector.cells[localY * mapRes + localX];
        cellCache.set(cacheKey, { 
            cell,
            sectorCoords: new Vector2(sectorX, sectorY), 
            localCoords: new Vector2(localX, localY)
        });
        return cell;
    }

    public static getSector(sectorCoords: Vector2) {
        const sectorId = `${sectorCoords.x},${sectorCoords.y}`;
        return GameMapState.instance.sectors.get(sectorId) ?? null;
    }

    // public static canPlaceRoad(mapCoords: Vector2) {
        // const cell = GameUtils.getCell(mapCoords);
        // if (cell && GameUtils.hasStructure(cell)) {
        //     return false;
        // }
        // const [neighborCoords, neighborCoords2, sideCoord] = GameUtils.pool.vec2;
        // for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        //     neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
        //     const neighbor = GameUtils.getCell(neighborCoords, sectors);
        //     if (neighbor && neighbor.hasContent) {
        //         if (dx === 0) {
        //             // moving vertically
        //             const emptySides = [-1, 1]
        //                 .map(dx2 => {
        //                     sideCoord.set(mapCoords.x + dx2, mapCoords.y);
        //                     return GameUtils.getCell(sideCoord, sectors);
        //                 })
        //                 .filter(c => !c || !c.hasContent) as Cell[];
        //             if (emptySides.length < 2) {
        //                 return false;
        //             }
        //         } else {
        //             // moving horizontally
        //             const emptySides = [-1, 1]
        //                 .map(dy2 => {
        //                     sideCoord.set(mapCoords.x, mapCoords.y + dy2);
        //                     return GameUtils.getCell(sideCoord, sectors);
        //                 })
        //                 .filter(c => !c || !c.hasContent) as Cell[];
        //             if (emptySides.length < 2) {
        //                 return false;
        //             }
        //         }
        //     }
        // }

        // for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        //     neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
        //     const neighbor = GameUtils.getCell(neighborCoords, sectors);
        //     if (neighbor && neighbor.hasContent) {
        //         // check perpendicular neighbors
        //         neighborCoords.set(mapCoords.x + dx, mapCoords.y);
        //         neighborCoords2.set(mapCoords.x, mapCoords.y + dy);
        //         const neighbor1 = GameUtils.getCell(neighborCoords, sectors); 
        //         const neighbor2 = GameUtils.getCell(neighborCoords2, sectors);
        //         if (!neighbor1?.hasContent && !neighbor2?.hasContent) {
        //             return false;
        //         }
        //     }
        // }
        // return true;
    // }
    
    public static screenCastOnPlane(camera: Camera, screenPos: Vector2, yHeight: number, intersectionOut: Vector3) {
        const { width, height } = engine.screenRect;
        normalizedPos2d.set((screenPos.x / width) * 2 - 1, -(screenPos.y / height) * 2 + 1);
        GameUtils.rayCaster.setFromCamera(normalizedPos2d, camera);
        const { ray } = GameUtils.rayCaster;
        const { up } = GameUtils.vec3;
        ground.set(up, -yHeight);        
        rayEnd.copy(ray.origin).addScaledVector(ray.direction, 999);
        line.set(ray.origin, rayEnd);
        return ground.intersectLine(line, intersectionOut) !== null;
    }

    public static getMapHeight(mapCoords: Vector2, localCoords: Vector2, sector: ISector, worldX: number, worldZ: number) {
        const cellWorldX = mapCoords.x * cellSize - halfMapSize;
        const cellWorldZ = mapCoords.y * cellSize - halfMapSize;
        const localX = worldX - cellWorldX;
        const localZ = worldZ - cellWorldZ;
        const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute;
        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
        const height1 = position.getY(startVertexIndex);
        const height2 = position.getY(startVertexIndex + 1);
        const height3 = position.getY(startVertexIndex + verticesPerRow);
        const height4 = position.getY(startVertexIndex + verticesPerRow + 1);
        const xFactor = localX / cellSize;
        const heightA = MathUtils.lerp(height1, height2, xFactor);
        const heightB = MathUtils.lerp(height3, height4, xFactor);
        const height = MathUtils.lerp(heightA, heightB, localZ / cellSize) * elevationStep;
        return height;
    }
}

