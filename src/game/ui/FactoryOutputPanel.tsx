import { uiconfig } from "./uiconfig";
import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { IBuildingInstance, IFactoryState } from "../buildings/BuildingTypes";
import { useEffect, useState } from "react";
import { Factories } from "../buildings/Factories";

const height = 200;

interface FactoryOutputPanelProps {
    factory: IBuildingInstance;
}

export function FactoryOutputPanel(props: FactoryOutputPanelProps) {
    const { factory } = props;
    const [output, setOutput] = useState<ResourceType | null>((factory.state as IFactoryState).output);

    useEffect(() => {
        setOutput((factory.state as IFactoryState).output);
    }, [factory]);

    return <div
        style={{
            position: "absolute",
            left: "0px",
            top: `calc(-${height}px - ${uiconfig.gap}rem)`,
            height: `${height}px`,
            overflow: "auto",
            display: "grid",
            gap: `${uiconfig.gap}rem`,
            gridTemplateColumns: `repeat(7, ${uiconfig.buttonSize}rem)`,
            gridAutoRows: "min-content",
            backgroundColor: uiconfig.backgroundColor,
        }}
        onWheel={e => e.stopPropagation()}
    >
        {ResourceTypes.map(resource => {
            return <ActionButton
                key={resource}
                selected={output === resource}
                onClick={() => {
                    setOutput(resource);
                    Factories.setOutput(factory, resource);
                }}
            >
                {resource}
            </ActionButton>
        })}
    </div>
}

