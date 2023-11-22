import { Vector2 } from "three";
import { config } from "./config";
import { ICell, ISector } from "./GameTypes";
import * as THREE from "three";
import { Terrain, TerrainUniforms } from "./Terrain";
import { gameMapState } from "./components/GameMapState";

export class Sector {
    public static create(coords: Vector2, visualRoot: THREE.Object3D) {
        const { x, y } = coords;
        const { mapRes, cellSize } = config.game;

        const sectorRoot = new THREE.Object3D();
        sectorRoot.name = `sector-${x},${y}`;
        const mapSize = mapRes * cellSize;
        const offset = -mapSize / 2;
        sectorRoot.position.set(x * mapSize + offset, 0, y * mapSize + offset);
        const cells = [...Array(mapRes * mapRes)].map(() => ({} as ICell));

        // terrain
        const { terrain, cellTextureData, highlightTextureData } = Terrain.createPatch();
        const buildings = new THREE.Object3D();
        buildings.name = "buildings";
        const rails = new THREE.Object3D();
        rails.name = "rails";
        const trains = new THREE.Object3D();
        trains.name = "trains";
        const cars = new THREE.Object3D();
        cars.name = "cars";

        const { sectors } = gameMapState;
        sectors.set(
            `${x},${y}`,
            {
                cells,
                layers: {
                    terrain,
                    buildings,
                    rails,
                    trains,
                    cars
                },
                textureData: {
                    terrain: cellTextureData,
                    highlight: highlightTextureData
                }
            }
        );

        sectorRoot.add(terrain);
        sectorRoot.add(buildings);
        visualRoot.add(sectorRoot);
        visualRoot.add(rails);
        visualRoot.add(trains);
        visualRoot.add(cars);
        return sectorRoot;       
    }

    public static updateCellTexture(sector: ISector, localCoords: Vector2, tileIndex: number) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const tileCount = 32;
        const lastTileIndex = tileCount - 1;
        const tileIndexNormalized = tileIndex / lastTileIndex;
        sector.textureData.terrain.set([tileIndexNormalized * 255], cellIndex);
        const uniforms = ((sector.layers.terrain as THREE.Mesh).material as THREE.Material).userData.shader.uniforms as TerrainUniforms;
        uniforms.cellTexture.value.needsUpdate = true;
    }

    public static updateHighlightTexture(sector: ISector, localCoords: Vector2, color: THREE.Color) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const stride = cellIndex * 4;        
        sector.textureData.highlight.set(color.toArray().map(c => c * 255), stride);
        const uniforms = ((sector.layers.terrain as THREE.Mesh).material as THREE.Material).userData.shader.uniforms as TerrainUniforms;
        uniforms.highlightTexture.value.needsUpdate = true;
    }

    public static isHighlighted(sector: ISector, localCoords: Vector2) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const stride = cellIndex * 4;    
        return sector.textureData.highlight.at(stride + 1)! < 255;    
        // sector.textureData.highlight.set(color.toArray().map(c => c * 255), stride);
        // const uniforms = ((sector.layers.terrain as THREE.Mesh).material as THREE.Material).userData.shader.uniforms as TerrainUniforms;
        // uniforms.highlightTexture.value.needsUpdate = true;
    }
}

