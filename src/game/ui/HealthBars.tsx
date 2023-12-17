import { useEffect, useRef, useState } from "react"
import { ISelectedUnit, cmdSetSeletedUnits, cmdUpdateUI } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { Color, Vector3 } from "three";
import { GameUtils } from "../GameUtils";

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

    const [selectedUnits, setSelectedUnits] = useState<ISelectedUnit[]>([]);
    const refs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const onSelectedUnits = (units: ISelectedUnit[]) => {
            setSelectedUnits(units);
        };
        cmdSetSeletedUnits.attach(onSelectedUnits);
        return () => {
            cmdSetSeletedUnits.detach(onSelectedUnits);
        }
    }, []);

    useEffect(() => {   
        const updateUI = () => {
            const camera = gameMapState.camera;
            for (let i = 0; i < selectedUnits.length; i++) {
                const bar = refs.current[i];
                if (!bar) {
                    return;
                }
                const obj = selectedUnits[i].obj;
                worldPos.copy(obj.position).addScaledVector(obj.up, 1.7);
                GameUtils.worldToScreen(worldPos, camera, screenPos);
                bar.style.left = `${screenPos.x - totalWidth / 2}px`;
                bar.style.top = `${screenPos.y}px`;
                bar.style.display = `flex`;

                const progress = selectedUnits[i].health;
                color.copy(empty).lerpHSL(full, progress);
                for (let j = 0; j < parts; ++j) {
                    const section = Math.floor(progress * parts);
                    const opacity = (() => {
                        if (j < section) {
                            return 1;
                        } else if (j === section) {
                            const localProgress = progress - (section * step);
                            const normalizedProgress = localProgress / step;
                            return normalizedProgress;
                        } else {
                            return 0;
                        }
                    })();
                    const partColor = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${opacity})`;
                    const part = bar.childNodes[j] as HTMLElement;
                    part.style.backgroundColor = partColor;
                }
            }
        };

        cmdUpdateUI.attach(updateUI);
        return () => {
            cmdUpdateUI.detach(updateUI);
        }
    }, [selectedUnits]);

    return <>
        {selectedUnits.map((selected, i) => {
            return <div
                key={selected.obj.uuid}
                ref={e => refs.current[i] = e}
                style={{
                    position: "absolute",
                    display: "none",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                }}
            >
                {[...Array(parts)].map((_, i) => {                    
                    return <div
                        key={i}
                        style={{
                            height: `${partHeight}px`,
                            width: `${partWidth}px`,
                            border: "1px solid black",
                        }}
                    />
                })}
            </div>            
        })}
    </>
}

