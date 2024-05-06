import { useEffect, useRef, useState } from "react";
import { SelectedElems, cmdSetSelectedElems, evtBuildError, evtBuildingStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { ActionButton } from "./ActionButton";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "../components/GameMapState";
import { buildings } from "../buildings/Buildings";
import { config } from "../config/config";
import { IBuildingInstance, IFactoryState, IIncubatorState } from "../buildings/BuildingTypes";
import { Incubators } from "../buildings/Incubators";

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

function canIncubate(incubator: IIncubatorState) {
    const { workerCost } = config.incubators;
    if (incubator.reserve.water < workerCost.water) {
        return false;
    }
    if (incubator.reserve.coal < workerCost.coal) {
        return false;
    }
    return true
};

interface ActionsPanelProps {
    onToggleFactoryOutputs: () => void;
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

        evtBuildingStateChanged.attach(onBuildingStateChanged);
        return () => {
            evtBuildingStateChanged.detach(onBuildingStateChanged);
        }
    }, [selectedElems]);

    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
            if (!elems) {
                if (killedThroughUI.current) {
                    GameMapState.instance.cursorOverUI = false
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
                        return <>
                            <FooterActions>
                                <ActionButton
                                    onClick={() => {
                                        killedThroughUI.current = true;
                                        unitsManager.killSelection();
                                    }}
                                >
                                    kill
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
                                    const state = building.state as IIncubatorState;                                    
                                    return <ActionButton 
                                        onClick={() => {
                                            if (canIncubate(state)) {
                                                Incubators.spawn(building);
                                            } else {
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
                                    return <ActionButton onClick={props.onToggleFactoryOutputs}>
                                        {state.output ? state.output : "Select Output"}
                                    </ActionButton>
                                }
                            }
                        })()}
                        <FooterActions>
                            <ActionButton
                                onClick={() => {
                                    killedThroughUI.current = true;
                                    buildings.clear(building.id);
                                    cmdSetSelectedElems.post(null);
                                }}
                            >
                                destroy
                            </ActionButton>
                        </FooterActions>
                    </>
                }
            }
            return null;
        })()}

        {props.children}
        
    </div>
}

