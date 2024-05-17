import { Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { GameMapState } from "../components/GameMapState";
import { config } from "../config/config";
import { IUnit } from "../unit/IUnit";
import { useEffect, useState } from "react";
import { SetIndicatorEvent, cmdSetIndicator } from "../../Events";
import { uiconfig } from "./uiconfig";

const screenPos = new Vector3();
const { unitScale } = config.game;

interface IndicatorProps {
    worldPos: Vector3;
    control: string;
    icon: string;
}

function WorldIndicator(props: IndicatorProps) {
    const camera = GameMapState.instance.camera;
    GameUtils.worldToScreen(props.worldPos, camera, screenPos);
    return <div
        className="float"
        style={{
            position: "absolute",
            left: `${screenPos.x}px`,
            top: `${screenPos.y}px`,
        }}>
        <div style={{
            position: "relative",
        }}>
            <img
                style={{
                    height: "3rem",
                    transform: "translateX(-50%) translateY(-3rem)",
                }}
                src="/images/arrows.png"
            />

            <div style={{
                transform: "translateX(-50%) translateY(-11rem)",
            }}>
                <div style={{
                    position: "relative",
                    padding: `${uiconfig.paddingRem}rem`,
                    backgroundColor: `${uiconfig.backgroundColor}`,
                    display: "flex",
                    gap: "1rem",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <div>{props.control}</div>
                    <img
                        style={{
                            height: "3rem",
                        }}
                        src={`/images/${props.icon}.png`}
                    />                    
                </div>
            </div>
        </div>

    </div>
}

function UnitIndicator({ unit, control, icon }: { unit: IUnit, control: string, icon: string }) {
    const worldPos = new Vector3().copy(unit.visual.position);
    worldPos.y += unit.boundingBox.max.y * unitScale;
    return <WorldIndicator worldPos={worldPos} control={control} icon={icon} />
}

function CellIndicator({ cellCoords, control, icon }: { cellCoords: Vector2, control: string, icon: string }) {
    const worldPos = GameUtils.mapToWorld(cellCoords, new Vector3());
    return <WorldIndicator worldPos={worldPos} control={control} icon={icon} />
}

export function Indicators() {

    const [indicator, setIndicator] = useState<SetIndicatorEvent | null>();

    useEffect(() => {
        const _setIndicator = (indicator: SetIndicatorEvent | null) => {
            setIndicator(indicator);
        };
        cmdSetIndicator.attach(_setIndicator);
        return () => {
            cmdSetIndicator.detach(_setIndicator);
        }

    }, []);

    return <div
        style={{
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
        }}
    >
        {(() => {
            if (!indicator) {
                return null;
            }

            switch (indicator.indicator.type) {
                case "unit": return <UnitIndicator unit={indicator.indicator.unit} control={indicator.control} icon={indicator.icon} />;
                case "cell": return <CellIndicator cellCoords={indicator.indicator.mapCoords} control={indicator.control} icon={indicator.icon} />;
            }
        })()}
    </div>
}

