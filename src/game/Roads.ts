import { Vector2 } from "three";
import { GameUtils } from "./GameUtils";
import { Axis } from "./GameTypes";
import { Sector } from "./Sector";
import { GameMapState } from "./components/GameMapState";
import { config } from "./config";

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

function setRoadTile(sectorCoords: Vector2, localCoords: Vector2, roadTileIndex: number) {
    const { sectors } = GameMapState.instance;
    const baseRoadTileIndex = 16;
    const tileIndex = baseRoadTileIndex + roadTileIndex;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    return Sector.updateCellTexture(sector, localCoords, tileIndex);
}    

const sectorCoords = new Vector2();
const localCoords = new Vector2();
const mapCoords = new Vector2();
const neighborCoord = new Vector2();
const neighborSectorCoords = new Vector2();
const neighborLocalCoords = new Vector2();
const offset2 = new Vector2();
const start2 = new Vector2();
const { cellsPerRoadBlock} = config.game;

function getRoadTile(mapCoords: Vector2) {
    const getNeighbor = (dx: number, dy: number) => {        
        neighborCoord.set(mapCoords.x + dx * cellsPerRoadBlock, mapCoords.y + dy * cellsPerRoadBlock);
        const neighbor = GameUtils.getCell(neighborCoord, neighborSectorCoords, neighborLocalCoords);
        const hasRoadNeighbor = neighbor?.roadTile !== undefined;
        return {
            cell: hasRoadNeighbor ? neighbor : null,
            coords: neighborCoord.clone(),
            neighborSector: neighborSectorCoords.clone(),
            neighbordLocalCoords: neighborLocalCoords.clone()
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

class Roads {

    public onDrag(start: Vector2, current: Vector2, cellsOut: Vector2[], dragAxis: Axis) {
        const scan = (_start: Vector2, direction: Vector2, iterations: number) => {
            console.assert(iterations >= 0);
            for (let i = 0; i <= iterations; ++i) {
                mapCoords.copy(_start).addScaledVector(direction, i);
                const cell = GameUtils.getCell(mapCoords);
                if (!cell || !cell.isEmpty) {
                    continue;
                }
                cellsOut.push(mapCoords.clone());
                this.create(mapCoords);
            }
        };

        if (dragAxis === "x") {
            const direction = new Vector2(Math.sign(current.x - start.x), 0);
            const iterations = Math.abs(current.x - start.x);
            scan(start, direction, iterations);
            if (current.y !== start.y) {
                offset2.set(0, Math.sign(current.y - start.y));
                start2.copy(start).addScaledVector(direction, iterations).add(offset2);
                scan(start2, offset2, Math.abs(current.y - start.y) - 1);
            }
        } else {
            const direction = new Vector2(0, Math.sign(current.y - start.y));
            const iterations = Math.abs(current.y - start.y);
            scan(start, direction, iterations);
            if (current.x !== start.x) {
                offset2.set(Math.sign(current.x - start.x), 0);
                start2.copy(start).addScaledVector(direction, iterations).add(offset2);
                scan(start2, offset2, Math.abs(current.x - start.x) - 1);
            }
        }
    }    

    public create(mapCoords: Vector2) {
        const cell = GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
        const { tileIndex, neighbors } = getRoadTile(mapCoords);
        const rawTileIndex = setRoadTile(sectorCoords, localCoords, tileIndex);
        cell.roadTile = rawTileIndex;  
        for (const neighbor of neighbors) {
            if (!neighbor.cell) {
                continue;
            }
            const { tileIndex: neighborTileIndex } = getRoadTile(neighbor.coords);
            const rawTileIndex = setRoadTile(neighbor.neighborSector, neighbor.neighbordLocalCoords, neighborTileIndex);
            neighbor.cell.roadTile = rawTileIndex;
        }
    }

    public clear(mapCoords: Vector2) {
        const { sectors } = GameMapState.instance;
        const cell = GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
        cell.roadTile = undefined;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
        Sector.updateCellTexture(sector, localCoords, 0);
        const { neighbors } = getRoadTile(mapCoords);
        for (const neighbor of neighbors) {
            if (neighbor.cell === null) {
                continue;
            }
            const { tileIndex } = getRoadTile(neighbor.coords);
            const rawTile = setRoadTile(neighbor.neighborSector, neighbor.neighbordLocalCoords, tileIndex);            
            neighbor.cell.roadTile = rawTile;
        }
    }    
}

export const roads = new Roads();

