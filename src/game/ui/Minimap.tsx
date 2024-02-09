import { useEffect, useRef, useState } from "react";
import { cmdUpdateUI } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { Mesh } from "three";

const { mapRes } = config.game;
const verticesPerRow = mapRes + 1;

export function Minimap() {

    const width = 250;
    const height = 250;    
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const envRef = useRef<HTMLCanvasElement | null>(null);
    const [envDirty, setEnvDirty] = useState(true);

    useEffect(() => {
        const updateUI = () => {
            if (!gameMapState.instance) {
                return;
            }

            if (envDirty) {
                if (!envRef.current) {
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    envRef.current = canvas;
                }

                console.log("drawing env");
                const canvas = envRef.current!;
                const ctx = canvas.getContext("2d")!;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const { sectorRes, sectors } = gameMapState;
                const cellRes = mapRes * sectorRes;
                const cellSize = width / cellRes;
                ctx.fillStyle = "#c4926f"; // sand
                ctx.fillRect(0, 0, width, height);
                
                for (let i = 0; i < sectorRes; ++i) {
                    for (let j = 0; j < sectorRes; ++j) {

                        const sector = sectors.get(`${j},${i}`)!;
                        const terrain = sector.layers.terrain as Mesh;
                        const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;                        

                        for (let k = 0; k < mapRes; k++) {
                            for (let l = 0; l < mapRes; l++) {
                                const cellIndex = k * mapRes + l;
                                const cell = sector.cells[cellIndex];
                                if (cell.viewCount < 0) {                                    
                                    const x = j * mapRes + l;
                                    const y = i * mapRes + k;
                                    ctx.fillStyle = "#000000"; // fog
                                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                                    continue;
                                }
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
                                    const x = j * mapRes + l;
                                    const y = i * mapRes + k;
                                    ctx.fillStyle = "#5199DB"; // water
                                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                                } else {
                                    
                                    if (cell.resource) {
                                        const x = j * mapRes + l;
                                        const y = i * mapRes + k;
                                        ctx.fillStyle = "green";
                                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                                    }
                                }
                            }
                        }

                    }
                }

                setEnvDirty(false);
            }

            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(envRef.current!, 0, 0);
        };

        cmdUpdateUI.attach(updateUI);
        return () => {
            cmdUpdateUI.detach(updateUI);
        }

    }, [envDirty]);

    return <canvas
        ref={canvasRef}
        style={{
            position: "absolute",
            left: "0",
            top: "0",
            width: `${width}px`,
            height: `${height}px`,
            imageRendering: "pixelated"
        }}
        width={width}
        height={height}
    />
}

