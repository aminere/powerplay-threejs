import { MeshPhongMaterial, Object3D, Vector2, Vector3 } from "three";
import { config } from "./config";
import { ICell, ISector } from "./GameTypes";
import { ITerrainPatch, Terrain, TerrainUniforms } from "./Terrain";
import { gameMapState } from "./components/GameMapState";
import { engine } from "../engine/Engine";
import { MathUtils } from "three/src/math/MathUtils.js";
import { GameUtils } from "./GameUtils";
import { utils } from "../engine/Utils";
import { meshes } from "../engine/Meshes";
import { textures } from "../engine/Textures";

const { elevationStep } = config.game;

export class Sector {
    public static create(props: ITerrainPatch) {
        console.log(`creating sector ${props.sectorX},${props.sectorY}`);
        const { sectorX: x, sectorY: y } = props;
        const { mapRes, cellSize } = config.game;

        const sectorRoot = new Object3D();
        sectorRoot.name = `sector-${x},${y}`;
        const mapSize = mapRes * cellSize;
        const offset = -mapSize / 2;
        sectorRoot.position.set(x * mapSize + offset, 0, y * mapSize + offset);

        const grid = [...Array(mapRes * mapRes)];
        const cells = grid.map(() => {
            const cell: ICell = {
                flowField: [],
                isEmpty: true,
                flowFieldCost: 1
            };
            return cell;
        })

        // terrain
        const { terrain, cellTextureData, highlightTextureData } = Terrain.createPatch(props);
        const buildings = utils.createObject(sectorRoot, "buildings");
        const resources = utils.createObject(sectorRoot, "resources");
        const envProps = utils.createObject(sectorRoot, "props");        

        const { sectors } = gameMapState;
        const sector: ISector = {
            cells,
            root: sectorRoot,
            layers: {
                terrain,
                buildings,
                resources,
                props: envProps
            },
            textureData: {
                terrain: cellTextureData,
                highlight: highlightTextureData
            },
        };
        sectors.set(`${x},${y}`, sector);
        sectorRoot.add(terrain);
        engine.scene!.add(sectorRoot);

        const stones = [
            // "diamond",
            // "round",
            // "flat",
            // "pointy",
            "oval",
            "small",
            // "diamond",
        ];
        
        const atlas = textures.load(`/models/atlas-albedo-LPUP.png`);

        Promise.all([            
            meshes.load(`/models/props/grass-clumb.fbx`),
            meshes.load(`/models/props/rocks-small_brown.fbx`),
            meshes.load(`/models/props/cactus-medium.fbx`),
            ...stones.map(s => meshes.load(`/models/props/stone-${s}_brown.fbx`))
        ])
            .then(stoneMeshes => {
                const stoneLib = stoneMeshes.map(m => m[0]);
                const plantCellSize = cellSize * 8;
                const plantMapRes = Math.floor(mapRes * cellSize / plantCellSize);
                const plantMapSize = plantMapRes * plantCellSize;
                const worldPos = new Vector3();
                const mapCoords = new Vector2();
                const localCoords = new Vector2();
                const verticesPerRow = mapRes + 1;
                const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
                for (let i = 0; i < plantMapRes; ++i) {
                    for (let j = 0; j < plantMapRes; ++j) {
                        const localX = MathUtils.randFloat(0, plantCellSize);
                        const localY = MathUtils.randFloat(0, plantCellSize);
                        const plantSectorX = props.sectorX * plantMapSize;
                        const plantSectorY = props.sectorY * plantMapSize;
                        const plantWorldX = plantSectorX + i * plantCellSize + offset + localX;
                        const plantWorldY = plantSectorY + j * plantCellSize + offset + localY;
                        worldPos.set(plantWorldX, 0, plantWorldY);
                        GameUtils.worldToMap(worldPos, mapCoords);
                        const cell = GameUtils.getCell(mapCoords, undefined, localCoords);
                        if (!cell) {
                            continue;
                        }
                        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
                        const _height1 = position.getY(startVertexIndex);
                        const _height2 = position.getY(startVertexIndex + 1);
                        const _height3 = position.getY(startVertexIndex + verticesPerRow);
                        const _height4 = position.getY(startVertexIndex + verticesPerRow + 1);
                        const _maxHeight = Math.max(_height1, _height2, _height3, _height4);
                        const _minHeight = Math.min(_height1, _height2, _height3, _height4);
                        if (_minHeight === _maxHeight && _minHeight >= 0 && _minHeight <= 1) { 
                            const stoneIndex = MathUtils.randInt(0, stoneLib.length - 1);                   
                            const meshInstance = stoneLib[stoneIndex].clone();
                            const material = meshInstance.material as MeshPhongMaterial;
                            material.map = atlas;
                            meshInstance.castShadow = true;
                            const factor = Math.random();
                            const minScale = 0.002;
                            const maxScale = 0.007;
                            meshInstance.scale.setScalar(minScale + (maxScale - minScale) * factor);
                            meshInstance.rotateY(MathUtils.randFloat(0, Math.PI * 2));
                            meshInstance.position.set(
                                worldPos.x - sectorRoot.position.x,
                                _minHeight * elevationStep,
                                worldPos.z - sectorRoot.position.z
                            );                            
                            envProps.add(meshInstance);
                        }
                    }
                }

            });
            
        return sector;
    }

    public static updateCellTexture(sector: ISector, localCoords: Vector2, tileIndex: number) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const { atlasTileCount } = config.terrain;
        const tileCount = atlasTileCount;
        const lastTileIndex = tileCount - 1;
        const tileIndexNormalized = tileIndex / lastTileIndex;
        const previousTile = sector.textureData.terrain.at(cellIndex);
        sector.textureData.terrain.set([tileIndexNormalized * 255], cellIndex);        
        const uniforms = ((sector.layers.terrain as THREE.Mesh).material as THREE.Material).userData.shader.uniforms as TerrainUniforms;
        uniforms.cellTexture.value.needsUpdate = true;
        return previousTile;
    }

    public static updateCellTextureRaw(sector: ISector, localCoords: Vector2, rawTile: number) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        sector.textureData.terrain.set([rawTile], cellIndex);
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

