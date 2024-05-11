import { Icon } from "./Icon";
import { InventoryItemInfo } from "./InventoryItemInfo";
import { ProgressBar } from "./ProgressBar";
import { uiconfig } from "./uiconfig";

interface InventoryItemProps {
    name: string;
    value?: string;
    progress?: number;
    full?: boolean;
}

export function InventoryItem(props: React.PropsWithChildren<InventoryItemProps>) {    
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
    >
        <Icon name={props.name} />

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
    </div>
}

