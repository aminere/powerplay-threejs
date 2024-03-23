import { useCallback, useEffect, useRef, useState } from "react";
import { Action, Actions } from "../GameDefinitions";

import styles from './GameMapUI.module.css';
import { utils } from "../../engine/Utils";
import { IGameUIProps } from "./GameUIProps";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { engineState } from "../../engine/EngineState";
import { GameMap } from "../components/GameMap";
import { config } from "../config";
import { IBuildingInstance } from "../GameTypes";
import { cmdSetSelectedElems } from "../../Events";
import { GameMapState } from "../components/GameMapState";

export function GameMapUI(props: IGameUIProps) {
    const actionsElem = useRef<HTMLDivElement>(null);
    const hoveredElement = useRef<HTMLElement | null>(null);
    const hoveredElementOnDown = useRef<HTMLElement | null>(null);    
    const actions = useRef<Record<string, HTMLElement>>({});
    const [selectedAction, setSelectedAction] = useState<Action | null>(null);
    const buildingRef = useRef<HTMLDivElement>(null);

    const setAction = useCallback((newAction: Action) => {
        const gameMapState = GameMapState.instance;
        if (newAction === selectedAction) {
            gameMapState.action = null;
            setSelectedAction(null);
        } else {
            gameMapState.action = newAction;
            setSelectedAction(newAction);

            if (newAction === "building") {
                const gamemap = engineState.getComponents(GameMap)[0];
                const buildingId = gamemap.component.props.buildingId;
                const building = config.buildings[buildingId];
                gameMapState.tileSelector.setSize(building.size.x, building.size.z);
            } else {
                gameMapState.tileSelector.setSize(1, 1);
            }

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
            const buildingUi = buildingRef.current!;
            if (building) {
                buildingUi.style.display = "block";
            } else {
                buildingUi.style.display = "none";
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
            onPointerEnter={() => GameMapState.instance.cursorOverUI = true}
            onPointerLeave={() => GameMapState.instance.cursorOverUI = false}
        >
            {Actions.map(action => {
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
            ref={buildingRef}
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
                onClick={() => {
                    const gamemap = engineState.getComponents(GameMap)[0];
                    gamemap.component.spawnUnitRequest();
                }}
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

