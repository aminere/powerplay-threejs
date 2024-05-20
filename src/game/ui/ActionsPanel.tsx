import { useEffect, useRef, useState } from "react";
import { SelectedElems, cmdSetSelectedElems, evtBuildError, evtBuildingStateChanged, evtUnitStateChanged } from "../../Events";
import { uiconfig } from "./uiconfig";
import { ActionButton } from "./ActionButton";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "../components/GameMapState";
import { IAssemblyState, IBuildingInstance, IDepotState, IFactoryState, IMineState } from "../buildings/BuildingTypes";
import { Incubators } from "../buildings/Incubators";
import { ICharacterUnit } from "../unit/ICharacterUnit";
import { IUnit } from "../unit/IUnit";
import { depots } from "../buildings/Depots";
import { UnitUtils } from "../unit/UnitUtils";
import { unitMotion } from "../unit/UnitMotion";
import { GridFiller } from "./GridFiller";
import { Icon } from "./Icon";
import { Factories } from "../buildings/Factories";
import { Mines } from "../buildings/Mines";
import { resourceConfig } from "../config/ResourceConfig";
import { Assemblies } from "../buildings/Assemblies";
import { ResourceType } from "../GameDefinitions";

function FooterActions({ children }: { children: React.ReactNode }) {
    return <div style={{
        position: "absolute",
        right: `0px`,
        bottom: `0px`,
        display: "flex",
        gap: `${uiconfig.gapRem}rem`
    }}>
        {children}
    </div>
}

