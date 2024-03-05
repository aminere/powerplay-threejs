import { useEffect, useRef, useState } from "react";
import { IMinimapFog, cmdRenderUI, cmdRotateMinimap, cmdUpdateMinimapFog, cmdUpdateUI } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { MathUtils, Matrix3, Mesh, Vector2, Vector3 } from "three";
import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { GameUtils } from "../GameUtils";
import { engine } from "../../engine/Engine";
import { GameMap } from "../components/GameMap";
import { input } from "../../engine/Input";

const { mapRes, cellSize } = config.game;
const mapOffset = mapRes / 2 * cellSize;
const verticesPerRow = mapRes + 1;
const screenPos = new Vector2();
const worldPos = new Vector3();
const mapCoordsTopLeft = new Vector2();
const mapCoords = new Vector2();

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

const minimapTransform = new Matrix3();
function makeMinimapTransform(angleDeg: number, offset: number) {
    minimapTransform.identity();
    minimapTransform.translate(-offset, -offset);
    minimapTransform.rotate(-angleDeg * MathUtils.DEG2RAD);
    minimapTransform.scale(1, .5);
    minimapTransform.translate(85, -30);
    minimapTransform.invert();
}

function updateCameraPos(gamemap: GameMap, clientX: number, clientY: number, offset: number) {
    const { left, top } = engine.screenRect;
    mapCoords.set(clientX - offset - left, clientY - offset - top).applyMatrix3(minimapTransform);
    const cameraPos = worldPos.set(mapCoords.x - mapRes / 2, 0, mapCoords.y - mapRes / 2).multiplyScalar(cellSize);
    gamemap.setCameraPos(cameraPos);
}

