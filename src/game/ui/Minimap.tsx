import { useEffect, useRef, useState } from "react";
import { cmdUpdateUI } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { Mesh } from "three";

const { mapRes } = config.game;
const verticesPerRow = mapRes + 1;

export function Minimap() {

    const container = useRef<HTMLDivElement | null>(null);
    const envRef = useRef<HTMLCanvasElement | null>(null);
    const envPixelsRef = useRef<ImageData | null>(null);
    const [envDirty, setEnvDirty] = useState(true);

    useEffect(() => {
        const updateUI = () => {
            if (!gameMapState.instance) {
                return;
            }

            if (envDirty) {
                const { sectorRes, sectors } = gameMapState;
                const texRes = mapRes * sectorRes;                

                if (!envRef.current) {
                    const root = container.current!.parentElement!;
                    root.style.width = `${texRes}px`;
                    root.style.height = `${texRes}px`;

                    const canvas = document.createElement("canvas");
                    canvas.style.imageRendering = "pixelated";
                    canvas.style.width = `100%`;
                    canvas.style.height = `100%`;
                    canvas.style.position = "absolute";
                    canvas.style.left = "0";
                    canvas.style.top = "0";
                    canvas.style.zIndex = "1";
                    canvas.width = texRes;
                    canvas.height = texRes;
                    envRef.current = canvas;
                    container.current!.appendChild(canvas);
                    const ctx = canvas.getContext("2d")!;
                    const pixels = ctx.createImageData(texRes, texRes);
                    pixels.data.fill(255);
                    envPixelsRef.current = pixels;
                }

                console.log("drawing env");
                // ctx.clearRect(0, 0, canvas.width, canvas.height);                
                // ctx.fillStyle = "#c4926f"; // sand
                // ctx.fillRect(0, 0, texRes, texRes);
                const pixels = envPixelsRef.current!;
                
                for (let i = 0; i < sectorRes; ++i) {
                    for (let j = 0; j < sectorRes; ++j) {

                        const sector = sectors.get(`${j},${i}`)!;
                        const terrain = sector.layers.terrain as Mesh;
                        const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;                        

                        for (let k = 0; k < mapRes; k++) {
                            for (let l = 0; l < mapRes; l++) {
                                const cellIndex = k * mapRes + l;
                                const cell = sector.cells[cellIndex];
                                const x = j * mapRes + l;
                                const y = i * mapRes + k;
                                const index = (y * texRes + x) * 4;

                                // if (cell.viewCount < 0) {                                                                        
                                //     pixels.data.set([0, 0, 0], index);
                                //     // ctx.fillStyle = "#000000"; // fog                                    
                                //     // ctx.fillRect(x, y, cellSize, cellSize);
                                //     continue;
                                // }

                                const startVertexIndex = k * verticesPerRow + l;
                                const _height1 = position.getY(startVertexIndex);
                                const _height2 = position.getY(startVertexIndex + 1);
                                const _height3 = position.getY(startVertexIndex + verticesPerRow);
                                const _height4 = position.getY(startVertexIndex + verticesPerRow + 1);
                                const _maxHeight = Math.max(_height1, _height2, _height3, _height4);
                                const _minHeight = Math.min(_height1, _height2, _height3, _height4);                                
                                const averageHeight = (_maxHeight + _minHeight) / 2;
                                const isWater = averageHeight < 0;                                
                                if (isWater) {                                    
                                    pixels.data.set([81, 153, 219], index);
                                    // ctx.fillStyle = "#5199DB"; // water
                                    // ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                                } else if (cell.resource) {
                                    pixels.data.set([0, 255, 0], index);
                                } else {
                                    pixels.data.set([196,146,111], index); // sand
                                }
                            }
                        }

                    }
                }

                const canvas = envRef.current!;
                const ctx = canvas.getContext("2d")!;
                ctx.putImageData(pixels, 0, 0);
                setEnvDirty(false);
            }
        };

        cmdUpdateUI.attach(updateUI);
        return () => {
            cmdUpdateUI.detach(updateUI);
        }

    }, [envDirty]);

    return <div style={{ position: "absolute", left: "0", top: "0" }}>
        <div ref={container} style={{ position: "relative", height: "100%" }}></div>
    </div>   
}

