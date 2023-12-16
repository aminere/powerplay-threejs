
import { Color, Vector3 } from "three";

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
export function HealthBar({ progress, screenPos }: { progress: number; screenPos: Vector3 }) {
    color.copy(empty).lerpHSL(full, progress);
    return <div style={{
        position: "absolute",
        left: `${screenPos.x - totalWidth / 2}px`,
        top: `${screenPos.y}px`,
        display: "flex",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
    }}>
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