export function Minimap() {

    const root = useRef<HTMLDivElement | null>(null);
    const envRef = useRef<HTMLCanvasElement | null>(null);
    const unitsRef = useRef<HTMLCanvasElement | null>(null);
    const fogRef = useRef<HTMLCanvasElement | null>(null);
    const resourcesRef = useRef<HTMLCanvasElement | null>(null);
    const envPixelsRef = useRef<ImageData | null>(null);
    const unitsPixelsRef = useRef<ImageData | null>(null);
    const fogPixelsRef = useRef<ImageData | null>(null);
    const resourcePixelsRef = useRef<ImageData | null>(null);
    const cameraRef = useRef<HTMLCanvasElement | null>(null);
    const gamemapRef = useRef<GameMap | null>(null);
    const flockRef = useRef<Flock | null>(null);
    const touchPressed = useRef(false);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (initialized) {
            return;
        }

        const { sectorRes, sectors } = gameMapState;
        const texRes = mapRes * sectorRes;
        const size = texRes; // Math.min(texRes, 300);
        root.current!.style.width = `${size}px`;
        root.current!.style.height = `${size}px`;

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
        unitsCanvas.width = texRes / 4;
        unitsCanvas.height = texRes / 4;
        const unitsCtx = unitsCanvas.getContext("2d")!;
        const unitsPixels = unitsCtx.createImageData(unitsCanvas.width, unitsCanvas.height);
        unitsPixelsRef.current = unitsPixels;

        const fogCanvas = fogRef.current!;
        fogCanvas.width = texRes;
        fogCanvas.height = texRes;
        const fogCtx = fogCanvas.getContext("2d")!;
        const fogPixels = fogCtx.createImageData(fogCanvas.width, fogCanvas.height);
        fogPixelsRef.current = fogPixels;

        const cameraCanvas = cameraRef.current!;
        cameraCanvas.width = texRes;
        cameraCanvas.height = texRes;
        const cameraCtx = cameraCanvas.getContext("2d")!;
        cameraCtx.strokeStyle = "white";
        cameraCtx.lineWidth = 2;

        for (let i = 0; i < sectorRes; ++i) {
            for (let j = 0; j < sectorRes; ++j) {
                const sector = sectors.get(`${j},${i}`)!;
                const terrain = sector.layers.terrain as Mesh;
                const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
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
                            resourcesPixels.data.set([0, 255, 0, 255], resourcesIndex);
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

        const flocks = engineState.getComponents(Flock);
        flockRef.current = flocks[0].component;
        const gamemaps = engineState.getComponents(GameMap);
        gamemapRef.current = gamemaps[0].component;

        makeMinimapTransform(45, texRes / 2);
        setInitialized(true);
        
    }, []);

    useEffect(() => {
        if (!initialized) {
            return;
        }

        const renderUI = () => {
            if (!gameMapState.instance) {
                return;
            }

            const { sectorRes } = gameMapState;
            const texRes = mapRes * sectorRes;
            
            const flock = flockRef.current!;
            const units = flock.state.units;
            const unitsPixels = unitsPixelsRef.current!;
            unitsPixels.data.fill(0);
            for (const unit of units) {
                const { x, y } = unit.coords.mapCoords;
                const xu = Math.min(Math.round(x / texRes * unitsPixels.width), unitsPixels.width - 1);
                const yu = Math.min(Math.round(y / texRes * unitsPixels.height), unitsPixels.height - 1);
                const index = (yu * unitsPixels.width + xu) * 4;
                unitsPixels.data.set([0, 0, 255, 255], index);
            }

            const unitsCtx = unitsRef.current!.getContext("2d")!;
            unitsCtx.putImageData(unitsPixels, 0, 0);

            const fogCtx = fogRef.current!.getContext("2d")!;
            fogCtx.putImageData(fogPixelsRef.current!, 0, 0);

            const cameraCanvas = cameraRef.current!;
            const cameraCtx = cameraRef.current!.getContext("2d")!;
            cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
            cameraCtx.beginPath();
            const worldSize = mapRes * sectorRes * cellSize;
            const worldToMap = (worldCoord: number) => {
                return (worldCoord + mapOffset) / worldSize * texRes;
            };
            const { camera } = gameMapState;
            const { width: screenWidth, height: screenHeight } = engine.screenRect;
            screenPos.set(0, 0);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoordsTopLeft.set(worldToMap(worldPos.x), worldToMap(worldPos.z));
            cameraCtx.moveTo(mapCoordsTopLeft.x, mapCoordsTopLeft.y);
            screenPos.set(screenWidth, 0);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoords.set(worldToMap(worldPos.x), worldToMap(worldPos.z));
            cameraCtx.lineTo(mapCoords.x, mapCoords.y);
            screenPos.set(screenWidth, screenHeight);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoords.set(worldToMap(worldPos.x), worldToMap(worldPos.z));
            cameraCtx.lineTo(mapCoords.x, mapCoords.y);
            screenPos.set(0, screenHeight);
            GameUtils.screenCastOnPlane(camera, screenPos, 0, worldPos);
            mapCoords.set(worldToMap(worldPos.x), worldToMap(worldPos.z));
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
            const { sectorRes } = gameMapState;
            const texRes = mapRes * sectorRes;
            makeMinimapTransform(angleDeg, texRes / 2);
            const container = root.current?.firstChild as HTMLDivElement;
            container.style.transform = `translate(85px, -30px) scaleY(.5) rotate(${angleDeg}deg)`;
        };

        console.log("attaching minimap");
        cmdUpdateUI.attach(updateUI);
        cmdRenderUI.attach(renderUI);
        cmdUpdateMinimapFog.attach(updateFog);
        cmdRotateMinimap.attach(onRotateMinimap);
        return () => {
            console.log("detaching minimap");
            cmdUpdateUI.detach(updateUI);
            cmdRenderUI.detach(renderUI);
            cmdUpdateMinimapFog.detach(updateFog);
            cmdRotateMinimap.detach(onRotateMinimap);
        }

    }, [initialized]);    

    return <div ref={root} style={{ position: "absolute", left: "0", top: "0" }}>
        <div
            style={{
                position: "relative",
                height: "100%",
                transform: `translate(85px, -30px) scaleY(.5) rotate(${45}deg)`,
                transformOrigin: "center",
                border: "1px solid white",
                pointerEvents: "all"
            }}
            onPointerEnter={() => gameMapState.cursorOverUI = true}
            onPointerLeave={() => gameMapState.cursorOverUI = false}
            onPointerDown={e => {
                const { sectorRes } = gameMapState;
                const texRes = mapRes * sectorRes;        
                updateCameraPos(gamemapRef.current!, e.clientX, e.clientY, texRes / 2);
                touchPressed.current = true
            }}
            onPointerMove={e => {
                if (touchPressed.current) {
                    const { sectorRes } = gameMapState;
                    const texRes = mapRes * sectorRes;
                    updateCameraPos(gamemapRef.current!, e.clientX, e.clientY, texRes / 2);
                }                
            }}
        >
            <canvas ref={envRef} style={{ ...crispCanvasStyle, zIndex: 1 }} />
            <canvas ref={resourcesRef} style={{ ...crispCanvasStyle, zIndex: 2 }} />
            <canvas ref={unitsRef} style={{ ...crispCanvasStyle, zIndex: 3 }} />
            <canvas ref={fogRef} style={{ ...crispCanvasStyle, zIndex: 4 }} />
            <canvas ref={cameraRef} style={{ ...canvasStyle, zIndex: 5 }} />
        </div>
    </div>
}

