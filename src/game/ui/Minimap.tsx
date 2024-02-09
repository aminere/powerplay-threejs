import { useEffect, useRef } from "react";
import { cmdUpdateUI } from "../../Events";
import { gameMapState } from "../components/GameMapState";

export function Minimap() {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const width = 250;
    const height = 250;

    useEffect(() => {
        const updateUI = () => {
            if (!gameMapState.instance) {
                return;
            }
            
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "black";
            ctx.fillStyle = "rgba(255, 0, 0, 0.3)";

            ctx.fillRect(0, 0, width, height);
        };

        cmdUpdateUI.attach(updateUI);
        
        return () => {            
            cmdUpdateUI.detach(updateUI);
        }
    }, []);

    return <canvas
        ref={canvasRef}
        style={{
            position: "absolute",
            right: "0",
            top: "0",
            width: `${width}px`,
            height: `${height}px`,
            imageRendering: "pixelated"
        }}
        width={width}
        height={height}
    />
}

