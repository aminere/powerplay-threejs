import { Vector2 } from "three";
import { GameUtils } from "./GameUtils";
import { Axis, ICell } from "./GameTypes";
import { Sector } from "./Sector";
import { pools } from "../engine/Pools";
import { gameMapState } from "./components/GameMapState";

const neighborCombinations: {
    [key: string]: number; // tileIndex
} = {
    "0000": 0,

    "1000": 1, // top
    "0100": 2, // right
    "0010": 3, // bottom
    "0001": 4, // left

    "0011": 5, // bottom and left
    "0110": 6, // right and bottom
    "1100": 7, // top and right
    "1001": 8, // top and left

    "1010": 9, // top and bottom
    "0101": 10, // right and left    

    "0111": 11, // right, bottom, left
    "1110": 12, // top, right, bottom
    "1101": 13, // top, right, left
    "1011": 14, // top, bottom, left

    "1111": 15
};

export class Roads {
    public static onDrag(start: Vector2, current: Vector2, cellsOut: Vector2[], dragAxis: Axis) {
        const currentPos = pools.vec2.getOne();
        const scan = (_start: Vector2, direction: Vector2, iterations: number) => {
            console.assert(iterations >= 0);
            for (let i = 0; i <= iterations; ++i) {
                currentPos.copy(_start).addScaledVector(direction, i);
                const cell = GameUtils.getCell(currentPos);
                if (!cell || !GameUtils.isEmpty(cell)) {
                    continue;
                }
                const cellCoords = currentPos.clone();
                cellsOut.push(cellCoords);
                Roads.create(cellCoords);
            }
        };

        if (dragAxis === "x") {
            const direction = new Vector2(Math.sign(current.x - start.x), 0);
            const iterations = Math.abs(current.x - start.x);
            scan(start, direction, iterations);
            if (current.y !== start.y) {
                const offset2 = new Vector2(0, Math.sign(current.y - start.y));
                const start2 = new Vector2().copy(start)
                    .addScaledVector(direction, iterations)
                    .add(offset2);
                scan(
                    start2,
                    offset2,
                    Math.abs(current.y - start.y) - 1
                );
            }
        } else {
            const direction = new Vector2(0, Math.sign(current.y - start.y));
            const iterations = Math.abs(current.y - start.y);
            scan(start, direction, iterations);
            if (current.x !== start.x) {
                const offset2 = new Vector2(Math.sign(current.x - start.x), 0);
                const start2 = new Vector2().copy(start)
                    .addScaledVector(direction, iterations)
                    .add(offset2);
                scan(
                    start2,
                    offset2,
                    Math.abs(current.x - start.x) - 1
                );
            }
        }
    }

    public static create(mapCoords: Vector2) {
        const [sectorCoords, localCoords] = pools.vec2.get(2);
        const cell = GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
        const { tileIndex, neighbors } = Roads.getRoadTile(mapCoords);
        Roads.setRoadTile(cell, sectorCoords, localCoords, tileIndex);
        for (const neighbor of neighbors) {
            if (neighbor.cell === null) {
                continue;
            }
            const { tileIndex: neighborTileIndex } = Roads.getRoadTile(neighbor.coords);
            Roads.setRoadTile(neighbor.cell, neighbor.neighborSector, neighbor.neighbordLocalCoords, neighborTileIndex);
        }
    }

    public static clear(mapCoords: Vector2) {
        const { sectors } = gameMapState;
        const [sectorCoords, localCoords] = pools.vec2.get(2);
        const cell = GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
        // const previousTile = cell.roadTile!;
        delete cell.roadTile;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
        Sector.updateCellTexture(sector, localCoords, 0);
        // Sector.updateCellTextureRaw(sector, localCoords, previousTile);
        const { neighbors } = Roads.getRoadTile(mapCoords);
        for (const neighbor of neighbors) {
            if (neighbor.cell === null) {
                continue;
            }
            const { tileIndex } = Roads.getRoadTile(neighbor.coords);
            Roads.setRoadTile(neighbor.cell, neighbor.neighborSector, neighbor.neighbordLocalCoords, tileIndex);
        }
    }

    private static setRoadTile(cell: ICell, sectorCoords: Vector2, localCoords: Vector2, roadTileIndex: number) {
        const { sectors } = gameMapState;
        const baseRoadTileIndex = 16;
        const tileIndex = baseRoadTileIndex + roadTileIndex;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
        const previousTile = Sector.updateCellTexture(sector, localCoords, tileIndex);
        cell.roadTile = previousTile;        
    }

    private static getRoadTile(mapCoords: Vector2) {
        const [neighborCoord, neighborSector, neighbordLocalCoords] = pools.vec2.get(3);
        const getNeighbor = (dx: number, dy: number) => {
            neighborCoord.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(neighborCoord, neighborSector, neighbordLocalCoords);
            // const hasNeighbor = neighbor?.hasPreviewContent || neighbor?.hasContent;
            const hasRoadNeighbor = neighbor?.roadTile !== undefined;
            return {
                cell: hasRoadNeighbor ? neighbor : null,
                coords: neighborCoord.clone(),
                neighborSector: neighborSector.clone(),
                neighbordLocalCoords: neighbordLocalCoords.clone()
            }
        };
        const neighbors = [
            getNeighbor(0, -1), // top
            getNeighbor(1, 0), // right
            getNeighbor(0, 1), // bottom
            getNeighbor(-1, 0), // left
        ];
        const mask = neighbors.map(n => n.cell !== null ? "1" : "0").join("");
        const tileIndex = neighborCombinations[mask];
        return { tileIndex, neighbors };
    }
}

