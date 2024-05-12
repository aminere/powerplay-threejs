import { BufferAttribute, BufferGeometry, Mesh, Vector2 } from "three";
import { GameUtils } from "./GameUtils";
import { ISector } from "./GameTypes";
import { config } from "./config/config";
import { GameMapState } from "./components/GameMapState";
import { resources } from "./Resources";

const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();
const cornerCoords = new Vector2();
const leftCoords = new Vector2();
const topCoords = new Vector2();
const bottomCoords = new Vector2();
const rightCoords = new Vector2();

const { mapRes } = config.game;
const verticesPerRow = mapRes + 1;
const { liquidDepths } = config.terrain;

function applyVertexOperations(vertexOperations: Map<ISector, Map<number, number>>) {
    for (const [sector, operations] of vertexOperations) {
        const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute;
        for (const [index, height] of operations) {
            position.setY(index, height);
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
    }
}

class Elevation {

    private _vertexOperations = new Map<ISector, Map<number, number>>();

    public elevate(mapCoords: Vector2, size: number, height: number, relative: boolean) {
        this._vertexOperations.clear();
        for (let i = 0; i < size; ++i) {
            for (let j = 0; j < size; ++j) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {
                    this.elevateCell(sectorCoords, localCoords, height, relative);
                }
            }
        }

        applyVertexOperations(this._vertexOperations);

        // for (let y = mapCoords.y - 1; y < mapCoords.y + size + 1; ++y) {
        //     for (let x = mapCoords.x - 1; x < mapCoords.x + size + 1; ++x) {
        //         cellCoords.set(x, y);
        //         const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
        //         if (cell) {
        //             const sector = GameUtils.getSector(sectorCoords)!;
        //             const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        //             const position = geometry.getAttribute("position") as BufferAttribute;
        //             const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
        //             const height1 = position.getY(startVertexIndex);
        //             const height2 = position.getY(startVertexIndex + 1);
        //             const height3 = position.getY(startVertexIndex + verticesPerRow);
        //             const height4 = position.getY(startVertexIndex + verticesPerRow + 1);
        //             const minHeight = Math.min(height1, height2, height3, height4);
        //             const maxHeight = Math.max(height1, height2, height3, height4);
        //             const dh = maxHeight - minHeight;
        //             cell.isWalkable = dh <= 1;
        //         }
        //     }
        // }
    }

    public createLiquidPatch(mapCoords: Vector2, size: number, type: "water" | "oil") {
        this._vertexOperations.clear();
        for (let i = 0; i < size; ++i) {
            for (let j = 0; j < size; ++j) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {
                    const depth = liquidDepths[type];
                    this.elevateCell(sectorCoords, localCoords, -depth, false);
                }
            }
        }
        applyVertexOperations(this._vertexOperations);

        for (let y = mapCoords.y - 1; y < mapCoords.y + size + 1; ++y) {
            for (let x = mapCoords.x - 1; x < mapCoords.x + size + 1; ++x) {
                cellCoords.set(x, y);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {                    
                    const sector = GameUtils.getSector(sectorCoords)!;
                    resources.create(sector, sectorCoords, localCoords, cell, type);
                }
            }
        }
    }

    public clearLiquidPatch(mapCoords: Vector2, size: number) {
        this._vertexOperations.clear();
        for (let i = 0; i < size; ++i) {
            for (let j = 0; j < size; ++j) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {
                    this.elevateCell(sectorCoords, localCoords, 0, false);
                }
            }
        }
        applyVertexOperations(this._vertexOperations);

        for (let y = mapCoords.y - 1; y < mapCoords.y + size + 1; ++y) {
            for (let x = mapCoords.x - 1; x < mapCoords.x + size + 1; ++x) {
                cellCoords.set(x, y);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {
                    cell.resource = undefined;
                }
            }
        }
    }

    private elevateCell(sectorCoords: Vector2, localCoords: Vector2, height: number, relative: boolean) {
        const { sectors } = GameMapState.instance;
        const sector = GameUtils.getSector(sectorCoords)!;
        const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute;
        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;

        const sectorOperations = this._vertexOperations.get(sector);
        let height1 = height;
        let height2 = height;
        let height3 = height;
        let height4 = height;
        if (relative) {
            height1 = (sectorOperations?.get(startVertexIndex) ?? position.getY(startVertexIndex));
            height2 = (sectorOperations?.get(startVertexIndex + 1) ?? position.getY(startVertexIndex + 1));
            height3 = (sectorOperations?.get(startVertexIndex + verticesPerRow) ?? position.getY(startVertexIndex + verticesPerRow));
            height4 = (sectorOperations?.get(startVertexIndex + verticesPerRow + 1) ?? position.getY(startVertexIndex + verticesPerRow + 1));

            const minHeight = Math.min(height1, height2, height3, height4);
            const maxHeight = Math.max(height1, height2, height3, height4)
            if (height > 0) {
                height1 = Math.max(minHeight + height, height1);
                height2 = Math.max(minHeight + height, height2);
                height3 = Math.max(minHeight + height, height3);
                height4 = Math.max(minHeight + height, height4);
            } else {
                height1 = Math.min(height1, maxHeight + height);
                height2 = Math.min(height2, maxHeight + height);
                height3 = Math.min(height3, maxHeight + height);
                height4 = Math.min(height4, maxHeight + height);
            }
        }

        this.setVertexHeight(sectors, startVertexIndex, sector, height1, sectorCoords, true);
        this.setVertexHeight(sectors, startVertexIndex + 1, sector, height2, sectorCoords, true);
        this.setVertexHeight(sectors, startVertexIndex + verticesPerRow, sector, height3, sectorCoords, true);
        this.setVertexHeight(sectors, startVertexIndex + verticesPerRow + 1, sector, height4, sectorCoords, true);
    }

    private setVertexHeight(
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
                        this.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (leftSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        this.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                    if (topSector) {
                        const index = mapRes * verticesPerRow + 0;
                        this.setVertexHeight(sectors, index, topSector, height, topCoords);
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
                        this.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (leftSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        this.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                    if (bottomSector) {
                        const index = 0 * verticesPerRow + 0;
                        this.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                    }
                } else {
                    // left edge
                    leftCoords.set(sectorCoords.x - 1, sectorCoords.y);
                    const leftSector = sectors.get(`${leftCoords.x},${leftCoords.y}`);
                    if (leftSector) {
                        const index = z * verticesPerRow + mapRes;
                        this.setVertexHeight(sectors, index, leftSector, height, leftCoords);
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
                        this.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (rightSector) {
                        const index = 0 * verticesPerRow + 0;
                        this.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                    if (topSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        this.setVertexHeight(sectors, index, topSector, height, topCoords);
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
                        this.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (rightSector) {
                        const index = mapRes * verticesPerRow + 0;
                        this.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                    if (bottomSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        this.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                    }
                } else {
                    // right edge
                    rightCoords.set(sectorCoords.x + 1, sectorCoords.y);
                    const rightSector = sectors.get(`${rightCoords.x},${rightCoords.y}`);
                    if (rightSector) {
                        const index = z * verticesPerRow + 0;
                        this.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                }
            } else if (z === 0) {
                // top edge
                topCoords.set(sectorCoords.x, sectorCoords.y - 1);
                const topSector = sectors.get(`${topCoords.x},${topCoords.y}`);
                if (topSector) {
                    const index = mapRes * verticesPerRow + x;
                    this.setVertexHeight(sectors, index, topSector, height, topCoords);
                }

            } else if (z === mapRes) {
                // bottom edge
                bottomCoords.set(sectorCoords.x, sectorCoords.y + 1);
                const bottomSector = sectors.get(`${bottomCoords.x},${bottomCoords.y}`);
                if (bottomSector) {
                    const index = 0 * verticesPerRow + x;
                    this.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                }
            }
        }
    }
}

export const elevation = new Elevation();

