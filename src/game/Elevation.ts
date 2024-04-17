import { BufferAttribute, BufferGeometry, Mesh, Vector2 } from "three";
import { GameUtils } from "./GameUtils";
import { ISector } from "./GameTypes";
import { config } from "./config";
import { GameMapState } from "./components/GameMapState";

const cellCoords = new Vector2();
const neighborCoords = new Vector2();
const neighborSectorCoords = new Vector2();
const neighborLocalCoords = new Vector2();
const cornerCoords = new Vector2();
const leftCoords = new Vector2();
const topCoords = new Vector2();
const bottomCoords = new Vector2();
const rightCoords = new Vector2();

export class Elevation {

    private static _elevatedCells = new Map<ISector, Set<number>>();
    public static elevate(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, size: Vector2, height: number, relative: boolean) {
        Elevation._elevatedCells.clear();
        for (let i = 0; i < size.y; ++i) {
            for (let j = 0; j < size.x; ++j) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {
                    Elevation.elevateCell(cellCoords, sectorCoords, localCoords, height, relative);
                }
            }
        }
    }

    private static elevateCell(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, height: number, relative: boolean) {
        const { sectors } = GameMapState.instance;
        const { mapRes } = config.game;
        const verticesPerRow = mapRes + 1;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
        const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute;
        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;       

        let height1 = height;
        let height2 = height;
        let height3 = height;
        let height4 = height;
        if (relative) {
            height1 = position.getY(startVertexIndex) + height;
            height2 = position.getY(startVertexIndex + 1) + height;
            height3 = position.getY(startVertexIndex + verticesPerRow) + height;
            height4 = position.getY(startVertexIndex + verticesPerRow + 1) + height;
        }

        this._vertexOperations.clear();
        Elevation.setVertexHeight(sectors, startVertexIndex, sector, height1, sectorCoords, true);
        Elevation.setVertexHeight(sectors, startVertexIndex + 1, sector, height2, sectorCoords, true);
        Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow, sector, height3, sectorCoords, true);
        Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow + 1, sector, height4, sectorCoords, true);
        for (const dy of [-1, 0, 1]) {
            for (const dx of [-1, 0, 1]) {
                neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
                const neighborCell = GameUtils.getCell(neighborCoords, neighborSectorCoords, neighborLocalCoords);
                if (neighborCell) {
                    const neighborSector = sectors.get(`${neighborSectorCoords.x},${neighborSectorCoords.y}`)!;
                    this.trackElevatedCell(neighborSector, neighborLocalCoords.y * mapRes + neighborLocalCoords.x);
                }
            }
        }

        // apply vertex operations
        for (const [sector, operations] of this._vertexOperations) {
            const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
            const position = geometry.getAttribute("position") as BufferAttribute;
            for (const [index, height] of operations) {
                position.setY(index, height);
            }
            position.needsUpdate = true;
            geometry.computeVertexNormals();
        }
    }

    private static _vertexOperations = new Map<ISector, Map<number, number>>();
    private static trackElevatedCell(sector: ISector, cellIndex: number) {
        if (Elevation._elevatedCells.has(sector)) {
            Elevation._elevatedCells.get(sector)!.add(cellIndex);
        } else {
            Elevation._elevatedCells.set(sector, new Set([cellIndex]));
        }
    };

    private static setVertexHeight(
        sectors: Map<string, ISector>, 
        index: number, 
        sector: ISector, 
        height: number, 
        sectorCoords: Vector2, 
        checkNeighbors = false
    ) {
        const { mapRes } = config.game;
        const verticesPerRow = mapRes + 1;
        const x = index % verticesPerRow;
        const z = Math.floor(index / verticesPerRow);        

        const sectorOperations = this._vertexOperations.get(sector);
        if (sectorOperations) {
            sectorOperations.set(index, height);
        } else {
            this._vertexOperations.set(sector, new Map([[index, height]]));
        }

        if (checkNeighbors) {
            // elevate vertices of neighboring sectors
            if (x === 0) {
                if (z === 0) {
                    // top left corner
                    cornerCoords.set(sectorCoords.x - 1, sectorCoords.y - 1);
                    leftCoords.set(sectorCoords.x - 1, sectorCoords.y);
                    topCoords.set(sectorCoords.x, sectorCoords.y - 1);
                    const cornerSector = sectors.get(`${cornerCoords.x},${cornerCoords.y}`);
                    const leftSector = sectors.get(`${leftCoords.x},${leftCoords.y}`);
                    const topSector = sectors.get(`${topCoords.x},${topCoords.y}`);
                    if (cornerSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (leftSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                    if (topSector) {
                        const index = mapRes * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, topSector, height, topCoords);
                    }

                } else if (z === mapRes) {
                    // bottom left corner
                    cornerCoords.set(sectorCoords.x - 1, sectorCoords.y + 1);
                    leftCoords.set(sectorCoords.x - 1, sectorCoords.y);
                    bottomCoords.set(sectorCoords.x, sectorCoords.y + 1);
                    const cornerSector = sectors.get(`${cornerCoords.x},${cornerCoords.y}`);
                    const leftSector = sectors.get(`${leftCoords.x},${leftCoords.y}`);
                    const bottomSector = sectors.get(`${bottomCoords.x},${bottomCoords.y}`);
                    if (cornerSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (leftSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                    if (bottomSector) {
                        const index = 0 * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                    }
                } else {
                    // left edge
                    leftCoords.set(sectorCoords.x - 1, sectorCoords.y);
                    const leftSector = sectors.get(`${leftCoords.x},${leftCoords.y}`);
                    if (leftSector) {
                        const index = z * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                }
            } else if (x === mapRes) {
                if (z === 0) {
                    // top right corner
                    cornerCoords.set(sectorCoords.x + 1, sectorCoords.y - 1);
                    rightCoords.set(sectorCoords.x + 1, sectorCoords.y);
                    topCoords.set(sectorCoords.x, sectorCoords.y - 1);
                    const cornerSector = sectors.get(`${cornerCoords.x},${cornerCoords.y}`);
                    const rightSector = sectors.get(`${rightCoords.x},${rightCoords.y}`);
                    const topSector = sectors.get(`${topCoords.x},${topCoords.y}`);
                    if (cornerSector) {
                        const index = mapRes * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (rightSector) {
                        const index = 0 * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                    if (topSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, topSector, height, topCoords);
                    }
                } else if (z === mapRes) {
                    // bottom right corner
                    cornerCoords.set(sectorCoords.x + 1, sectorCoords.y + 1);
                    rightCoords.set(sectorCoords.x + 1, sectorCoords.y);
                    bottomCoords.set(sectorCoords.x, sectorCoords.y + 1);
                    const cornerSector = sectors.get(`${cornerCoords.x},${cornerCoords.y}`);
                    const rightSector = sectors.get(`${rightCoords.x},${rightCoords.y}`);
                    const bottomSector = sectors.get(`${bottomCoords.x},${bottomCoords.y}`);
                    if (cornerSector) {
                        const index = 0 * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (rightSector) {
                        const index = mapRes * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                    if (bottomSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        Elevation.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                    }
                } else {
                    // right edge
                    rightCoords.set(sectorCoords.x + 1, sectorCoords.y);
                    const rightSector = sectors.get(`${rightCoords.x},${rightCoords.y}`);
                    if (rightSector) {
                        const index = z * verticesPerRow + 0;
                        Elevation.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                }
            } else if (z === 0) {
                // top edge
                topCoords.set(sectorCoords.x, sectorCoords.y - 1);
                const topSector = sectors.get(`${topCoords.x},${topCoords.y}`);
                if (topSector) {
                    const index = mapRes * verticesPerRow + x;
                    Elevation.setVertexHeight(sectors, index, topSector, height, topCoords);
                }

            } else if (z === mapRes) {
                // bottom edge
                bottomCoords.set(sectorCoords.x, sectorCoords.y + 1);
                const bottomSector = sectors.get(`${bottomCoords.x},${bottomCoords.y}`);
                if (bottomSector) {
                    const index = 0 * verticesPerRow + x;
                    Elevation.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                }
            }
        }
    }
}

