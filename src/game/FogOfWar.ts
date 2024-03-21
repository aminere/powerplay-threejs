import { DataTexture, LinearFilter, MathUtils, Mesh, MeshBasicMaterial, PlaneGeometry, RGBAFormat, Vector2 } from "three";
import { config } from "./config";
import { engine } from "../engine/Engine";
import { GameUtils } from "./GameUtils";
import { cmdFogAddCircle, cmdFogMoveCircle, cmdFogRemoveCircle, cmdUpdateMinimapFog } from "../Events";

const { mapRes, cellSize } = config.game;
const mapSize = mapRes * cellSize;
const circlePos = new Vector2();

class FogOfWar {

    private _texRes = 0;
    private _texture!: DataTexture;
    private _textureData!: Uint8Array;
    private _circleCache = new Map<number, boolean[]>();

    public init(sectorRes: number) {        
        const texRes = mapRes * sectorRes;
        const texResPow2 = MathUtils.ceilPowerOfTwo(texRes);
        const pixelCount = texResPow2 * texResPow2;
        const textureData = new Uint8Array(pixelCount * 4);
        const texture = new DataTexture(textureData, texResPow2, texResPow2, RGBAFormat);        
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        for (let i = 0; i < texRes; ++i) {
            for (let j = 0; j < texRes; ++j) {
                const cellIndex = i * texResPow2 + j;
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

        const geometry = new PlaneGeometry();
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(.5, 0, .5);
        const plane = new Mesh(geometry, material);
        plane.name = "fogOfWar";
        const offset = -mapRes / 2;
        plane.position.set(offset, 0, offset + texResPow2).multiplyScalar(cellSize);
        plane.position.y = .01;
        const uvFactor = texResPow2 / texRes;
        plane.scale.set(mapSize, 1, -mapSize).multiplyScalar(sectorRes * uvFactor);
        // plane.visible = false;
        engine.scene!.add(plane);
        
        // bad hack do not bring back!
        // const edgeMaterial = new MeshBasicMaterial({ color: 0x000000, depthTest: false });
        // const edgeGeometry = new PlaneGeometry();
        // edgeGeometry.translate(.5, .5, 0);
        // const topPlane = new Mesh(edgeGeometry, edgeMaterial);
        // topPlane.position.set(offset, 0, offset).multiplyScalar(cellSize);
        // topPlane.scale.set(mapSize, 1, mapSize).multiplyScalar(sectorRes);
        // topPlane.name = "fogOfWarTopEdge";
        // engine.scene!.add(topPlane);
        // const leftPlane = new Mesh(edgeGeometry, edgeMaterial);
        // leftPlane.rotateY(Math.PI / 2);
        // leftPlane.position.set(offset, 0, offset + mapRes * sectorRes).multiplyScalar(cellSize);
        // leftPlane.scale.set(mapSize, 1, mapSize).multiplyScalar(sectorRes);
        // leftPlane.name = "fogOfWarLeftEdge";
        // engine.scene!.add(leftPlane);

        this._texRes = texResPow2;
        this._textureData = textureData;
        this._texture = texture;

        cmdFogAddCircle.attach(({ mapCoords, radius }) => this.addCircle(mapCoords, radius));
        cmdFogMoveCircle.attach(({ mapCoords, radius, dx, dy }) => this.moveCircle(mapCoords, radius, dx, dy));
        cmdFogRemoveCircle.attach(({ mapCoords, radius }) => this.removeCircle(mapCoords, radius));
    }

    private addCircle(mapCoords: Vector2, radius: number) {

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

                if (cell.viewCount < 0) {
                    cell.viewCount = 0;
                }
                cell.viewCount++;
                if (cell.viewCount === 1) {
                    const cellIndex = y * this._texRes + x;
                    const stride = cellIndex * 4;
                    this._textureData[stride + 3] = 0;
                    cmdUpdateMinimapFog.post({ x: circlePos.x, y: circlePos.y, visible: true });
                }
            }
        }
        this._texture.needsUpdate = true;
    }

    private removeCircle(mapCoords: Vector2, radius: number) {        

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

                cell.viewCount--;
                if (cell.viewCount === 0) {
                    const cellIndex = circlePos.y * this._texRes + circlePos.x;
                    const stride = cellIndex * 4;
                    this._textureData[stride + 3] = 128;
                    cmdUpdateMinimapFog.post({ x: circlePos.x, y: circlePos.y, visible: false });
                }
            }
        }
        this._texture.needsUpdate = true;
    }

    private moveCircle(mapCoords: Vector2, radius: number, dx: number, dy: number) {

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
                        const cellIndex = circlePos.y * this._texRes + circlePos.x;
                        const stride = cellIndex * 4;
                        this._textureData[stride + 3] = 128;
                        cmdUpdateMinimapFog.post({ x: circlePos.x, y: circlePos.y, visible: false });
                    }
                }

                circlePos.set(x + dx, y + dy);
                const newCell = GameUtils.getCell(circlePos);
                if (newCell) {
                    if (newCell.viewCount < 0) {
                        newCell.viewCount = 0;
                    }
                    newCell.viewCount++;
                    if (newCell.viewCount === 1) {
                        const cellIndex = circlePos.y * this._texRes + circlePos.x;
                        const stride = cellIndex * 4;
                        this._textureData[stride + 3] = 0;
                        cmdUpdateMinimapFog.post({ x: circlePos.x, y: circlePos.y, visible: true });
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

