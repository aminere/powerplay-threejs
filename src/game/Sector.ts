import { Color, Material, Mesh, Object3D, Vector2 } from "three";
import { config } from "./config";
import { ISector } from "./GameTypes";
import { ITerrainPatch, Terrain, TerrainUniforms } from "./Terrain";
import { utils } from "../engine/Utils";
import { FlowfieldViewer } from "./pathfinding/FlowfieldViewer";
import { Cell } from "./Cell";
import { GameMapState } from "./components/GameMapState";

export class Sector {
    public static create(props: ITerrainPatch) {
        // console.log(`creating sector ${props.sectorX},${props.sectorY}`);
        const { sectorX: x, sectorY: y } = props;
        const { mapRes, cellSize } = config.game;

        const sectorRoot = new Object3D();
        sectorRoot.matrixAutoUpdate = false;
        sectorRoot.matrixWorldAutoUpdate = false;
        sectorRoot.name = `sector-${x},${y}`;
        const mapSize = mapRes * cellSize;
        const offset = -mapSize / 2;
        sectorRoot.position.set(x * mapSize + offset, 0, y * mapSize + offset);
        sectorRoot.updateMatrix();

        const grid = [...Array(mapRes * mapRes)];
        const cells = grid.map((_, i) => new Cell(`${x}${y}${i}`));

        // terrain
        const { terrain, cellTextureData, highlightTextureData } = Terrain.createPatch(props);
        const resources = utils.createObject(sectorRoot, "resources");
        const envProps = utils.createObject(sectorRoot, "props");

        const flowfield = new FlowfieldViewer();
        const { sectors } = GameMapState.instance;
        const sector: ISector = {
            cells,
            root: sectorRoot,
            layers: {
                terrain,
                resources,
                props: envProps
            },
            textureData: {
                terrain: cellTextureData,
                highlight: highlightTextureData
            },
            flowfieldViewer: flowfield
        };
        sectors.set(`${x},${y}`, sector);
        sectorRoot.add(terrain);
        sectorRoot.add(flowfield);
        return sector;
    }

    public static updateCellTexture(sector: ISector, localCoords: Vector2, tileIndex: number) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const { atlasTileCount } = config.terrain;
        const tileCount = atlasTileCount;
        const lastTileIndex = tileCount - 1;
        const tileIndexNormalized = tileIndex / lastTileIndex;
        const rawTileIndex = Math.round(tileIndexNormalized * 255);
        sector.textureData.terrain.set([rawTileIndex], cellIndex);        
        const uniforms = ((sector.layers.terrain as Mesh).material as Material).userData.shader.uniforms as TerrainUniforms;
        uniforms.cellTexture.value.needsUpdate = true;
        return rawTileIndex;
    }

    public static updateCellTextureRaw(sector: ISector, localCoords: Vector2, rawTile: number) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        sector.textureData.terrain.set([rawTile], cellIndex);
        const uniforms = ((sector.layers.terrain as Mesh).material as Material).userData.shader.uniforms as TerrainUniforms;
        uniforms.cellTexture.value.needsUpdate = true;
    }

    public static updateHighlightTexture(sector: ISector, localCoords: Vector2, color: Color) {
        const { mapRes } = config.game;
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const stride = cellIndex * 4;        
        sector.textureData.highlight.set(color.toArray().map(c => c * 255), stride);
        const uniforms = ((sector.layers.terrain as Mesh).material as Material).userData.shader.uniforms as TerrainUniforms;
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

