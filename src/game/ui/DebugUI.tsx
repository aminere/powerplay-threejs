import { useState } from "react";
import { Action, Actions } from "../GameDefinitions";
import { GameMapState, config } from "../../powerplay";
import { GameMapProps } from "../components/GameMapProps";

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
                        case "water":
                        case "flatten": {
                            const { brushSize } = GameMapProps.instance;
                            gameMapState.tileSelector.setSize(brushSize, brushSize);
                        }
                            break;

                        case "road": {
                            const { cellsPerRoadBlock } = config.game;
                            gameMapState.tileSelector.setSize(cellsPerRoadBlock, cellsPerRoadBlock);
                            resolution = cellsPerRoadBlock;
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

