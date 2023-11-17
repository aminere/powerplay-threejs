
import { Mesh, MeshBasicMaterial, Object3D, BufferGeometry, BufferAttribute, TextureLoader, NearestFilter, Vector2 } from "three";
import { config } from "./config";
import { GameUtils } from "./GameUtils";
import { getMapState } from "./MapState";

export class TileSector extends Object3D {

    public get radius() { return this._radius; }

    private _radius = 0;
    constructor() {
        super();

        const { cellSize } = config.game;
        const yOffset = 0.01;

        const texture = new TextureLoader().load('images/tile-selected.png');
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
        
        this.add(createMesh(0, 0));
        const startX = 0;
        const startY = 0;
        for (let y = startY - this._radius; y <= startY + this._radius; ++y) {
            for (let x = startX - this._radius; x <= startX + this._radius; ++x) {
                if (x === startX && y === startY) {
                    continue;
                }
                this.add(createMesh(x, y));
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
        const [cellCoords, sectorCoords, localCoords] = GameUtils.pool.vec2.get(3);
        
        const fitTile = (mapX: number, mapY: number, tileIndex: number) => {
            const cell = GameUtils.getCell(cellCoords.set(mapX, mapY), sectorCoords, localCoords);
            const tileGeometry = (this.children[tileIndex] as Mesh).geometry as BufferGeometry;
            const tilePosition = tileGeometry.getAttribute('position') as BufferAttribute;
            if (cell) {
                const { sectors } = getMapState();
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

        fitTile(mapCoords.x, mapCoords.y, 0);

        const startX = 0;
        const startY = 0;
        let tileIndex = 1;
        for (let y = startY - this._radius; y <= startY + this._radius; ++y) {
            for (let x = startX - this._radius; x <= startX + this._radius; ++x) {
                if (x === startX && y === startY) {
                    continue;
                }
                fitTile(mapCoords.x + x, mapCoords.y + y, tileIndex);
                ++tileIndex;
            }
        }
    }
}

