
import { Mesh, MeshBasicMaterial, Object3D, BufferGeometry, BufferAttribute, NearestFilter, Vector2 } from "three";
import { config } from "./config";
import { GameUtils } from "./GameUtils";
import { pools } from "../engine/core/Pools";
import { gameMapState } from "./components/GameMapState";
import { textures } from "../engine/resources/Textures";

export class TileSector extends Object3D {

    public get size() { return this._size; }

    private _size = 2;
    constructor() {
        super();

        const { cellSize } = config.game;
        const yOffset = 0.01;

        const texture = textures.load('images/tile-selected.png');
        texture.magFilter = NearestFilter;
        texture.minFilter = NearestFilter;
        const material = new MeshBasicMaterial({ 
            color: 0xffff00,
            map: texture,
            transparent: true,
            depthTest: false,
        });

        const createMesh = (x: number, y: number) => {
            const geometry = new BufferGeometry()
                .setAttribute('position', new BufferAttribute(new Float32Array([
                    0, 0, 0,
                    cellSize, 0, 0,
                    cellSize, 0, cellSize,
                    0, 0, cellSize
                ]), 3))
                .setAttribute("uv", new BufferAttribute(new Float32Array([
                    0, 0,
                    1, 0,
                    1, 1,
                    0, 1
                ]), 2))
                .setIndex([0, 2, 1, 0, 3, 2]);

            const mesh = new Mesh(geometry, material).translateY(yOffset);
            const { elevationStep } = config.game;
            mesh.scale.set(1, elevationStep, 1);
            mesh.position.set(x * cellSize, 0.001, y * cellSize);
            return mesh;
        };
        
        for (let i = 0; i < this._size; ++i) {
            for (let j = 0; j < this._size; ++j) {
                this.add(createMesh(j, i));                
            }
        }
    }

    public setPosition(mapCoords: Vector2) {
        const { cellSize, mapRes } = config.game;
        const offset = -mapRes / 2;
        this.position.set((mapCoords.x + offset) * cellSize, 0, (mapCoords.y + offset) * cellSize);
        this.fit(mapCoords);
    }
        
    public fit(mapCoords: Vector2) {
        const { mapRes } = config.game;
        const verticesPerRow = mapRes + 1;
        const [cellCoords, sectorCoords, localCoords] = pools.vec2.get(3);
        
        const fitTile = (mapX: number, mapY: number, tileIndex: number) => {
            const cell = GameUtils.getCell(cellCoords.set(mapX, mapY), sectorCoords, localCoords);
            const tileGeometry = (this.children[tileIndex] as Mesh).geometry as BufferGeometry;
            const tilePosition = tileGeometry.getAttribute('position') as BufferAttribute;
            if (cell) {
                const { sectors } = gameMapState;
                const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`);
                const geometry = (sector?.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
                const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
                const position = geometry.getAttribute("position") as THREE.BufferAttribute;                
                tilePosition.setY(0, position.getY(startVertexIndex));
                tilePosition.setY(1, position.getY(startVertexIndex + 1));
                tilePosition.setY(2, position.getY(startVertexIndex + verticesPerRow + 1));
                tilePosition.setY(3, position.getY(startVertexIndex + verticesPerRow));
                
            } else {
                tilePosition.setY(0, 0);
                tilePosition.setY(1, 0);
                tilePosition.setY(2, 0);
                tilePosition.setY(3, 0);
            }
            tilePosition.needsUpdate = true;
        };

        let tileIndex = 0;    
        for (let i = 0; i < this._size; ++i) {
            for (let j = 0; j < this._size; ++j) {
                fitTile(mapCoords.x + j, mapCoords.y + i, tileIndex);
                ++tileIndex;              
            }
        }
    }
}

