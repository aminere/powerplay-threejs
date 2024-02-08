import { DataTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, RGBAFormat, Vector2 } from "three";
import { config } from "./config";
import { engine } from "../engine/Engine";
import { GameUtils } from "./GameUtils";

const { mapRes, cellSize } = config.game;
const mapSize = mapRes * cellSize;
const circlePos = new Vector2();

class FogOfWar {

    private _cellRes = 0;
    private _texture!: DataTexture;
    private _textureData!: Uint8Array;

    public init(sectorRes: number) {        
        const cellRes = mapRes * sectorRes;        
        const cellCount = cellRes * cellRes;        
        const textureData = new Uint8Array(cellCount * 4);
        const texture = new DataTexture(textureData, cellRes, cellRes, RGBAFormat);        
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        for (let i = 0; i < cellRes; ++i) {
            for (let j = 0; j < cellRes; ++j) {
                const cellIndex = i * cellRes + j;
                const stride = cellIndex * 4;
                textureData[stride] = 0;
                textureData[stride + 1] = 0;
                textureData[stride + 2] = 0;
                textureData[stride + 3] = 255;
            }
        }
        texture.needsUpdate = true;
        const material = new MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            depthTest: false
        });

        const plane = new Mesh(new PlaneGeometry(), material);
        plane.name = "fogOfWar";
        const offset = mapRes + mapRes / 2;
        plane.position.set(offset, 0, offset);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = 0.01;
        plane.scale.set(mapSize, -mapSize, 1).multiplyScalar(sectorRes);
        engine.scene!.add(plane);

        this._cellRes = cellRes;
        this._textureData = textureData;
        this._texture = texture;
    }

    public addCircle(mapCoords: Vector2, radius: number) {
        const startX = mapCoords.x - radius;
        const startY = mapCoords.y - radius;
        const radius2 = radius + radius;
        for (let i = 0; i < radius2; ++i) {
            for (let j = 0; j < radius2; ++j) {
                const x = startX + j;
                const y = startY + i;
                if (x < 0 || x >= this._cellRes || y < 0 || y >= this._cellRes) {
                    continue;
                }
                circlePos.set(x, y);
                const dist = mapCoords.distanceTo(circlePos);
                if (dist > radius) {
                    continue;
                }

                const cell = GameUtils.getCell(circlePos)!;
                console.assert(cell);
                cell.viewCount++;

                if (cell.viewCount === 1) {
                    const cellIndex = y * this._cellRes + x;
                    const stride = cellIndex * 4;
                    this._textureData[stride + 3] = 0;
                }                
            }
        }
        this._texture.needsUpdate = true;
    }

    public removeCircle(mapCoords: Vector2, radius: number) {
        const startX = mapCoords.x - radius;
        const startY = mapCoords.y - radius;
        const radius2 = radius + radius;
        for (let i = 0; i < radius2; ++i) {
            for (let j = 0; j < radius2; ++j) {
                const x = startX + j;
                const y = startY + i;
                if (x < 0 || x >= this._cellRes || y < 0 || y >= this._cellRes) {
                    continue;
                }
                circlePos.set(x, y);
                const dist = mapCoords.distanceTo(circlePos);
                if (dist > radius) {
                    continue;
                }

                const cell = GameUtils.getCell(circlePos)!;
                console.assert(cell);
                cell.viewCount--;
                console.assert(cell.viewCount >= 0);
                if (cell.viewCount === 0) {
                    const cellIndex = y * this._cellRes + x;
                    const stride = cellIndex * 4;
                    this._textureData[stride + 3] = 128;
                }
            }
        }
        this._texture.needsUpdate = true;
    }
}

export const fogOfWar = new FogOfWar();

