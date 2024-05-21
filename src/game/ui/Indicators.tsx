import { Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { config } from "../config/config";
import { IUnit } from "../unit/IUnit";
import { useEffect, useState } from "react";
import { IndicatorPanel, SetIndicatorEvent, cmdSetIndicator } from "../../Events";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { buildingConfig } from "../config/BuildingConfig";
import { ArrowIndicator } from "./ArrowIndicator";
import { GameMapState } from "../components/GameMapState";

const { unitScale, cellSize } = config.game;
const screenPos = new Vector3();

function WorldIndicator({ worldPos, panel }: { worldPos: Vector3, panel?: IndicatorPanel }) {
    const camera = GameMapState.instance.camera;
    GameUtils.worldToScreen(worldPos, camera, screenPos);
    return <ArrowIndicator x={screenPos.x} y={screenPos.y} panel={panel} />
}

function UnitIndicator({ unit, panel }: { unit: IUnit, panel?: IndicatorPanel }) {
    const worldPos = new Vector3().copy(unit.visual.position);
    worldPos.y += unit.boundingBox.max.y * unitScale;
    return <WorldIndicator worldPos={worldPos} panel={panel} />
}

function CellIndicator({ cellCoords, panel }: { cellCoords: Vector2, panel?: IndicatorPanel }) {
    const worldPos = GameUtils.mapToWorld(cellCoords, new Vector3());
    return <WorldIndicator worldPos={worldPos} panel={panel} />
}

function BuildingIndicator({ building, panel }: { building: IBuildingInstance, panel?: IndicatorPanel }) {
    const { size } = buildingConfig[building.buildingType];
    const worldPos = GameUtils.mapToWorld(building.mapCoords, new Vector3());
    const cellOffset = -cellSize / 2;
    worldPos.x += (size.x / 2 * cellSize) + cellOffset;
    worldPos.z += (size.z / 2 * cellSize) + cellOffset;
    return <WorldIndicator worldPos={worldPos} panel={panel} />
}

function UIIndicator({ element, align }: { element: string, align?: "left" | "top" }) {
    const elem = document.getElementById(element);
    if (!elem) {
        return null;
    }
    const rect = elem.getBoundingClientRect();

    const [x, y] = (() => {
        const _align = align ?? "top";
        switch (_align) {
            case "top": return [rect.left + rect.width / 2, rect.top];
            case "left": return [rect.left, rect.top + rect.height / 2];
        }
    })();

    return <ArrowIndicator x={x} y={y} position="fixed" align={align} />
}

export function Indicators() {

    const [indicator, _setIndicator] = useState<SetIndicatorEvent | null>();

    useEffect(() => {
        const setIndicator = (event: SetIndicatorEvent | null) => {
            _setIndicator(event);
        }
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
            
            const { indicator: _indicator, panel } = indicator;            
            switch (_indicator.type) {
                case "unit": return <UnitIndicator unit={_indicator.unit} panel={panel} />;
                case "cell": return <CellIndicator cellCoords={_indicator.mapCoords} panel={panel} />;
                case "building": return <BuildingIndicator building={_indicator.building} panel={panel} />;
                case "ui": return <UIIndicator element={_indicator.element} align={_indicator.align} />;
            }
        })()}
    </>
}

