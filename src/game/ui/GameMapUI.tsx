import { useCallback, useEffect, useRef, useState } from "react";
import { Action, Actions } from "../GameDefinitions";

import styles from './GameMapUI.module.css';
import { utils } from "../../engine/Utils";
import { IGameUIProps } from "./GameUIProps";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { cmdSetSelectedElems } from "../../Events";
import { GameMapState } from "../components/GameMapState";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapProps } from "../components/GameMapProps";
import { IBuildingInstance, buildingSizes } from "../buildings/BuildingTypes";
import { config } from "../config";

export function GameMapUI(props: IGameUIProps) {
    const actionsElem = useRef<HTMLDivElement>(null);
    const hoveredElement = useRef<HTMLElement | null>(null);
    const hoveredElementOnDown = useRef<HTMLElement | null>(null);
    const actions = useRef<Record<string, HTMLElement>>({});
    const [selectedAction, setSelectedAction] = useState<Action | null>(null);
    const buildingUi = useRef<HTMLDivElement>(null);

    const setAction = useCallback((newAction: Action) => {
        const gameMapState = GameMapState.instance;
        if (newAction === selectedAction) {
            gameMapState.action = null;
            setSelectedAction(null);
        } else {
            gameMapState.action = newAction;
            setSelectedAction(newAction);

            let resolution = 1;
            switch (newAction) {
                case "building": {
                    const buildingType = GameMapProps.instance.buildingType;
                    const size = buildingSizes[buildingType];
                    gameMapState.tileSelector.setSize(size.x, size.z);
                }
                break;

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
        }

    }, [selectedAction]);

    useEffect(() => {
        if (!actionsElem.current) {
            return;
        }
        const onGamePointerMove = () => {
            if (utils.isPointerLocked()) {
                hoveredElement.current = null;
                const { rawPointerPos } = props;
                for (const [, elem] of Object.entries(actions.current)) {
                    const hovered = utils.isPointInRect(rawPointerPos.x, rawPointerPos.y, elem.getBoundingClientRect());
                    if (hovered) {
                        hoveredElement.current = elem;
                        elem.classList.add("hovered");
                    } else {
                        elem.classList.remove("hovered");
                    }
                }
            }
        };

        const onGamePointerDown = () => {
            if (utils.isPointerLocked()) {
                if (hoveredElement.current) {
                    hoveredElement.current.classList.add("active");
                    hoveredElementOnDown.current = hoveredElement.current;
                }
            }
        };

        const onGamePointerUp = () => {
            if (utils.isPointerLocked()) {
                if (hoveredElement.current && hoveredElement.current === hoveredElementOnDown.current) {
                    const action = hoveredElement.current.id as Action;
                    setAction(action);
                }
                hoveredElementOnDown.current?.classList.remove("active");
                hoveredElementOnDown.current = null;
            }
        };

        document.addEventListener('pointermove', onGamePointerMove);
        if (props.isWeb) {
            document.addEventListener('pointerdown', onGamePointerDown);
            document.addEventListener('pointerup', onGamePointerUp);
        }
        return () => {
            document.removeEventListener('pointermove', onGamePointerMove);
            if (props.isWeb) {
                document.removeEventListener('pointerdown', onGamePointerDown);
                document.removeEventListener('pointerup', onGamePointerUp);
            }
        };
    }, [setAction]);

    useEffect(() => {

        const onSelectedElems = ({ building }: {
            building?: IBuildingInstance;
        }) => {
            const _buildingUi = buildingUi.current!;
            if (building) {
                _buildingUi.style.display = "block";
            } else {
                _buildingUi.style.display = "none";
            }
        };

        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
        }

    }, []);

    return <div className={styles.root}>
        <div 
            ref={actionsElem} 
            className={styles.actions}
            onPointerEnter={() => {
                if (!GameMapState.instance) {
                    return;
                }
                GameMapState.instance.cursorOverUI = true;
            }}
            onPointerLeave={() => {
                if (!GameMapState.instance) {
                    return;
                }
                GameMapState.instance.cursorOverUI = false
            }}
        >
            {Actions.map(action => {

                const ignoredActions: Action[] = [
                    "terrain"
                ];
                
                if (ignoredActions.includes(action)) {
                    return null;
                }

                const selected = selectedAction === action;
                return <div
                    id={action}
                    key={action}
                    className={`${styles.action} clickable ${selected ? styles.selected : ''}`}
                    ref={e => actions.current[action] = e as HTMLElement}
                    onClick={() => {
                        if (!utils.isPointerLocked()) {
                            setAction(action);
                        }
                    }}
                >
                    <div>
                        {action}
                    </div>
                </div>
            })}
        </div>

        <div
            ref={buildingUi}
            style={{
                position: "absolute",
                right: "1rem",
                bottom: ".5rem",
                pointerEvents: "all",
                display: "none"
            }}
            onPointerEnter={() => GameMapState.instance.cursorOverUI = true}
            onPointerLeave={() => GameMapState.instance.cursorOverUI = false}
        >
            <div
                className={`${styles.action} clickable`}
                style={{
                    width: "4rem",
                    height: "4rem",
                }}
                onClick={() => unitsManager.spawnUnitRequest()}
            >
                <div>
                    unit
                </div>
            </div>
        </div>        

        <HealthBars />
        <SelectionRect />
        <Minimap />
    </div>
}

