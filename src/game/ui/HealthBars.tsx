import { useCallback, useEffect, useRef, useState } from "react"
import { ISelectedUnit, cmdSetSeletedUnits } from "../../Events";
import { HealthBar } from "./HealthBar";
import { GameUtils } from "../GameUtils";
import { OrthographicCamera, Vector3 } from "three";
import { gameMapState } from "../components/GameMapState";

interface IHealthBar {
    key: string;
    progress: number;
    screenPos: Vector3;
}

const screenPos = new Vector3();
const worldPos = new Vector3();
export function HealthBars() {

    const selectedUnits = useRef<ISelectedUnit[]>([]);
    const [healthBars, setHealthBars] = useState<IHealthBar[]>([]);

    useEffect(() => {
        const onSelectedUnits = (units: ISelectedUnit[]) => {
            selectedUnits.current = units;
        };
        cmdSetSeletedUnits.attach(onSelectedUnits);
        return () => {
            cmdSetSeletedUnits.detach(onSelectedUnits);
        }
    }, []);

    const animationFrameId = useRef<number>(0);
    const update = useCallback(() => {
        const camera = gameMapState.camera;
        setHealthBars(selectedUnits.current.map(unit => {
            worldPos.copy(unit.obj.position).addScaledVector(unit.obj.up, 1.7);
            camera.updateMatrixWorld(true);
            camera.updateWorldMatrix(true, true); 
            (camera as OrthographicCamera).updateProjectionMatrix();
            GameUtils.worldToScreen(worldPos, camera, screenPos);
            return {
                key: unit.obj.uuid,
                progress: unit.health,
                screenPos
            }
        }));
        animationFrameId.current = requestAnimationFrame(update);
    }, []);
    useEffect(() => {
        update();
        return () => {
            cancelAnimationFrame(animationFrameId.current);
        }
    }, [update]);

    return <>
        {healthBars.map(bar => {            
            return <HealthBar {...bar} />
        })}
    </>
}

