import { useEffect, useRef } from "react"
import { ISelectedUnit, cmdSetSeletedUnits, cmdUpdateUI, evtScreenResized } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { Color, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { engine } from "../../engine/Engine";

const full = new Color(0x19c80f);
const empty = new Color(0xc01c06);
const color = new Color();
const parts = 5;
const step = 1 / parts;
const partWidth = 12;
const partHeight = 12;
const totalWidth = partWidth * parts;
const worldPos = new Vector3();
const screenPos = new Vector3();
export function HealthBars() {

    const selectedUnitsRef = useRef<ISelectedUnit[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const onSelectedUnits = (units: ISelectedUnit[]) => {
            selectedUnitsRef.current = units;
        };

        const updateUI = () => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "black";
            
            const selectedUnits = selectedUnitsRef.current;
            const camera = gameMapState.camera;
            for (let i = 0; i < selectedUnits.length; i++) {                
                const obj = selectedUnits[i].obj;
                worldPos.copy(obj.position).addScaledVector(obj.up, 1.7);
                GameUtils.worldToScreen(worldPos, camera, screenPos);

                const barX = Math.round(screenPos.x - totalWidth / 2);
                const barY = Math.round(screenPos.y);
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(barX, barY, totalWidth, partHeight);                

                const progress = selectedUnits[i].health;
                color.copy(empty).lerpHSL(full, progress);
                for (let j = 0; j < parts; ++j) {
                    const section = Math.floor(progress * parts);
                    const opacity = (() => {
                        if (j < section) {
                            return 1;
                        } else if (j > section) {
                            return 0;
                        } else {
                            const localProgress = progress - (section * step);
                            const normalizedProgress = localProgress / step;
                            return normalizedProgress;
                        }
                    })();
                    const partColor = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${opacity})`;                    
                    ctx.fillStyle = partColor;
                    ctx.fillRect(barX + j * partWidth, barY, partWidth, partHeight);
                    ctx.strokeRect(barX + j * partWidth, barY, partWidth, partHeight);
                }
            }
        };

        const onResize = () => {
            const { width, height } = engine.screenRect;
            canvasRef.current!.width = width;
            canvasRef.current!.height = height;
        };

        cmdUpdateUI.attach(updateUI);
        cmdSetSeletedUnits.attach(onSelectedUnits);
        evtScreenResized.attach(onResize);
        return () => {
            cmdSetSeletedUnits.detach(onSelectedUnits);
            cmdUpdateUI.detach(updateUI);
            evtScreenResized.detach(onResize);
        }
    }, []);

    const { width, height } = engine.screenRect;
    return <canvas
        ref={canvasRef}
        style={{
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            imageRendering: "pixelated"
        }}
        width={width}
        height={height}
    />
}

