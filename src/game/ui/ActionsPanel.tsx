import { useEffect, useRef, useState } from "react";
import { SelectedElems, cmdSetSelectedElems, evtBuildError, evtBuildingStateChanged, evtUnitStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { ActionButton } from "./ActionButton";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "../components/GameMapState";
import { config } from "../config/config";
import { IBuildingInstance, IDepotState, IFactoryState } from "../buildings/BuildingTypes";
import { Incubators } from "../buildings/Incubators";
import { ICharacterUnit } from "../unit/CharacterUnit";
import { IUnit } from "../unit/Unit";
import { Depots } from "../buildings/Depots";
import { UnitUtils } from "../unit/UnitUtils";
import { unitMotion } from "../unit/UnitMotion";

function FooterActions({ children }: { children: React.ReactNode }) {
    return <div style={{
        position: "absolute",
        right: `${uiconfig.padding}rem`,
        bottom: `${uiconfig.padding}rem`,
        display: "flex",
        gap: `${uiconfig.gap}rem`
    }}>
        {children}
    </div>
}

interface ActionsPanelProps {
    onShowFactoryOutputs: () => void;
}

export function ActionsPanel(props: React.PropsWithChildren<ActionsPanelProps>) {
    const [selectedElems, setSelectedElems] = useState<SelectedElems | null>(null);
    const [, setTimestamp] = useState<number>(0);
    const killedThroughUI = useRef(false);

    useEffect(() => {
        const onBuildingStateChanged = (instance: IBuildingInstance) => {
            const selectedBuilding = selectedElems?.type === "building" ? selectedElems.building : null;
            if (instance === selectedBuilding) {
                setTimestamp(Date.now());
            }
        }

        const onUnitStateChanged = (unit: IUnit) => {
            const selectedUnits = selectedElems?.type === "units" ? selectedElems.units : null;
            if (selectedUnits && selectedUnits.length === 1) {
                if (unit === selectedUnits[0]) {
                    setTimestamp(Date.now());
                }
            }
        }

        evtBuildingStateChanged.attach(onBuildingStateChanged);
        evtUnitStateChanged.attach(onUnitStateChanged);
        return () => {
            evtBuildingStateChanged.detach(onBuildingStateChanged);
            evtUnitStateChanged.detach(onUnitStateChanged);
        }
    }, [selectedElems]);

    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
            if (!elems) {
                if (killedThroughUI.current) {
                    setTimeout(() => GameMapState.instance.cursorOverUI = false, 60);
                    killedThroughUI.current = false;
                }
            }
        };

        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
        }
    }, []);

    if (!selectedElems) {
        return null;
    }

    if (selectedElems.type === "cell") {
        const cell = selectedElems.cell;
        if (!cell.conveyor) {
            return null;
        }
    }

    const multipleSelection = selectedElems.type === "units" && selectedElems.units.length > 1;
    if (multipleSelection) {
        return null;
    }

    return <div style={{
        width: `calc(2 * ${uiconfig.padding}rem + ${uiconfig.actionsPerRow} * ${uiconfig.buttonSize}rem + ${uiconfig.actionsPerRow - 1} * ${uiconfig.gap}rem)`,
        backgroundColor: uiconfig.backgroundColor,
        padding: `${uiconfig.padding}rem`,
        position: "relative",
        display: "grid",
        gridTemplateColumns: `repeat(4, ${uiconfig.buttonSize}rem)`,
        gridAutoRows: "min-content",
        gap: `${uiconfig.gap}rem`
    }}>

        {(() => {
            switch (selectedElems.type) {
                case "units": {
                    const units = selectedElems.units;
                    if (units.length === 1) {
                        const unit = units[0];
                        return <>
                            {(() => {
                                if (!UnitUtils.isEnemy(unit)) {
                                    return <ActionButton onClick={() => { 
                                        if (unit.motionId > 0) {
                                            unitMotion.endMotion(unit);
                                            unit.onArrived();
                                        }
                                        unit.clearAction();
                                    }}>
                                        stop
                                    </ActionButton>
                                }
                            })()}
                            {(() => {
                                switch (unit.type) {
                                    case "worker": {
                                        const character = unit as ICharacterUnit;
                                        if (character.resource) {
                                            return <ActionButton onClick={() => character.clearResource()}>
                                                drop
                                            </ActionButton>
                                        }
                                    }
                                }
                            })()}
                            <FooterActions>
                                <ActionButton
                                    onClick={() => {
                                        killedThroughUI.current = true;
                                        unitsManager.killSelection();
                                    }}
                                >
                                    <img src="/images/icons/destroy.png" />
                                </ActionButton>
                            </FooterActions>
                        </>
                    }
                }
                    break;

                case "building": {
                    const building = selectedElems.building;
                    return <>
                        {(() => {
                            switch (building.buildingType) {
                                case "incubator": {
                                    return <ActionButton
                                        onClick={() => {
                                            if (!Incubators.spawn(building)) {
                                                const { workerCost } = config.incubators;
                                                evtBuildError.post(`Not enough resources, requires ${workerCost.water} water and ${workerCost.coal} coal`);
                                            }
                                        }}
                                    >
                                        incubate
                                    </ActionButton>
                                }

                                case "factory": {
                                    const state = building.state as IFactoryState;
                                    return <ActionButton onClick={props.onShowFactoryOutputs}>
                                        {state.output ? "Change Output" : "Select Output"}
                                    </ActionButton>
                                }

                                case "depot": {
                                    const state = building.state as IDepotState;
                                    if (state.amount > 0) {
                                        return <ActionButton onClick={() => Depots.clear(building)}>
                                            clear
                                        </ActionButton>
                                    }
                                }
                            }
                        })()}
                        <FooterActions>
                            <ActionButton
                                onClick={() => {
                                    killedThroughUI.current = true;
                                    unitsManager.killSelection();
                                }}
                            >
                                <img src="/images/icons/destroy.png" />
                            </ActionButton>
                        </FooterActions>
                    </>
                }

                case "cell": {
                    const conveyor = selectedElems.cell.conveyor!;
                    console.assert(conveyor);
                    return <FooterActions>
                        <ActionButton
                            onClick={() => {
                                killedThroughUI.current = true;
                                unitsManager.killSelection();
                            }}
                        >
                            <img src="/images/icons/destroy.png" />
                        </ActionButton>
                    </FooterActions>
                }
            }
            return null;
        })()}

        {props.children}

    </div>
}

