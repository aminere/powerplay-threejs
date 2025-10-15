

import { Actions, Layout } from 'flexlayout-react';
import { FocusStyleManager, OverlayToaster, Popover } from "@blueprintjs/core";
import { useEffect, useRef, useState } from "react";
import { state } from "./State";
import { Navbar } from "./Navbar";
import { addToScene, removeFromScene } from "./Utils";
import { ShowPopover, cmdFocusObject, cmdSaveEditorCamera, cmdSaveScene, cmdShowPopover, evtEngineStatusChanged, evtObjectChanged, evtSceneLoadingFinished, evtSceneLoadingStarted, evtTabRemoved } from "./Events";
import { indexedDb } from "./IndexedDb";

import { undoRedo } from "./UndoRedo";
import { LoadingIndicator } from "./LoadingIndicator";
import { ModelImporter } from "./importers/ModelImporter";
import { ImageImporter } from "./importers/ImageImporter";

import { serialization, engine, utils, Particles, evtAssetLoaded } from "powerplay-lib";

import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import 'flexlayout-react/style/dark.css';
import "./styles/Editor.css";
import "./styles/range-input.css";
import "./styles/color-input.css";
import styles from "./styles/Editor.module.css";
import { factory, model } from './EditorLayout';
import { SceneImporter } from './importers/SceneImporter';
import { Box3, MathUtils, Object3D, Points, Vector3 } from 'three';
import { ObjectImporter } from './importers/ObjectImporter';
import { ISerializedEditorCamera } from './Types';