interface ActionsPanelProps {
    factoryOutputsOpen: boolean;
    onShowFactoryOutputs: () => void;
    assemblyOutputsOpen: boolean;
    onShowAssemblyOutputs: () => void;
    depotOutputsOpen: boolean;
    onShowDepotOutputs: () => void;
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
                    if (GameMapState.instance.cursorOverUI) {
                        setTimeout(() => GameMapState.instance.cursorOverUI = false, 60);
                    }
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
        width: `calc(2 * ${uiconfig.paddingRem}rem + ${uiconfig.actionColumns} * ${uiconfig.buttonSizeRem}rem + ${uiconfig.actionColumns - 1} * ${uiconfig.gapRem}rem)`,
        position: "relative",
        backgroundColor: `${uiconfig.backgroundColor}`,
        padding: `${uiconfig.paddingRem}rem`        
    }}>
        <div
            style={{
                position: "relative",
                height: "100%",
                display: "grid",
                gridTemplateColumns: `repeat(${uiconfig.actionColumns}, ${uiconfig.buttonSizeRem}rem)`,
                gridAutoRows: "min-content",
                gap: `${uiconfig.gapRem}rem`
            }}
        >
            <GridFiller slots={uiconfig.actionColumns * uiconfig.actionRows} columns={uiconfig.actionColumns} />

            {(() => {
                switch (selectedElems.type) {
                    case "units": {
                        const units = selectedElems.units;
                        if (units.length === 1) {
                            const unit = units[0];
                            if (UnitUtils.isEnemy(unit)) {
                                return null;
                            }
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
                                <FooterActions>
                                    {(() => {
                                        switch (unit.type) {
                                            case "worker": {
                                                const character = unit as ICharacterUnit;
                                                if (character.resource) {
                                                    return <ActionButton
                                                        tooltipId="clear carried resource"
                                                        onClick={() => character.clearResource()}
                                                    >
                                                        clear
                                                    </ActionButton>
                                                }
                                            }
                                        }
                                    })()}
                                    <ActionButton
                                        tooltipId="kill worker"
                                        visible={GameMapState.instance.config.selectionActions.kill}
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
                        const _depotResources = building.buildingType === "depot" ? depots.getReservesPerType(building) : null;
                        const depotResources = _depotResources ? Object.keys(_depotResources!) : null;
                        return <>
                            {(() => {
                                switch (building.buildingType) {
                                    case "incubator": {
                                        return <ActionButton
                                            id="worker"
                                            tooltipId="incubate worker"
                                            onClick={() => {
                                                if (!Incubators.output(building)) {
                                                    const inputs = resourceConfig.incubatorProduction["worker"];
                                                    const requirements = inputs.map(([type, amount]) => `${amount} ${type}`).join(" + ");
                                                    evtBuildError.post(`Not enough resources to incubate (Requires ${requirements})`);
                                                }
                                            }}
                                        >
                                            <Icon name={"worker"} />
                                        </ActionButton>
                                    }

                                    case "factory": {
                                        const state = building.state as IFactoryState;
                                        return <>
                                            <ActionButton
                                                key="factory-output"
                                                id="factory-output"
                                                selected={props.factoryOutputsOpen}
                                                selectedColor="white"
                                                onClick={props.onShowFactoryOutputs}
                                            >
                                                {state.output ? "Change Output" : "Select Output"}
                                            </ActionButton>
                                            {
                                                state.output
                                                &&
                                                <ActionButton
                                                    selectedAnim={state.autoOutput}
                                                    onClick={() => {
                                                        const status = Factories.output(building);
                                                        switch (status) {
                                                            case "not-enough": {
                                                                const inputs = resourceConfig.factoryProduction[state.output!]
                                                                const requirements = inputs.map((type) => `${1} ${type}`).join(" + ");
                                                                evtBuildError.post(`Not enough resources to produce ${state.output} (Requires ${requirements})`);
                                                            }
                                                            break;
                                                            case "output-full": {
                                                                evtBuildError.post(`Not enough space to eject`);
                                                            }
                                                        }
                                                    }}
                                                    onContextMenu={() => Factories.toggleAutoOutput(building)}
                                                >
                                                    <Icon name={state.output} />
                                                </ActionButton>
                                            }
                                        </>
                                    }

                                    case "mine": {
                                        const resourceType = Mines.getResourceType(building);
                                        const state = building.state as IMineState;
                                        return <>
                                            {
                                                resourceType
                                                &&
                                                <ActionButton
                                                    key="mine-output"
                                                    selectedAnim={state.autoOutput}
                                                    onClick={() => {
                                                        const status = Mines.output(building);
                                                        switch (status) {
                                                            case "depleted": {
                                                                evtBuildError.post(`Mine is depleted`);
                                                            }
                                                                break;
                                                            case "output-full": {
                                                                evtBuildError.post(`Not enough space to eject`);
                                                            }
                                                        }
                                                    }}
                                                    onContextMenu={() => Mines.toggleAutoOutput(building)}
                                                >
                                                    <Icon name={resourceType} />
                                                </ActionButton>
                                            }
                                        </>
                                    }

                                    case "depot": {
                                        if (depotResources!.length > 0) {
                                            const state = building.state as IDepotState;
                                            if (depotResources!.length === 1) {
                                                const type = depotResources![0] as ResourceType;
                                                return <ActionButton
                                                    selectedAnim={state.autoOutput}
                                                    onClick={() => {                                                        
                                                        if (!depots.output(building, type)) {
                                                            evtBuildError.post(`Not enough space to eject`);
                                                        }
                                                    }}
                                                    onContextMenu={() => depots.toggleAutoOutput(building)}
                                                >
                                                    <Icon name={type} />
                                                </ActionButton>
                                            } else {
                                                return <>
                                                    <ActionButton
                                                        selected={props.depotOutputsOpen}
                                                        selectedColor="white"
                                                        onClick={props.onShowDepotOutputs}
                                                    >
                                                        {state.output ? "Change Output" : "Select Output"}
                                                    </ActionButton>
                                                    {
                                                        state.output
                                                        &&
                                                        <ActionButton
                                                            tooltipId={`produce ${state.output}`} // todo multiline with autooutput explanation
                                                            selectedAnim={state.autoOutput}
                                                            onClick={() => {
                                                                if (!depots.output(building, state.output!)) {
                                                                    evtBuildError.post(`Not enough space to eject`);
                                                                }                                                               
                                                            }}
                                                            onContextMenu={() => depots.toggleAutoOutput(building)}
                                                        >
                                                            <Icon name={state.output} />
                                                        </ActionButton>
                                                    }
                                                </>
                                            }
                                        }
                                    }
                                    break;

                                    case "assembly": {
                                        const state = building.state as IAssemblyState;
                                        return <>
                                            <ActionButton
                                                selected={props.assemblyOutputsOpen}
                                                selectedColor="white"
                                                onClick={props.onShowAssemblyOutputs}
                                            >
                                                {state.output ? "Change Output" : "Select Output"}
                                            </ActionButton>
                                            {
                                                state.output
                                                &&
                                                <ActionButton
                                                    tooltipId={`produce ${state.output}`}
                                                    // selectedAnim={state.autoOutput}
                                                    onClick={() => {
                                                        if (!Assemblies.output(building)) {
                                                            const inputs = resourceConfig.assemblyProduction[state.output!]
                                                            const requirements = inputs.map(([type, amount]) => `${amount} ${type}`).join(" + ");
                                                            evtBuildError.post(`Not enough resources to produce ${state.output} (Requires ${requirements})`);
                                                        }
                                                    }}
                                                    // onContextMenu={() => Factories.toggleAutoOutput(building)}
                                                >
                                                    <Icon name={state.output} />
                                                </ActionButton>
                                            }
                                        </>
                                    }
                                }
                            })()}
                            <FooterActions>
                                {
                                    (depotResources && depotResources.length > 0)
                                    &&
                                    <ActionButton 
                                        tooltipId={`clear all resources in this depot`}
                                        onClick={() => depots.clear(building)}
                                    >
                                        clear
                                    </ActionButton>
                                }
                                <ActionButton
                                    tooltipId={`destroy ${building.buildingType}`}
                                    visible={GameMapState.instance.config.selectionActions.kill}
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
                                tooltipId={`destroy conveyor`}
                                visible={GameMapState.instance.config.selectionActions.kill}
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

        </div>

        {props.children}
    </div>
}

