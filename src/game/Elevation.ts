import { Vector2 } from "three";
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
    public static elevate(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, direction: number, size: Vector2) {
        Elevation._elevatedCells.clear();
        for (let i = 0; i < size.y; ++i) {
            for (let j = 0; j < size.x; ++j) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords, sectorCoords, localCoords);
                if (cell) {
                    Elevation.elevateCell(cellCoords, sectorCoords, localCoords, direction);
                }
            }
        }        

        // fit building geometry to elevation
        // const { mapRes, elevationStep, cellSize } = config.game;
        // const floorStep = cellSize;
        // const verticesPerRow = mapRes + 1;
        // const buildings = gameMapState.instance!.buildings;
        // for (const [sector, cells] of Elevation._elevatedCells) {
        //     for (const cellIndex of cells) {
        //         const buildingId = sector.cells[cellIndex].buildingId;
        //         if (!buildingId) {
        //             continue;
        //         }
        //         const building = buildings.get(buildingId)!;
        //         const buildingGeometry = (building.obj as THREE.Mesh).geometry as THREE.BufferGeometry;
        //         const vertices = buildingGeometry.getAttribute("position") as THREE.BufferAttribute;
        //         const cellY = Math.floor(cellIndex / mapRes);
        //         const cellX = cellIndex - cellY * mapRes;
        //         const startVertexIndex = cellY * verticesPerRow + cellX;

        //         const sectorGeometry = (sector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
        //         const sectorVertices = sectorGeometry.getAttribute("position") as THREE.BufferAttribute;
        //         const height0 = sectorVertices.getY(startVertexIndex) * elevationStep;
        //         const height1 = sectorVertices.getY(startVertexIndex + 1) * elevationStep;
        //         const height2 = sectorVertices.getY(startVertexIndex + verticesPerRow) * elevationStep;
        //         const height3 = sectorVertices.getY(startVertexIndex + verticesPerRow + 1) * elevationStep;
        //         const roof = Math.max(height0, height1, height2, height3);

        //         vertices.setY(0, roof + floorStep);
        //         vertices.setY(1, roof + floorStep);
        //         vertices.setY(2, height3);
        //         vertices.setY(3, height2);

        //         vertices.setY(4, roof + floorStep);
        //         vertices.setY(5, roof + floorStep);
        //         vertices.setY(6, height1);
        //         vertices.setY(7, height3);

        //         vertices.setY(8, roof + floorStep);
        //         vertices.setY(9, roof + floorStep);
        //         vertices.setY(10, height0);
        //         vertices.setY(11, height1);

        //         vertices.setY(12, roof + floorStep);
        //         vertices.setY(13, roof + floorStep);
        //         vertices.setY(14, height2);
        //         vertices.setY(15, height0);

        //         vertices.setY(16, roof + floorStep);
        //         vertices.setY(17, roof + floorStep);
        //         vertices.setY(18, roof + floorStep);
        //         vertices.setY(19, roof + floorStep);

        //         vertices.setY(20, height2 + .01);
        //         vertices.setY(21, height3 + .01);
        //         vertices.setY(22, height1 + .01);
        //         vertices.setY(23, height0 + .01);

        //         vertices.needsUpdate = true;
        //         buildingGeometry.computeVertexNormals();
        //     }
        // }
    }

    private static elevateCell(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, direction: number) {
        const { sectors } = GameMapState.instance;
        const { mapRes } = config.game;
        const verticesPerRow = mapRes + 1;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
        const geometry = (sector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
        const [minHeight, _, __, maxHeight] = [
            position.getY(startVertexIndex),
            position.getY(startVertexIndex + 1),
            position.getY(startVertexIndex + verticesPerRow),
            position.getY(startVertexIndex + verticesPerRow + 1)
        ].sort((a, b) => a - b);
        // const height = direction > 0 ? minHeight + 1 : maxHeight - 1;
        const height = (() => {
            if (direction > 0) {
                if (minHeight < maxHeight) {
                    return maxHeight;
                } else {
                    return maxHeight + 1;
                }
            } else {
                if (maxHeight > minHeight) {
                    return minHeight;
                } else {
                    return minHeight - 1;                
                }
            }
        })();

        this._vertexOperations.clear();
        let allowed = true;
        allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex, sector, height, sectorCoords, true);
        allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + 1, sector, height, sectorCoords, true);
        allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow, sector, height, sectorCoords, true);
        allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow + 1, sector, height, sectorCoords, true);
        if (allowed) {
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
        } else {
            // TODO feedback
            return;
        }

        // keep neighbor elevation one step away
        // let radius = 1;
        // const [neighborCoords2, neighborSectorCoords2, neighborLocalCoords2] = pools.vec2.get(3);
        // while (true) {
        //     const startY = mapCoords.y - radius;
        //     const startX = mapCoords.x - radius;
        //     const endY = mapCoords.y + radius;
        //     const endX = mapCoords.x + radius;
        //     let elevatedNeighbors = 0;
        //     for (let y = startY; y <= endY; ++y) {
        //         for (let x = startX; x <= endX; ++x) {
        //             if (y > startY && y < endY) {
        //                 if (x !== startX && x !== endX) {
        //                     continue;
        //                 }
        //             }
        //             // check neighbor                    
        //             neighborCoords.set(x, y);
        //             const neighborCell = GameUtils.getCell(neighborCoords, neighborSectorCoords, neighborLocalCoords);
        //             if (neighborCell) {
        //                 const neighborSector = sectors.get(`${neighborSectorCoords.x},${neighborSectorCoords.y}`)!;
        //                 const geometry = (neighborSector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
        //                 const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        //                 const startVertexIndex = neighborLocalCoords.y * verticesPerRow + neighborLocalCoords.x;

        //                 const height0 = this._vertexOperations.get(neighborSector)?.get(startVertexIndex) ?? position.getY(startVertexIndex);
        //                 const height1 = this._vertexOperations.get(neighborSector)?.get(startVertexIndex + 1) ?? position.getY(startVertexIndex + 1);
        //                 const height2 = this._vertexOperations.get(neighborSector)?.get(startVertexIndex + verticesPerRow) ?? position.getY(startVertexIndex + verticesPerRow);
        //                 const height3 = this._vertexOperations.get(neighborSector)?.get(startVertexIndex + verticesPerRow + 1) ?? position.getY(startVertexIndex + verticesPerRow + 1);

        //                 const minHeight = Math.min(height0, height1, height2, height3);
        //                 const maxHeight = Math.max(height0, height1, height2, height3);
        //                 if (maxHeight - minHeight > 1) {
        //                     if (direction > 0) {
        //                         const height = minHeight + 1;
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex, neighborSector, Math.max(height0, height), neighborSectorCoords, true);
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + 1, neighborSector, Math.max(height1, height), neighborSectorCoords, true);
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow, neighborSector, Math.max(height2, height), neighborSectorCoords, true);
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow + 1, neighborSector, Math.max(height3, height), neighborSectorCoords, true);
        //                         if (allowed) {
        //                             for (const dy of [-1, 0, 1]) {
        //                                 for (const dx of [-1, 0, 1]) {
        //                                     neighborCoords2.set(neighborCoords.x + dx, neighborCoords.y + dy);
        //                                     const neighborCell2 = GameUtils.getCell(neighborCoords2, neighborSectorCoords2, neighborLocalCoords2);
        //                                     if (neighborCell2) {
        //                                         const neighborSector2 = sectors.get(`${neighborSectorCoords2.x},${neighborSectorCoords2.y}`)!;
        //                                         this.trackElevatedCell(neighborSector2, neighborLocalCoords2.y * mapRes + neighborLocalCoords2.x);
        //                                     }
        //                                 }
        //                             }
        //                         }
        //                     } else {
        //                         const height = maxHeight - 1;
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex, neighborSector, Math.min(height0, height), neighborSectorCoords, true);
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + 1, neighborSector, Math.min(height1, height), neighborSectorCoords, true);
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow, neighborSector, Math.min(height2, height), neighborSectorCoords, true);
        //                         allowed = allowed && Elevation.setVertexHeight(sectors, startVertexIndex + verticesPerRow + 1, neighborSector, Math.min(height3, height), neighborSectorCoords, true);
        //                         if (allowed) {
        //                             for (const dy of [-1, 0, 1]) {
        //                                 for (const dx of [-1, 0, 1]) {
        //                                     neighborCoords2.set(neighborCoords.x + dx, neighborCoords.y + dy);
        //                                     const neighborCell2 = GameUtils.getCell(neighborCoords2, neighborSectorCoords2, neighborLocalCoords2);
        //                                     if (neighborCell2) {
        //                                         const neighborSector2 = sectors.get(`${neighborSectorCoords2.x},${neighborSectorCoords2.y}`)!;
        //                                         this.trackElevatedCell(neighborSector2, neighborLocalCoords2.y * mapRes + neighborLocalCoords2.x);
        //                                     }
        //                                 }
        //                             }
        //                         }
        //                     }
        //                     ++elevatedNeighbors;
        //                 }
        //             }
        //         }
        //     }
        //     if (elevatedNeighbors === 0 || !allowed) {
        //         break;
        //     } else {
        //         ++radius;
        //     }
        // }

        if (!allowed) {
            // TODO feedback
            return;
        }

        // apply vertex operations
        for (const [sector, operations] of this._vertexOperations) {
            const geometry = (sector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
            const position = geometry.getAttribute("position") as THREE.BufferAttribute;
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
    ): boolean {

        const { mapRes } = config.game;
        const verticesPerRow = mapRes + 1;
        const x = index % verticesPerRow;
        const z = Math.floor(index / verticesPerRow);

        // do not allow elevating edge vertices
        // if (height !== 0) {
        //     if (x === 0) {
        //         if (z === 0) {
        //             // top left corner
        //             const cornerSector = sectors.get(`${sectorCoords.x - 1},${sectorCoords.y - 1}`);
        //             const leftSector = sectors.get(`${sectorCoords.x - 1},${sectorCoords.y}`);
        //             const topSector = sectors.get(`${sectorCoords.x},${sectorCoords.y - 1}`);
        //             if (!cornerSector || !leftSector || !topSector) {
        //                 return false;
        //             }
        //         } else if (z === mapRes) {
        //             // bottom left corner
        //             const cornerSector = sectors.get(`${sectorCoords.x - 1},${sectorCoords.y + 1}`);
        //             const leftSector = sectors.get(`${sectorCoords.x - 1},${sectorCoords.y}`);
        //             const bottomSector = sectors.get(`${sectorCoords.x},${sectorCoords.y + 1}`);
        //             if (!cornerSector || !leftSector || !bottomSector) {
        //                 return false;
        //             }
        //         } else {
        //             // left edge
        //             const leftSector = sectors.get(`${sectorCoords.x - 1},${sectorCoords.y}`);
        //             if (!leftSector) {
        //                 return false;
        //             }
        //         }
        //     } else if (x === mapRes) {
        //         if (z === 0) {
        //             // top right corner
        //             const cornerSector = sectors.get(`${sectorCoords.x + 1},${sectorCoords.y - 1}`);
        //             const rightSector = sectors.get(`${sectorCoords.x + 1},${sectorCoords.y}`);
        //             const topSector = sectors.get(`${sectorCoords.x},${sectorCoords.y - 1}`);
        //             if (!cornerSector || !rightSector || !topSector) {
        //                 return false;
        //             }
        //         } else if (z === mapRes) {
        //             // bottom right corner
        //             const cornerSector = sectors.get(`${sectorCoords.x + 1},${sectorCoords.y + 1}`);
        //             const rightSector = sectors.get(`${sectorCoords.x + 1},${sectorCoords.y}`);
        //             const bottomSector = sectors.get(`${sectorCoords.x},${sectorCoords.y + 1}`);
        //             if (!cornerSector || !rightSector || !bottomSector) {
        //                 return false;
        //             }
        //         } else {
        //             // right edge
        //             const rightSector = sectors.get(`${sectorCoords.x + 1},${sectorCoords.y}`);
        //             if (!rightSector) {
        //                 return false;
        //             }
        //         }
        //     } else if (z === 0) {
        //         // top edge
        //         const topSector = sectors.get(`${sectorCoords.x},${sectorCoords.y - 1}`);
        //         if (!topSector) {
        //             return false;
        //         }

        //     } else if (z === mapRes) {
        //         // bottom edge
        //         const bottomSector = sectors.get(`${sectorCoords.x},${sectorCoords.y + 1}`);
        //         if (!bottomSector) {
        //             return false;
        //         }
        //     }
        // }

        const sectorOperations = this._vertexOperations.get(sector);
        if (sectorOperations) {
            sectorOperations.set(index, height);
        } else {
            this._vertexOperations.set(sector, new Map([[index, height]]));
        }

        let allowed = true;
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
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (leftSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                    if (topSector) {
                        const index = mapRes * verticesPerRow + 0;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, topSector, height, topCoords);
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
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (leftSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, leftSector, height, leftCoords);
                    }
                    if (bottomSector) {
                        const index = 0 * verticesPerRow + 0;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                    }
                } else {
                    // left edge
                    leftCoords.set(sectorCoords.x - 1, sectorCoords.y);
                    const leftSector = sectors.get(`${leftCoords.x},${leftCoords.y}`);
                    if (leftSector) {
                        const index = z * verticesPerRow + mapRes;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, leftSector, height, leftCoords);
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
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (rightSector) {
                        const index = 0 * verticesPerRow + 0;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                    if (topSector) {
                        const index = mapRes * verticesPerRow + mapRes;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, topSector, height, topCoords);
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
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, cornerSector, height, cornerCoords);
                    }
                    if (rightSector) {
                        const index = mapRes * verticesPerRow + 0;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                    if (bottomSector) {
                        const index = 0 * verticesPerRow + mapRes;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                    }
                } else {
                    // right edge
                    rightCoords.set(sectorCoords.x + 1, sectorCoords.y);
                    const rightSector = sectors.get(`${rightCoords.x},${rightCoords.y}`);
                    if (rightSector) {
                        const index = z * verticesPerRow + 0;
                        allowed = allowed && Elevation.setVertexHeight(sectors, index, rightSector, height, rightCoords);
                    }
                }
            } else if (z === 0) {
                // top edge
                topCoords.set(sectorCoords.x, sectorCoords.y - 1);
                const topSector = sectors.get(`${topCoords.x},${topCoords.y}`);
                if (topSector) {
                    const index = mapRes * verticesPerRow + x;
                    allowed = allowed && Elevation.setVertexHeight(sectors, index, topSector, height, topCoords);
                }

            } else if (z === mapRes) {
                // bottom edge
                bottomCoords.set(sectorCoords.x, sectorCoords.y + 1);
                const bottomSector = sectors.get(`${bottomCoords.x},${bottomCoords.y}`);
                if (bottomSector) {
                    const index = 0 * verticesPerRow + x;
                    allowed = allowed && Elevation.setVertexHeight(sectors, index, bottomSector, height, bottomCoords);
                }
            }
        }

        return allowed;
    }
}

