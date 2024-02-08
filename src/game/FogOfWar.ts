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
    private _circleCache = new Map<number, boolean[]>();

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
        const offset = (mapRes + mapRes / 2) * cellSize;
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
        const circle = this.getCircle(radius);
        let index = 0;
        for (let i = 0; i < radius2; ++i) {
            for (let j = 0; j < radius2; ++j) {
                if (!circle[index]) {
                    index++;
                    continue;
                }
                index++;

                const x = startX + j;
                const y = startY + i;
                circlePos.set(x, y);
                const cell = GameUtils.getCell(circlePos);
                if (!cell) {
                    continue;
                }

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

    public moveCircle(mapCoords: Vector2, radius: number, dx: number, dy: number) {

        const startX = mapCoords.x - radius;
        const startY = mapCoords.y - radius;
        const radius2 = radius + radius;
        const circle = this.getCircle(radius);
        let index = 0;
        for (let i = 0; i < radius2; ++i) {
            for (let j = 0; j < radius2; ++j) {
                if (!circle[index]) {
                    index++;
                    continue;
                }
                index++;

                const x = startX + j;
                const y = startY + i;
                circlePos.set(x, y);
                const oldCell = GameUtils.getCell(circlePos);
                if (oldCell) {
                    oldCell.viewCount--;
                    if (oldCell.viewCount === 0) {
                        const cellIndex = circlePos.y * this._cellRes + circlePos.x;
                        const stride = cellIndex * 4;
                        this._textureData[stride + 3] = 128;
                    }
                }

                circlePos.set(x + dx, y + dy);
                const newCell = GameUtils.getCell(circlePos);
                if (newCell) {
                    newCell.viewCount++;
                    if (newCell.viewCount === 1) {
                        const cellIndex = circlePos.y * this._cellRes + circlePos.x;
                        const stride = cellIndex * 4;
                        this._textureData[stride + 3] = 0;
                    }                
                }
            }
        }

        this._texture.needsUpdate = true;
    }    

    private getCircle(radius: number) {
        const cached = this._circleCache.get(radius);
        if (cached) {
            return cached;
        }
        const radius2 = radius + radius;
        const startX = -radius;
        const startY = -radius;
        let index = 0;
        const _circle: boolean[] = [...Array(radius2 * radius2)];
        for (let i = 0; i < radius2; ++i) {
            for (let j = 0; j < radius2; ++j) {
                const x = startX + j;
                const y = startY + i;
                circlePos.set(x, y);
                const dist = circlePos.length();
                const inside = dist < radius;
                _circle[index] = inside;
                index++;
            }
        }
        this._circleCache.set(radius, _circle);
        return _circle;
    }
}

export const fogOfWar = new FogOfWar();

