import { useState } from "react";
import { Action, Actions } from "../GameDefinitions";
import { GameMapProps } from "../components/GameMapProps";
import { GameMapState } from "../components/GameMapState";

export function DebugUI() {

    const [action, setAction] = useState<Action | null>(null);
    
    return <div
        style={{
            position: "absolute",
            top: ".5rem",
            right: ".5rem",
        }}
    >
        {Actions.map((_action, i) => {
            return <button
                key={i}
                style={{
                    border: (_action === action) ? "1px solid yellow" : undefined
                }}
                onClick={() => {

                    const gameMapState = GameMapState.instance;

                    if (action === _action) {
                        gameMapState.action = null;
                        setAction(null);
                        return;
                    }

                    setAction(_action);
                    gameMapState.action = _action;
                    let resolution = 1;
                    switch (_action) {
                        case "elevation":
                        case "flatten": {
                            const { brushSize } = GameMapProps.instance;
                            gameMapState.tileSelector.setSize(brushSize, brushSize);
                        }
                            break;
                        default:
                            gameMapState.tileSelector.setSize(1, 1);
                    }
                    gameMapState.tileSelector.resolution = resolution;
                }}
            >
                {_action}
            </button>
        })}
    </div>
}

