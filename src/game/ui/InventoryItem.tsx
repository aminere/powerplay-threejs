import { useState } from "react";
import { Icon } from "./Icon";
import { InventoryItemInfo } from "./InventoryItemInfo";
import { ProgressBar } from "./ProgressBar";
import { uiconfig } from "./uiconfig";
import { useTooltip } from "./useTooltip";
import { tooltips } from "./Tooltips";
import { cmdShowTooltip } from "../../Events";
import { Tooltip } from "./Tooltip";

interface InventoryItemProps {
    name: string;
    value?: string;
    progress?: number;
    full?: boolean;
    tooltipId?: string;
}

export function InventoryItem(props: React.PropsWithChildren<InventoryItemProps>) {

    const [_, setTimestamp] = useState(0);

    const { tooltipId } = props;
    const tooltipRef = useTooltip(tooltipId);
    const tooltip = tooltipId ? tooltips.getContent(tooltipId) : null;
    return <div
        className={`icon ${props.full ? "item-full" : ""}`}
        style={{
            position: "relative",
            height: `${uiconfig.buttonSizeRem}rem`,
            width: `${uiconfig.buttonSizeRem}rem`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: `${2 * uiconfig.gapRem}rem`,
            textAlign: "center"
        }}

        onPointerEnter={() => {
            if (tooltipId) {
                cmdShowTooltip.post(tooltipId);
            }
        }}

        onPointerLeave={() => {
            if (tooltipId) {
                cmdShowTooltip.post(undefined);
            }
        }}
    >
        <Icon name={props.name} onError={() => setTimestamp(Date.now())} />

        {
            props.value
            &&
            <InventoryItemInfo>
                {props.value}
            </InventoryItemInfo>
        }

        {
            props.progress !== undefined
            &&
            <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%"
            }}>
                <ProgressBar progress={props.progress} />
            </div>
        }

        {props.children}

        {
            tooltip
            &&
            <Tooltip rootRef={tooltipRef}>
                {tooltip}
            </Tooltip>
        }
    </div>
}

