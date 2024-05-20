import { VehicleType, VehicleTypes } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { IAssemblyState, IBuildingInstance } from "../buildings/BuildingTypes";
import { useEffect, useState } from "react";
import { SelectedElems } from "../../Events";
import { Icon } from "./Icon";
import { Assemblies } from "../buildings/Assemblies";
import { OutputPanel } from "./OutputPanel";

interface AssemblyOutputPanelProps {
    open: boolean;
    selectedElems: SelectedElems | null;
    onOutputSelected: () => void;
}

function getAssembly(selection: SelectedElems | null) {
    if (selection?.type === "building") {
        const building = selection.building;
        if (building.buildingType === "assembly") {
            return building;
        }
    }
    return null;
}

function getAssemblyState(assembly: IBuildingInstance | null) {
    return (assembly?.state as IAssemblyState) ?? null;
}

export function AssemblyOutputPanel(props: AssemblyOutputPanelProps) {
    const { selectedElems } = props;
    const [assembly, setAssembly] = useState<IBuildingInstance | null>(getAssembly(selectedElems));
    const [output, setOutput] = useState<VehicleType | null>(getAssemblyState(getAssembly(selectedElems))?.output ?? null);

    useEffect(() => {
        const _assembly = getAssembly(selectedElems);
        setAssembly(_assembly);
        setOutput(getAssemblyState(_assembly)?.output ?? null);
    }, [selectedElems]);

    if (!assembly) {
        return null;
    }

    return <OutputPanel open={props.open}>
        {VehicleTypes.map(vehicle => {
                return <ActionButton
                    key={vehicle}
                    tooltipId={vehicle}
                    selected={output === vehicle}
                    onClick={() => {
                        setOutput(vehicle);
                        Assemblies.setOutput(assembly, vehicle);
                        props.onOutputSelected();
                    }}
                >
                    <Icon name={vehicle} />
                </ActionButton>
            })}
    </OutputPanel>
}

