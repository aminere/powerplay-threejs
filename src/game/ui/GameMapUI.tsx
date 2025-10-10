import { useEffect, useRef, useState } from "react";
import { HealthBars } from "./HealthBars";
import { SelectionRect } from "./SelectionRect";
import { Minimap } from "./Minimap";
import { GameMapState } from "../components/GameMapState";
import { BuildableType, BuildingType, BuildingTypes } from "../buildings/BuildingTypes";
import { SelectedElems, cmdOpenBuildSection, cmdOpenInGameMenu, cmdRefreshUI, cmdSetSelectedElems, cmdTutorialComplete, evtActionCleared, evtBuildError, evtFogOfWarChanged, evtGameMapUIMounted } from "../../Events";
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
import { TransportAction } from "./TransportAction";
import { TutorialComplete } from "./TutorialComplete";
import { engine } from "../../engine/Engine";
import { ElevationType, RawResourceType, RawResourceTypes, UnitType } from "../GameDefinitions";
import { ActionButton } from "./ActionButton";
import { InGameMenu } from "./InGameMenu";
import { utils } from "../../engine/Utils";

export function GameMapUI() {    

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
            setSelectedAction(null);
            errorRef.current!.style.opacity = "0";
        };

        evtBuildError.attach(onError);
        evtActionCleared.attach(onActionCleared);
        return () => {
            evtBuildError.detach(onError);
            evtActionCleared.detach(onActionCleared);
        }
    }, []);

    const [openSection, _setOpenSection] = useState<"building" | "resource" | "unit" | "elevation" | null>(null);
    const [selectedAction, setSelectedAction] = useState<"conveyor" | "rail" | "destroy" | null>(null);
    const [selectedElems, setSelectedElems] = useState<SelectedElems | null>(null);
    const [showFactoryOutputs, setShowFactoryOutputs] = useState(false);
    const [showAssemblyOutputs, setShowAssemblyOutputs] = useState(false);
    const [showDepotOutputs, setShowDepotOutputs] = useState(false);

    const setOpenSection = (section: typeof openSection) => {
        _setOpenSection(section);
        if (section) {
            gameMapState.action = null;
        }
    };

    useEffect(() => {
        const onSelectedElems = (elems: SelectedElems | null) => {
            setSelectedElems(elems);
            setShowFactoryOutputs(false);
            setShowAssemblyOutputs(false);
            setShowDepotOutputs(false);
        }

        const onOpenBuildSection = () => {
            setOpenSection("building");
        }        

        cmdOpenBuildSection.attach(onOpenBuildSection);
        cmdSetSelectedElems.attach(onSelectedElems);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
            cmdOpenBuildSection.detach(onOpenBuildSection);
        }
    }, []);

    const [, setTimestamp] = useState(Date.now());
    useEffect(() => {
        const onRefresh = () => {
            setTimestamp(Date.now());
        }
        evtGameMapUIMounted.post();
        cmdRefreshUI.attach(onRefresh);
        return () => {
            cmdRefreshUI.detach(onRefresh);
        }
    }, []);

    const [tutorialComplete, setTutorialComplete] = useState(false);
    const [inGameMenu, setInGameMenu] = useState(false);
    useEffect(() => {
        const onTutorialComplete = () => {
            setTutorialComplete(true);
        }
        const onInGameMenu = (open: boolean) => {
            setInGameMenu(open);            
        }
        cmdTutorialComplete.attach(onTutorialComplete);
        cmdOpenInGameMenu.attach(onInGameMenu);
        return () => {
            cmdTutorialComplete.detach(onTutorialComplete);
            cmdOpenInGameMenu.detach(onInGameMenu);
        }
    }, []);    

    const gameMapState = GameMapState.instance;
    if (!gameMapState) {
        return null;
    }

    return <div
        style={{
            textShadow: "1px 1px 0px black",
            textTransform: "uppercase"
        }}
        onPointerEnter={_e => {
            const state = GameMapState.instance;
            if (!state) {
                return;
            }
            state.cursorOverUI = true;
        }}
        onPointerLeave={_e => {
            const state = GameMapState.instance;
            if (!state) {
                return;
            }
            state.cursorOverUI = false
        }}
    >

        <ObjectivesPanel />
        {gameMapState.config.minimap && <Minimap />}

        <div
            className="ui"
            style={{
                position: "absolute",
                padding: `${uiconfig.paddingRem}rem`,
                backgroundColor: `${uiconfig.backgroundColor}`,
                left: "0px",
                top: "50%",
                transform: "translateY(calc(-50% + .5px))",
                display: gameMapState.config.sideActions.self ? "flex" : "none",
                flexDirection: "column",
                gap: `${uiconfig.gapRem}rem`,
            }}
        >
            <ActionSection
                visible={gameMapState.config.sideActions.enabled.build.self}
                name="building"
                actions={BuildingTypes}
                actionsVisible={gameMapState.config.sideActions.enabled.build.enabled}
                open={openSection === "building"}
                onSelected={action => {
                    const type = action as BuildableType;
                    gameMapState.tileSelector.buildableType = type;
                    gameMapState.action = "building";
                    gameMapState.tileSelector.color = "yellow";
                    const size = buildingConfig[type].size;
                    gameMapState.tileSelector.setSize(size.x, size.z);
                    gameMapState.tileSelector.setBuilding(type as BuildingType);
                }}
                onOpen={() => setOpenSection("building")}
                onClose={() => setOpenSection(null)}
            />
            <TransportAction
                type="conveyor"
                selected={selectedAction === "conveyor"}
                onSelected={() => {
                    setOpenSection(null);
                    setSelectedAction("conveyor");
                }}
                onCleared={() => {
                    setSelectedAction(null);
                }}
            />
            <TransportAction
                type="rail"
                selected={selectedAction === "rail"}
                onSelected={() => {
                    setOpenSection(null);
                    setSelectedAction("rail");
                }}
                onCleared={() => {
                    setSelectedAction(null);
                }}
            />
            {
                gameMapState.config.sandbox
                &&
                <>
                    <ActionSection                        
                        name="resource"
                        actions={RawResourceTypes}                        
                        open={openSection === "resource"}
                        onSelected={action => {
                            const type = action as RawResourceType;
                            gameMapState.tileSelector.resourceType = type;
                            gameMapState.action = "resource";    
                            gameMapState.tileSelector.color = "yellow";        
                            gameMapState.tileSelector.setSize(1, 1);
                            gameMapState.tileSelector.resolution = 1;
                        }}
                        onOpen={() => setOpenSection("resource")}
                        onClose={() => setOpenSection(null)}
                    />
                    <ActionSection
                        name="unit"
                        actions={["worker", "enemy-melee", "tank", "enemy-tank", "truck"]}
                        open={openSection === "unit"}
                        onSelected={selection => {
                            const type = selection as UnitType;
                            const gameMapState = GameMapState.instance;
                            gameMapState.action = "unit";
                            gameMapState.tileSelector.unit = type;
                            gameMapState.tileSelector.color = "yellow";
                            gameMapState.tileSelector.setSize(1, 1);
                            gameMapState.tileSelector.resolution = 1;
                        }}
                        onOpen={() => setOpenSection("unit")}
                        onClose={() => setOpenSection(null)}
                    />
                    <ActionSection
                        name="elevation"
                        actions={["increase", "decrease"]}                        
                        open={openSection === "elevation"}
                        onSelected={selection => {
                            const type = selection as ElevationType;
                            gameMapState.tileSelector.elevationType = type;
                            gameMapState.action = "elevation";    
                            gameMapState.tileSelector.color = "yellow";        
                            gameMapState.tileSelector.setSize(1, 1);
                            gameMapState.tileSelector.resolution = 1;
                        }}
                        onOpen={() => setOpenSection("elevation")}
                        onClose={() => setOpenSection(null)}
                    />
                    <ActionButton
                        tooltipId={"Fog of war"}
                        selected={GameMapState.instance.config.fogOfWar}
                        selectedColor="white"
                        onClick={() => {
                            const { fogOfWar } = GameMapState.instance.config;
                            GameMapState.instance.config.fogOfWar = !fogOfWar;
                            evtFogOfWarChanged.post(!fogOfWar);
                            setTimestamp(Date.now());
                        }}
                    >
                        <span>fog</span>
                    </ActionButton>                    
                </>                
            }
            <ActionButton
                tooltipId={"clear"}
                selected={selectedAction === "destroy"}
                selectedColor="red"
                onClick={() => {
                    if (selectedAction !== "destroy") {
                        setOpenSection(null);
                        setSelectedAction("destroy");
                        const gameMapState = GameMapState.instance;
                        gameMapState.action = "destroy";
                        gameMapState.tileSelector.color = "red";
                        gameMapState.tileSelector.setSize(1, 1);
                        gameMapState.tileSelector.resolution = 1;
                    } else {
                        gameMapState.action = null;
                        setSelectedAction(null);
                    }
                }}
            >
                <img src={`${utils.getBasePath()}images/icons/destroy.png`} />
            </ActionButton>
        </div>

        <div 
            className="ui"
            style={{
            position: "absolute",
            bottom: "0px",
            left: "470px",
            height: `calc(${uiconfig.actionRows} * ${uiconfig.buttonSizeRem}rem + ${uiconfig.actionRows - 1} * ${uiconfig.gapRem}rem + 2 * ${uiconfig.paddingRem}rem)`,
            display: gameMapState.config.bottomPanels.enabled ? "flex" : "none",
            pointerEvents: gameMapState.config.bottomPanels.inputEnabled ? "all" : "none",
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

        {engine.runtime === "editor" && <DebugUI />}
        {tutorialComplete && <TutorialComplete />}
        {inGameMenu && <InGameMenu />}
    </div>
}

