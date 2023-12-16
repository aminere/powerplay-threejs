
import { useEffect, useRef } from "react";
import { Color, Object3D, Vector3 } from "three";
import { cmdUpdateUI } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { GameUtils } from "../GameUtils";

const full = new Color(0x19c80f);
const empty = new Color(0xc01c06);
const color = new Color();
const parts = 5;
const step = 1 / parts;
const partWidth = 12;
const partHeight = 12;
const totalWidth = partWidth * parts;

function Square({ color }: { color: string; }) {
    return <div
        style={{
            height: `${partHeight}px`,
            width: `${partWidth}px`,
            backgroundColor: color,            
            border: "1px solid black",
        }}
    />
}

const worldPos = new Vector3();
const screenPos = new Vector3();
export function HealthBar({ progress, obj }: { progress: number; obj: Object3D }) {
    color.copy(empty).lerpHSL(full, progress);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const updateUI = () => {
            const camera = gameMapState.camera;
            worldPos.copy(obj.position).addScaledVector(obj.up, 1.7);
            GameUtils.worldToScreen(worldPos, camera, screenPos);
            root.current!.style.left = `${screenPos.x - totalWidth / 2}px`;
            root.current!.style.top = `${screenPos.y}px`;
        };
        cmdUpdateUI.attach(updateUI);
        return () => {
            cmdUpdateUI.detach(updateUI);
        }
    }, []);
    
    return <div
        ref={root}
        style={{
            position: "absolute",
            display: "flex",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
        }}
    >
        {[...Array(parts)].map((_, i) => {
            const section = Math.floor(progress * parts);
            const opacity = (() => {
                if (i < section) {
                    return 1;
                } else if (i === section) {
                    const localProgress = progress - (section * step);
                    const normalizedProgress = localProgress / step;
                    return normalizedProgress;
                } else {
                    return 0;
                }
            })();
            return <Square
                key={i}
                color={`rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${opacity})`}
            />
        })}
    </div>
}

