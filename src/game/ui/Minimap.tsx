import { useEffect, useRef, useState } from "react";
import { IMinimapFog, cmdRenderUI, cmdRotateMinimap, cmdUpdateMinimapFog, cmdUpdateUI, evtFogOfWarChanged } from "../../Events";
import { config } from "../config/config";
import { BufferAttribute, MathUtils, Matrix3, Mesh, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { engine } from "../../engine/Engine";
import { input } from "../../engine/Input";
import { GameMapState } from "../components/GameMapState";
import { unitsManager } from "../unit/UnitsManager";
import { setCameraPos } from "../GameMapUtils";

const { mapRes, cellSize } = config.game;
const mapOffset = mapRes / 2 * cellSize;
const verticesPerRow = mapRes + 1;
const screenPos = new Vector2();
const worldPos = new Vector3();
const mapCoordsTopLeft = new Vector2();
const mapCoords = new Vector2();
const minimapPos = new Vector2(75, 35);
const minimapSize = 300;
// const unitsCanvasOffsetX = 70;

const canvasStyle = {
    width: "100%",
    height: "100%",
    position: "absolute",
    left: "0",
    top: "0",
} as const;

const crispCanvasStyle = {
    imageRendering: "pixelated",
    ...canvasStyle
} as const;

const screenToCanvas = new Matrix3();
function makeScreenToCanvasTransform(angleDeg: number, offset: number) {
    screenToCanvas.identity();
    screenToCanvas.translate(-offset, -offset);
    screenToCanvas.rotate(-angleDeg * MathUtils.DEG2RAD);
    screenToCanvas.scale(1, .5);
    screenToCanvas.translate(minimapPos.x, minimapPos.y);
    screenToCanvas.invert();
}

function updateCameraPos(clientX: number, clientY: number, offset: number) {
    const { left, top, height } = engine.screenRect;
    const startX = left; // left + width - minimapSize;
    const startY = top + height - minimapSize;

    // convert from screen to canvas space
    mapCoords.set(clientX - offset - startX, clientY - offset - startY).applyMatrix3(screenToCanvas);

    // convert to map space
    const { sectorRes } = GameMapState.instance;
    const texRes = mapRes * sectorRes;
    mapCoords.multiplyScalar(texRes / minimapSize);

    // convert to world space
    worldPos.set(mapCoords.x - mapRes / 2, 0, mapCoords.y - mapRes / 2).multiplyScalar(cellSize);
    setCameraPos(worldPos);
}

export function Minimap() {

    const root = useRef<HTMLDivElement | null>(null);
    const envRef = useRef<HTMLCanvasElement | null>(null);
    const unitsRef = useRef<HTMLCanvasElement | null>(null);
    const fogRef = useRef<HTMLCanvasElement | null>(null);
    const resourcesRef = useRef<HTMLCanvasElement | null>(null);
    const envPixelsRef = useRef<ImageData | null>(null);
    // const unitsPixelsRef = useRef<ImageData | null>(null);
    const fogPixelsRef = useRef<ImageData | null>(null);
    const resourcePixelsRef = useRef<ImageData | null>(null);
    const cameraRef = useRef<HTMLCanvasElement | null>(null);
    const touchPressed = useRef(false);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (initialized) {
            return;
        }

        const { sectorRes, sectors, config } = GameMapState.instance;
        const texRes = mapRes * sectorRes;
        root.current!.style.width = `${minimapSize}px`;
        root.current!.style.height = `${minimapSize}px`;

        const envCanvas = envRef.current!;
        envCanvas.width = texRes;
        envCanvas.height = texRes;
        const envCtx = envCanvas.getContext("2d")!;
        const envPixels = envCtx.createImageData(envCanvas.width, envCanvas.height);
        envPixelsRef.current = envPixels;

        const resourcesCanvas = resourcesRef.current!;
        resourcesCanvas.width = texRes / 2;
        resourcesCanvas.height = texRes / 2;
        const resourcesCtx = resourcesCanvas.getContext("2d")!;
        const resourcesPixels = resourcesCtx.createImageData(resourcesCanvas.width, resourcesCanvas.height);
        resourcePixelsRef.current = resourcesPixels;

        const unitsCanvas = unitsRef.current!;
        unitsCanvas.width = minimapSize;
        unitsCanvas.height = minimapSize;

        const fogCanvas = fogRef.current!;
        fogCanvas.width = texRes;
        fogCanvas.height = texRes;
        const fogCtx = fogCanvas.getContext("2d")!;
        const fogPixels = fogCtx.createImageData(fogCanvas.width, fogCanvas.height);
        fogPixelsRef.current = fogPixels;
        if (!config.fogOfWar) {
            fogCanvas.style.display = "none";
        }

        const cameraCanvas = cameraRef.current!;
        cameraCanvas.width = minimapSize;
        cameraCanvas.height = minimapSize;
        const cameraCtx = cameraCanvas.getContext("2d")!;
        cameraCtx.strokeStyle = "white";
        cameraCtx.lineWidth = 2;

        for (let i = 0; i < sectorRes; ++i) {
            for (let j = 0; j < sectorRes; ++j) {
                const sector = sectors.get(`${j},${i}`)!;
                const terrain = sector.layers.terrain as Mesh;
                const position = terrain.geometry.getAttribute("position") as BufferAttribute;
                for (let k = 0; k < mapRes; k++) {
                    for (let l = 0; l < mapRes; l++) {
                        const startVertexIndex = k * verticesPerRow + l;
                        const _height1 = position.getY(startVertexIndex);
                        const _height2 = position.getY(startVertexIndex + 1);
                        const _height3 = position.getY(startVertexIndex + verticesPerRow);
                        const _height4 = position.getY(startVertexIndex + verticesPerRow + 1);
                        const _maxHeight = Math.max(_height1, _height2, _height3, _height4);
                        const _minHeight = Math.min(_height1, _height2, _height3, _height4);
                        const averageHeight = (_maxHeight + _minHeight) / 2;
                        const isWater = averageHeight < 0;
                        const cellIndex = k * mapRes + l;
                        const cell = sector.cells[cellIndex];
                        const x = j * mapRes + l;
                        const y = i * mapRes + k;
                        const index = (y * texRes + x) * 4;
                        if (isWater) {
                            envPixels.data.set([81, 153, 219, 255], index);
                        } else if (cell.resource) {
                            const xr = Math.floor(x / texRes * resourcesPixels.width);
                            const yr = Math.floor(y / texRes * resourcesPixels.height);
                            const resourcesIndex = (yr * resourcesPixels.width + xr) * 4;
                            switch (cell.resource.type) {
                                case "wood": {
                                    resourcesPixels.data.set([0, 128, 0, 255], resourcesIndex);
                                }
                                    break;

                                default:
                                    resourcesPixels.data.set([32, 32, 32, 255], resourcesIndex);
                            }

                        } else {
                            envPixels.data.set([196, 146, 111, 255], index); // sand
                        }

                        if (cell.viewCount < 0) {
                            fogPixels.data.set([0, 0, 0, 255], index);
                        }
                    }
                }

            }
        }
        envCtx.putImageData(envPixels, 0, 0);
        resourcesCtx.putImageData(resourcesPixels, 0, 0);
        fogCtx.putImageData(fogPixels, 0, 0);
        setInitialized(true);

        makeScreenToCanvasTransform(45, minimapSize / 2);

    }, []);

    useEffect(() => {
        const onFogOfWarChanged = (active: boolean) => {
            const fogCanvas = fogRef.current!;
            fogCanvas.style.display = active ? "block" : "none";
        };
        evtFogOfWarChanged.attach(onFogOfWarChanged);
        return () => {
            evtFogOfWarChanged.detach(onFogOfWarChanged);
        }
    }, []);

    useEffect(() => {
        if (!initialized) {
            return;
        }

        const renderUI = () => {
            const { sectorRes } = GameMapState.instance;
            const texRes = mapRes * sectorRes;

            const unitsCanvas = unitsRef.current!;
            const unitsCtx = unitsCanvas.getContext("2d")!;
            const { units } = unitsManager;
            unitsCtx.clearRect(0, 0, unitsCanvas.width, unitsCanvas.height);
            unitsCtx.fillStyle = "blue";
            for (const unit of units) {
                const { x, y } = unit.coords.mapCoords;
                const xu = Math.min(Math.round(x / texRes * unitsCanvas.width), unitsCanvas.width - 1);
                const yu = Math.min(Math.round(y / texRes * unitsCanvas.height), unitsCanvas.height - 1);
                unitsCtx.fillRect(xu - 2, yu - 2, 4, 4);
            }

            const fogCtx = fogRef.current!.getContext("2d")!;
            fogCtx.putImageData(fogPixelsRef.current!, 0, 0);

            const cameraCanvas = cameraRef.current!;
            const cameraCtx = cameraRef.current!.getContext("2d")!;
            cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
            cameraCtx.beginPath();
            const worldSize = mapRes * sectorRes * cellSize;
            const worldToMinimap = (worldCoord: number) => {
                return (worldCoord + mapOffset) / worldSize * minimapSize;
            };
            const { camera } = GameMapState.instance;
            const { width: screenWidth, height: screenHeight } = engine.screenRect;
            screenPos.set(0, 0);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoordsTopLeft.set(worldToMinimap(worldPos.x), worldToMinimap(worldPos.z));
            cameraCtx.moveTo(mapCoordsTopLeft.x, mapCoordsTopLeft.y);
            screenPos.set(screenWidth, 0);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoords.set(worldToMinimap(worldPos.x), worldToMinimap(worldPos.z));
            cameraCtx.lineTo(mapCoords.x, mapCoords.y);
            screenPos.set(screenWidth, screenHeight);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoords.set(worldToMinimap(worldPos.x), worldToMinimap(worldPos.z));
            cameraCtx.lineTo(mapCoords.x, mapCoords.y);
            screenPos.set(0, screenHeight);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoords.set(worldToMinimap(worldPos.x), worldToMinimap(worldPos.z));
            cameraCtx.lineTo(mapCoords.x, mapCoords.y);
            cameraCtx.lineTo(mapCoordsTopLeft.x, mapCoordsTopLeft.y);
            cameraCtx.stroke();
        };

        const updateFog = (fog: IMinimapFog) => {
            const fogPixels = fogPixelsRef.current!;
            const index = (fog.y * fogPixels.width + fog.x) * 4;
            fogPixels.data.set([0, 0, 0, fog.visible ? 0 : 128], index);
        };

        const updateUI = () => {
            if (input.touchJustReleased) {
                touchPressed.current = false;
            }
        };

        const onRotateMinimap = (angleDeg: number) => {
            const cameraCanvas = cameraRef.current!;
            const size = cameraCanvas.width;
            makeScreenToCanvasTransform(angleDeg, size / 2);
            const container = root.current?.firstChild as HTMLDivElement;
            container.style.transform = `translate(${minimapPos.x}px, ${minimapPos.y}px) scaleY(.5) rotate(${angleDeg}deg)`;
        };

        cmdUpdateUI.attach(updateUI);
        cmdRenderUI.attach(renderUI);
        cmdUpdateMinimapFog.attach(updateFog);
        cmdRotateMinimap.attach(onRotateMinimap);
        return () => {
            cmdUpdateUI.detach(updateUI);
            cmdRenderUI.detach(renderUI);
            cmdUpdateMinimapFog.detach(updateFog);
            cmdRotateMinimap.detach(onRotateMinimap);
        }

    }, [initialized]);

    return <div
        ref={root}
        style={{
            position: "absolute",
            left: "0",
            bottom: "0",
            pointerEvents: "none",
        }}
    >
        <div
            style={{
                position: "relative",
                height: "100%",
                transform: `translate(${minimapPos.x}px, ${minimapPos.y}px) scaleY(.5) rotate(${45}deg)`,
                transformOrigin: "center",
                border: "1px solid white",
                pointerEvents: "all"
            }}
            onPointerDown={e => {
                const cameraCanvas = cameraRef.current!;
                const size = cameraCanvas.width;
                updateCameraPos(e.clientX, e.clientY, size / 2);
                touchPressed.current = true
            }}
            onPointerMove={e => {
                if (touchPressed.current) {
                    const cameraCanvas = cameraRef.current!;
                    const size = cameraCanvas.width;
                    updateCameraPos(e.clientX, e.clientY, size / 2);
                }
            }}
        >
            <canvas ref={envRef} style={{ ...crispCanvasStyle, zIndex: 1 }} />
            <canvas ref={resourcesRef} style={{ ...crispCanvasStyle, zIndex: 2 }} />
            <canvas ref={unitsRef} style={{ ...crispCanvasStyle, zIndex: 3 }} />
            <canvas ref={fogRef} style={{ ...crispCanvasStyle, zIndex: 4 }} />
            <canvas ref={cameraRef} style={{ ...canvasStyle, zIndex: 5 }} />
        </div>
        {/* <canvas
            ref={unitsRef}
            style={{
                ...crispCanvasStyle,
                transform: `translate(${minimapPos.x - unitsCanvasOffsetX}px, ${minimapPos.y}px)`,
                width: `calc(100% + ${unitsCanvasOffsetX * 2}px)`,
                zIndex: 3
            }} /> */}
    </div>
}

