import { Camera, Vector2 } from "three";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { engine } from "../../engine/Engine";
import { gameMapState } from "./GameMapState";
import { Elevation } from "../Elevation";

export function pickSectorTriangle(sectorX: number, sectorY: number, camera: Camera) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorX},${sectorY}`);
    let selectedVertexIndex = -1;
    if (sector) {        
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
        const { elevationStep } = config.game;            
        const { cellSize, mapRes } = config.game;
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
    }
    return selectedVertexIndex;
}

export function raycastOnCells(screenPos: Vector2, camera: Camera) {
    const intersection = pools.vec3.getOne();
    if (!GameUtils.screenCastOnPlane(camera, screenPos, 0, intersection)) {
        return;
    }
    const [cellCoords, sectorCoords] = pools.vec2.get(2);
    GameUtils.worldToMap(intersection, cellCoords);
    const cell = GameUtils.getCell(cellCoords, sectorCoords);
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
        const { mapRes } = config.game;
        const halfRes = mapRes / 2;
        neighborSectors.sort((a, b) => {
            const aCenterX = a[0] * mapRes + halfRes;
            const aCenterY = a[1] * mapRes + halfRes;
            const cellToSectorDistA = Math.abs(aCenterX - cellCoords.x) + Math.abs(aCenterY - cellCoords.y);
            const bCenterX = b[0] * mapRes + halfRes;
            const bCenterY = b[1] * mapRes + halfRes;
            const cellToSectorDistB = Math.abs(bCenterX - cellCoords.x) + Math.abs(bCenterY - cellCoords.y);
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

    const { mapRes } = config.game;
    if (selectedVertexIndex >= 0) {
        const selectedCell = Math.floor(selectedVertexIndex / 6);
        cellCoords.set(
            sectorX * mapRes + selectedCell % mapRes,
            sectorY * mapRes + Math.floor(selectedCell / mapRes)
        );
    }

    return cellCoords;
}

export function onBeginDrag(from: Vector2, to: Vector2) { // map coords
    console.log("onBeginDrag", from, to);
}

export function onDrag(from: Vector2, to: Vector2) { // map coords
    console.log("onDrag", from, to);
}

export function onEndDrag(from: Vector2, to: Vector2) { // map coords
    console.log("onEndDrag", from, to);
}

export function onCancelDrag() {
    console.log("onCancelDrag");
}

export function onElevation(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, radius: number, button: number) {
    if (button === 0) {
        Elevation.elevate(mapCoords, sectorCoords, localCoords, 1, radius);
    } else if (button === 2) {
        Elevation.elevate(mapCoords, sectorCoords, localCoords, -1, radius);
    }
}

