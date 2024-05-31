import { GameMapProps } from "../components/GameMapProps";
import { GameMapState } from "../components/GameMapState";
import { ActionButton } from "./ActionButton";

interface ITransportActionProps {
    type: "conveyor" | "rail";
    selected: boolean;
    onCleared: () => void;
    onSelected: () => void;
}

export function TransportAction(props: ITransportActionProps) {
    const gameMapState = GameMapState.instance;
    return <ActionButton
        id={props.type}
        tooltipId={props.type}
        visible={gameMapState.config.sideActions.enabled[props.type]}
        selected={props.selected}
        selectedColor="yellow"
        onClick={() => {
            if (props.selected) {
                gameMapState.action = null;
                props.onCleared();
            } else {
                GameMapProps.instance.buildableType = props.type;
                const gameMapState = GameMapState.instance;
                gameMapState.action = "building";
                gameMapState.tileSelector.color = "yellow";
                gameMapState.tileSelector.setSize(1, 1);
                gameMapState.tileSelector.resolution = 1;
                props.onSelected();
            }
        }}
    >
        <img src={`/images/icons/${props.type}.png`} />
    </ActionButton>
}

