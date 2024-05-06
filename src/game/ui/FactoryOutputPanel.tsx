import { uiconfig } from "./uiconfig";
import { ResourceType, ResourceTypes } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { IBuildingInstance, IFactoryState } from "../buildings/BuildingTypes";
import { useEffect, useState } from "react";
import { Factories } from "../buildings/Factories";

interface FactoryOutputPanelProps {
    factory: IBuildingInstance;
    onOutputSelected: () => void;
}

export function FactoryOutputPanel(props: FactoryOutputPanelProps) {
    const { factory } = props;
    const [output, setOutput] = useState<ResourceType | null>((factory.state as IFactoryState).output);

    useEffect(() => {
        setOutput((factory.state as IFactoryState).output);
    }, [factory]);
    
    const height = `${uiconfig.outputRows} * ${uiconfig.buttonSize}rem + ${uiconfig.outputRows - 1} * ${uiconfig.gap}rem + 2 * ${uiconfig.padding}rem`;
    return <div
        style={{
            position: "absolute",
            left: "0px",
            top: `calc(-1 * (${height}) - ${uiconfig.gap}rem)`,
            height: `calc(${height})`,
            overflowY: "auto",
            overflowX: "hidden",
            display: "grid",
            gap: `${uiconfig.gap}rem`,
            gridTemplateColumns: `repeat(${uiconfig.outputsPerRow}, ${uiconfig.buttonSize}rem)`,
            gridAutoRows: "min-content",
            backgroundColor: uiconfig.backgroundColor,
            padding: `${uiconfig.padding}rem`,
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
                    props.onOutputSelected();
                }}
            >
                {resource}
            </ActionButton>
        })}        
    </div>
}