const toaster = OverlayToaster.create({ position: "top" });
export function Editor() {

    const [loaded, setLoaded] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const [sceneLoading, setSceneLoading] = useState(false);

    useEffect(() => {
        FocusStyleManager.onlyShowFocusOnTabs();
        const load = async () => {
            await indexedDb.initialize("spider-editor", 1);
            setLoaded(true);
        };
        load();
    }, []);

    const saveEditorCamera = () => {
        const serialized: ISerializedEditorCamera = {
            camera: serialization.serialize(state.editorCamera)!,
            target: state.orbitControls.target
        };
        localStorage.setItem("editorCamera", JSON.stringify(serialized));
    };

    const focusObject = (obj: Object3D) => {
        if (state.currentCamera === state.editorCamera) {
            const bbox = new Box3().setFromObject(obj);
            const extent = Math.max(...Object.values(bbox.getSize(new Vector3())));
            const cameraFocusOffset = extent + 5;
            const targetPos = obj.getWorldPosition(new Vector3());
            const cameraPos = state.editorCamera.getWorldDirection(new Vector3())
                .multiplyScalar(-cameraFocusOffset)
                .add(targetPos);
            state.editorCamera.position.copy(cameraPos);
            state.orbitControls.target.copy(targetPos);
            state.orbitControls.update();
            saveEditorCamera();
        }
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                if (state.selection) {
                    if (state.selection !== state.camera) {
                        undoRedo.pushDeletion(state.selection);
                        removeFromScene(state.selection);
                        state.selection = null;
                    } else {
                        toaster.show({
                            message: "Cannot delete main camera",
                            intent: "danger"
                        });
                    }
                }
            } else if (e.key === "Escape") {
                state.selection = null;
                e.preventDefault();
            } else if (e.key === "z") {
                if (e.ctrlKey || e.metaKey) {
                    undoRedo.undo();                   
                    e.preventDefault();
                }
            } else if (e.key === "y") {
                if (e.ctrlKey || e.metaKey) {
                    undoRedo.redo();
                    e.preventDefault();
                }
            } else if (e.key === "F") {
                if (e.shiftKey) {
                    if (state.selection) {
                        focusObject(state.selection);
                        e.preventDefault();
                    }
                }
            } else if (e.key === "c") {
                if (e.ctrlKey || e.metaKey) {
                    if (state.selection) {
                        const serialized = serialization.serialize(state.selection);
                        if (serialized) {
                            sessionStorage.setItem("clipboard", serialized);
                            navigator.clipboard.writeText(serialized);
                        }
                    }
                }
            } else if (e.key === "v") {
                if (e.ctrlKey || e.metaKey) {
                    const text = sessionStorage.getItem("clipboard");
                    if (text) {
                        const obj = serialization.deserialize(text);

                        // ensure that particle emitters have unique geometries
                        obj.traverse(o => {
                            const particles = utils.getComponent(Particles, o);
                            if (particles) {
                                const points = o as Points;
                                console.assert(points.isPoints);                                
                                points.geometry = points.geometry.clone();
                            }
                        });

                        const parent = (() => {
                            if (state.selection) {
                                if (state.selection.uuid === obj.uuid) {
                                    return state.selection.parent!;
                                } else {
                                    return state.selection;
                                }
                            }
                            return engine.scene!;
                        })();
                        
                        obj.uuid = MathUtils.generateUUID();
                        addToScene(obj, parent);
                    }
                }
            }
        };

        const onMouseUp = () => {
            if (state.transformInProgress) {
                setTimeout(() => {
                    state.transformInProgress = false;
                    state.updateOrbitControlsStatus();
                    if (state.objectTransformed) {
                        undoRedo.pushState();
                        evtObjectChanged.post(state.transformControls.object!);
                        cmdSaveScene.post(false);
                        state.objectTransformed = false;
                    }
                }, 30);
            }
        }

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("mouseup", onMouseUp);
        }
    }, []);

    const lastSaveTime = useRef(Date.now());
    const saveRequested = useRef(false);
    const requestId = useRef<number>();
    const doSaveScene = () => {
        console.log("Saving scene..");
        engine.scene!.userData.mainCamera = state.camera!.uuid;
        const sceneData = engine.scene!.toJSON();
        indexedDb.write("files", "currentScene", sceneData);
    };

    const tick = () => {
        if (saveRequested.current) {
            const time = Date.now();
            if (time - lastSaveTime.current > 100) {
                lastSaveTime.current = time;
                saveRequested.current = false;
                doSaveScene();
            }
        }
        requestId.current = requestAnimationFrame(tick);
    };
    useEffect(() => {
        tick();
        return () => cancelAnimationFrame(requestId.current!);
    }, []);

    useEffect(() => {
        const saveScene = (immediate: boolean) => {            
            if (state.transformInProgress) {
                console.assert(false, "Cannot save scene while transform in progress");
                return;
            }
            if (state.engineStatus !== "stopped") {
                return;
            }
            if (immediate) {
                saveRequested.current = false;
                doSaveScene();
            } else {
                saveRequested.current = true;
            }
        };        

        const onEngineStatusChanged = () => {
            setDisabled(state.engineStatus === "stopping");
            if (state.engineStatus === "running") {
                undoRedo.clear();
            }
        }

        cmdSaveScene.attach(saveScene);
        evtEngineStatusChanged.attach(onEngineStatusChanged);
        cmdFocusObject.attach(focusObject);
        cmdSaveEditorCamera.attach(saveEditorCamera);
        return () => {
            cmdSaveScene.detach(saveScene);
            evtEngineStatusChanged.detach(onEngineStatusChanged);
            cmdFocusObject.detach(focusObject);
            cmdSaveEditorCamera.detach(saveEditorCamera);
        };
    }, []);

    const [lastLoadedAsset, setLastLoadedAsset] = useState<string>();
    useEffect(() => {
        const onSceneLoadingStarted = () => {
            state.sceneLoadingInProgress = true;
            setSceneLoading(true);
            setDisabled(true);
        };
        const onSceneLoadingFinished = () => {
            state.sceneLoadingInProgress = false;
            setSceneLoading(false);
            setDisabled(false);
        };
        const onAssetLoaded = (path: string) => {
            console.log(`Asset loaded: ${path}`);
            setLastLoadedAsset(path);
        }
        evtSceneLoadingStarted.attach(onSceneLoadingStarted);
        evtSceneLoadingFinished.attach(onSceneLoadingFinished);
        evtAssetLoaded.attach(onAssetLoaded);
        return () => {
            evtSceneLoadingStarted.detach(onSceneLoadingStarted);
            evtSceneLoadingFinished.detach(onSceneLoadingFinished);
            evtAssetLoaded.detach(onAssetLoaded);
        }
    }, []);
    
    const [popover, setPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const [popoverContent, setPopoverContent] = useState<JSX.Element>();    
    useEffect(() => {        
        const onPopover = (info: ShowPopover) => {
            const rc = info.target.getBoundingClientRect();
            popoverRef.current!.style.left = `${rc.left}px`;
            popoverRef.current!.style.top = `${rc.top}px`;
            popoverRef.current!.style.width = `${rc.width}px`;
            popoverRef.current!.style.height = `${rc.height}px`;
            setPopoverContent(info.content);
            setPopover(true);
        };        
        cmdShowPopover.attach(onPopover);
        return () => {
            cmdShowPopover.detach(onPopover);
        }
    }, []);    

    if (!loaded) {
        return <LoadingIndicator />;
    }

    return <>
        <div 
            className={`${styles.root} bp5-dark ${disabled ? styles.inputDisabled : ""}`}
            style={{ opacity: disabled ? 0.5 : 1 }}            
        >
            {sceneLoading && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                    color: "white",
                    fontSize: "18px",
                    textAlign: "center",
                    padding: "20px"
                }}>
                    <div style={{ marginBottom: "20px", fontSize: "24px", fontWeight: "bold" }}>
                        Scene Loading in progress
                    </div>
                    {lastLoadedAsset && (
                        <div style={{ marginBottom: "20px", fontSize: "16px", opacity: 0.8 }}>
                            Loading: {lastLoadedAsset}
                        </div>
                    )}
                    <div style={{ fontSize: "16px", opacity: 0.9 }}>
                        When it's done, start placing buildings to dissipate the fog of war!
                    </div>
                </div>
            )}
            <Navbar />
            <div className={styles.editor}>
                <Layout
                    realtimeResize={true}
                    model={model}
                    factory={factory}
                    onAction={action => {
                        switch (action.type) {
                            case Actions.DELETE_TAB: {
                                evtTabRemoved.post(action.data.node);
                            }
                            break;
                        }
                        return action;
                    }}
                    onModelChange={(model, action) => {
                        if (action.type === Actions.SET_ACTIVE_TABSET) {
                            return;
                        }
                        setTimeout(() => {
                            const { width, height } = engine.renderer!.domElement.parentElement!.getBoundingClientRect();
                            engine.setScreenSize(width, height);
                            utils.updateCameraAspect(state.currentCamera!, width, height);
                        }, 10);
                        localStorage.setItem("flexlayout-react", JSON.stringify(model.toJson()));                       
                    }}
                />
            </div>            
            <div
                style={{ position: "absolute", pointerEvents: "none" }}
                ref={popoverRef}
            >
                <Popover
                    // usePortal={false}
                    isOpen={popover}
                    content={popoverContent}
                    renderTarget={props => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { isOpen, ...targetProps } = props;
                        return <div {...targetProps} style={{ width: "100%", height: "100%" }} />
                    }}
                    onInteraction={(nextOpenState) => setPopover(nextOpenState)}
                />
            </div>
        </div>
        <ModelImporter />
        <ImageImporter />
        <SceneImporter />
        <ObjectImporter />
    </>
}

