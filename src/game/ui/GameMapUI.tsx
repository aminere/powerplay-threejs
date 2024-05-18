import { useEffect, useRef, useState } from "react";
import { IGameUIProps } from "./GameUIProps";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { GameMapState } from "../components/GameMapState";
import { GameMapProps } from "../components/GameMapProps";
import { BuildableType, BuildableTypes, BuildingType, BuildingTypes } from "../buildings/BuildingTypes";
import { SelectedElems, cmdSetSelectedElems, evtActionCleared, evtBuildError, evtGameMapUIMounted } from "../../Events";
import { buildingConfig } from "../config/BuildingConfig";
import { SelectionPanel } from "./SelectionPanel";
import { uiconfig } from "./uiconfig";
import { ActionsPanel } from "./ActionsPanel";
import { ActionSection } from "./ActionSection";
import gsap from "gsap";
import { FactoryOutputPanel } from "./FactoryOutputPanel";
import { AssemblyOutputPanel } from "./AssemblyOutputPanel";
import { DepotOutputPanel } from "./DepotOutputPanel";
import { ObjectivesPanel } from "./ObjectivePanel";
import { Indicators } from "./Indicators";
import { DebugUI } from "./DebugUI";

export function GameMapUI(_props: IGameUIProps) {
    // useEffect(() => {
    //     if (!actionsElem.current) {
    //         return;
    //     }

    //     const onGamePointerMove = () => {
    //         if (utils.isPointerLocked()) {
    //             hoveredElement.current = null;
    //             const { rawPointerPos } = props;
    //             for (const [, elem] of Object.entries(actions.current)) {
    //                 const hovered = utils.isPointInRect(rawPointerPos.x, rawPointerPos.y, elem.getBoundingClientRect());
    //                 if (hovered) {
    //                     hoveredElement.current = elem;
    //                     elem.classList.add("hovered");
    //                 } else {
    //                     elem.classList.remove("hovered");
    //                 }
    //             }
    //         }
    //     };

    //     const onGamePointerDown = () => {
    //         if (utils.isPointerLocked()) {
    //             if (hoveredElement.current) {
    //                 hoveredElement.current.classList.add("active");
    //                 hoveredElementOnDown.current = hoveredElement.current;
    //             }
    //         }
    //     };

    //     const onGamePointerUp = () => {
    //         if (utils.isPointerLocked()) {
    //             if (hoveredElement.current && hoveredElement.current === hoveredElementOnDown.current) {
    //                 const action = hoveredElement.current.id as Action;
    //                 setAction(action);
    //             }
    //             hoveredElementOnDown.current?.classList.remove("active");
    //             hoveredElementOnDown.current = null;
    //         }
    //     };

    //     document.addEventListener('pointermove', onGamePointerMove);
    //     if (props.isWeb) {
    //         document.addEventListener('pointerdown', onGamePointerDown);
    //         document.addEventListener('pointerup', onGamePointerUp);
    //     }
    //     return () => {
    //         document.removeEventListener('pointermove', onGamePointerMove);
    //         if (props.isWeb) {
    //             document.removeEventListener('pointerdown', onGamePointerDown);
    //             document.removeEventListener('pointerup', onGamePointerUp);
    //         }
    //     };
    // }, [setAction]);   

    const [error, setError] = useState<string | null>(null);
    const clearErrorRef = useRef<NodeJS.Timeout | null>(null);
    const errorTweenRef = useRef<gsap.core.Tween | null>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clearError = () => {
            errorTweenRef.current?.kill();
            errorTweenRef.current = null;
            if (clearErrorRef.current) {
                clearTimeout(clearErrorRef.current);
                clearErrorRef.current = null;
            }
        };

        const onError = (error: string) => {
            setError(error);
            clearError();
            errorRef.current!.style.opacity = "0";
            const tween = gsap.to(errorRef.current, {
                opacity: 1,
                repeat: 4,
                yoyo: true,
                duration: .4,
                onComplete: () => {
                    errorTweenRef.current = null;
                    clearErrorRef.current = setTimeout(() => {
                        errorRef.current!.style.opacity = "0";
                        setError(null);
                        clearErrorRef.current = null;
                    }, 3000);
                }
            });
            errorTweenRef.current = tween;
        };

        const onActionCleared = () => {
            clearError();
            setError(null);
            errorRef.current!.style.opacity = "0";
        };

        evtBuildError.attach(onError);
        evtActionCleared.attach(onActionCleared);
        return () => {
            evtBuildError.detach(onError);
            evtActionCleared.detach(onActionCleared);
        }
    }, []);

    const [openSection, setOpenSection] = useState<"build" | "transport" | null>(null);
    useEffect(() => {
        gameMapState.action = null;
    }, [openSection]);

    const [selectedElems, setSelectedElems] = useState<SelectedElems | null>(null);
    const [showFactoryOutputs, setShowFactoryOutputs] = useState(false);
    const [showAssemblyOutputs, setShowAssemblyOutputs] = useState(false);
    const [showDepotOutputs, setShowDepotOutputs] = useState(false);
    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
            setShowFactoryOutputs(false);
            setShowAssemblyOutputs(false);
            setShowDepotOutputs(false);
        }
        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
        }
    }, []);

    useEffect(() => {
        evtGameMapUIMounted.post();
    }, []);


    const gameMapState = GameMapState.instance;
    return <div
        style={{
            textShadow: "1px 1px 0px black",
            textTransform: "uppercase"
        }}
        onPointerEnter={() => {
            const state = GameMapState.instance;
            if (!state) {
                return;
            }
            state.cursorOverUI = true;
        }}
        onPointerLeave={() => {
            const state = GameMapState.instance;
            if (!state) {
                return;
            }
            state.cursorOverUI = false
        }}
    >

        <ObjectivesPanel />

        <div
            style={{
                position: "absolute",
                padding: `${uiconfig.paddingRem}rem`,
                backgroundColor: `${uiconfig.backgroundColor}`,
                left: "0px",
                top: "50%",
                transform: "translateY(calc(-50% + .5px))",
                display: gameMapState.enabled.sideActions.self ? "flex" : "none",
                flexDirection: "column",
                gap: `${uiconfig.gapRem}rem`,
            }}
        >
            <ActionSection
                visible={gameMapState.enabled.sideActions.enabled.build.self}
                name="build"
                actions={BuildableTypes}
                actionsVisible={gameMapState.enabled.sideActions.enabled.build.enabled}
                open={openSection === "build"}
                onSelected={action => {
                    const type = action as BuildableType;
                    GameMapProps.instance.buildableType = type;
                    const gameMapState = GameMapState.instance;
                    gameMapState.action = "building";
                    gameMapState.tileSelector.mode = "select";
                    const isBuilding = BuildingTypes.includes(type as BuildingType);
                    if (isBuilding) {
                        const size = buildingConfig[type].size;
                        gameMapState.tileSelector.setSize(size.x, size.z);
                        gameMapState.tileSelector.setBuilding(type as BuildingType);
                    } else {
                        gameMapState.tileSelector.setSize(1, 1);
                        gameMapState.tileSelector.resolution = 1;
                    }                    
                }}
                onOpen={() => setOpenSection("build")}
                onClose={() => setOpenSection(null)}
            />            
        </div>

        {
            gameMapState.enabled.bottomPanels
            &&
            <div style={{
                position: "absolute",
                bottom: "0px",
                left: "470px",
                height: `calc(${uiconfig.actionRows} * ${uiconfig.buttonSizeRem}rem + ${uiconfig.actionRows - 1} * ${uiconfig.gapRem}rem + 2 * ${uiconfig.paddingRem}rem)`,
                display: "flex",
                gap: `${uiconfig.paddingRem}rem`,
            }}>
                <SelectionPanel selectedElems={selectedElems} />
                <ActionsPanel
                    factoryOutputsOpen={showFactoryOutputs}
                    assemblyOutputsOpen={showAssemblyOutputs}
                    depotOutputsOpen={showDepotOutputs}
                    onShowFactoryOutputs={() => setShowFactoryOutputs(prev => !prev)}
                    onShowAssemblyOutputs={() => setShowAssemblyOutputs(prev => !prev)}
                    onShowDepotOutputs={() => setShowDepotOutputs(prev => !prev)}
                >
                    <FactoryOutputPanel
                        open={showFactoryOutputs}
                        selectedElems={selectedElems}
                        onOutputSelected={() => setShowFactoryOutputs(false)}
                    />
                    <AssemblyOutputPanel
                        open={showAssemblyOutputs}
                        selectedElems={selectedElems}
                        onOutputSelected={() => setShowAssemblyOutputs(false)}
                    />
                    <DepotOutputPanel
                        open={showDepotOutputs}
                        selectedElems={selectedElems}
                        onOutputSelected={() => setShowDepotOutputs(false)}
                    />
                </ActionsPanel>
            </div>
        }

        <div
            ref={errorRef}
            style={{
                position: "absolute",
                bottom: "240px",
                left: "1rem",
                color: "red",
                opacity: 0
            }}
        >
            {error ?? ""}
        </div>

        <HealthBars />
        <Indicators />
        <SelectionRect />

        {gameMapState.enabled.minimap && <Minimap />}
        <DebugUI />
    </div>
}

