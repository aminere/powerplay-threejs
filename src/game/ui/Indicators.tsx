import { Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { GameMapState } from "../components/GameMapState";
import { config } from "../config/config";
import { IUnit } from "../unit/IUnit";
import { useEffect, useState } from "react";
import { IndicatorProps, SetIndicatorEvent, cmdSetIndicator } from "../../Events";
import { uiconfig } from "./uiconfig";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { buildingConfig } from "../config/BuildingConfig";
import { InlineIcon } from "./InlineIcon";

const screenPos = new Vector3();
const { unitScale, cellSize } = config.game;

interface WorldIndicatorProps {
    worldPos: Vector3;
    props: IndicatorProps;
}

function WorldIndicator(props: WorldIndicatorProps) {
    const camera = GameMapState.instance.camera;
    GameUtils.worldToScreen(props.worldPos, camera, screenPos);
    const { action, actionIcon, control, icon } = props.props;
    return <div
        className="float"
        style={{
            position: "absolute",
            left: `${screenPos.x}px`,
            top: `${screenPos.y}px`,
            minWidth: "max-content",
            pointerEvents: "none",
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
            display: "flex",
            gap: `${uiconfig.gapRem}rem`,
        }}>
            <div style={{
                padding: `${uiconfig.paddingRem}rem`,
                backgroundColor: `${uiconfig.backgroundColor}`,
                display: "flex",
                gap: ".5rem",
                alignItems: "flex-end"
            }}>
                {action} {actionIcon && <InlineIcon name={actionIcon} />}
            </div>
            <div style={{
                position: "relative",
                padding: `${uiconfig.paddingRem}rem`,
                backgroundColor: `${uiconfig.backgroundColor}`,
                display: "flex",
                gap: ".5rem",
                alignItems: "flex-end"
            }}>
                {control}
                <InlineIcon name={icon} />
            </div>
        </div>
    </div>
}

function UnitIndicator({ unit, props }: { unit: IUnit, props: IndicatorProps }) {
    const worldPos = new Vector3().copy(unit.visual.position);
    worldPos.y += unit.boundingBox.max.y * unitScale;
    return <WorldIndicator worldPos={worldPos} props={props} />
}

function CellIndicator({ cellCoords, props }: { cellCoords: Vector2, props: IndicatorProps }) {
    const worldPos = GameUtils.mapToWorld(cellCoords, new Vector3());
    return <WorldIndicator worldPos={worldPos} props={props} />
}

function BuildingIndicator({ building, props }: { building: IBuildingInstance, props: IndicatorProps }) {
    const { size } = buildingConfig[building.buildingType];
    const worldPos = GameUtils.mapToWorld(building.mapCoords, new Vector3());
    const cellOffset = -cellSize / 2;
    worldPos.x += (size.x / 2 * cellSize) + cellOffset;
    worldPos.z += (size.z / 2 * cellSize) + cellOffset;
    return <WorldIndicator worldPos={worldPos} props={props} />
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

    return <>
        {(() => {
            if (!indicator) {
                return null;
            }

            const { indicator: _indicator, props } = indicator;
            switch (_indicator.type) {
                case "unit": return <UnitIndicator unit={_indicator.unit} props={props} />;
                case "cell": return <CellIndicator cellCoords={_indicator.mapCoords} props={props} />;
                case "building": return <BuildingIndicator building={_indicator.building} props={props} />;
            }
        })()}
    </>
}

