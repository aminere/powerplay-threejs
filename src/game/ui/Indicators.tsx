import { Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { config } from "../config/config";
import { IUnit } from "../unit/IUnit";
import { useEffect, useState } from "react";
import { IndicatorProps, SetIndicatorEvent, cmdSetIndicator } from "../../Events";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { buildingConfig } from "../config/BuildingConfig";
import { ArrowIndicator } from "./ArrowIndicator";
import { GameMapState } from "../components/GameMapState";

const { unitScale, cellSize } = config.game;
const screenPos = new Vector3();

function WorldIndicator({ worldPos, props }: { worldPos: Vector3, props?: IndicatorProps }) {
    const camera = GameMapState.instance.camera;
    GameUtils.worldToScreen(worldPos, camera, screenPos);
    return <ArrowIndicator x={screenPos.x} y={screenPos.y} props={props} />
}

function UnitIndicator({ unit, props }: { unit: IUnit, props?: IndicatorProps }) {
    const worldPos = new Vector3().copy(unit.visual.position);
    worldPos.y += unit.boundingBox.max.y * unitScale;
    return <WorldIndicator worldPos={worldPos} props={props} />
}

function CellIndicator({ cellCoords, props }: { cellCoords: Vector2, props?: IndicatorProps }) {
    const worldPos = GameUtils.mapToWorld(cellCoords, new Vector3());
    return <WorldIndicator worldPos={worldPos} props={props} />
}

function BuildingIndicator({ building, props }: { building: IBuildingInstance, props?: IndicatorProps }) {
    const { size } = buildingConfig[building.buildingType];
    const worldPos = GameUtils.mapToWorld(building.mapCoords, new Vector3());
    const cellOffset = -cellSize / 2;
    worldPos.x += (size.x / 2 * cellSize) + cellOffset;
    worldPos.z += (size.z / 2 * cellSize) + cellOffset;
    return <WorldIndicator worldPos={worldPos} props={props} />
}

function UIIndicator({ element }: { element: string }) {
    const elem = document.getElementById(element);
    if (!elem) {
        return null;
    }
    const rect = elem.getBoundingClientRect();
    return <ArrowIndicator x={rect.left + rect.width / 2} y={rect.top} position="fixed" />
}

export function Indicators() {

    const [indicator, setIndicator] = useState<SetIndicatorEvent | null>();

    useEffect(() => {
        cmdSetIndicator.attach(setIndicator);
        return () => {
            cmdSetIndicator.detach(setIndicator);
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
                case "build": return <BuildingIndicator building={_indicator.building} props={props} />;
                case "ui": return <UIIndicator element={_indicator.element} />;
            }
        })()}
    </>
}

