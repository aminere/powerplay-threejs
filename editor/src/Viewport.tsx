
import { useCallback, useEffect, useRef, useState } from 'react';
import { state } from './State';

import { loadDefaultGameScene } from './Utils';
import { cmdRefreshTree, cmdRequestScreenshot, cmdSaveScene, cmdToggleViewportControls, evtEngineStatusChanged, evtObjectChanged, evtObjectChanging, evtObjectCreated, evtObjectDeleted, evtObjectSelected, evtSceneLoadingFinished, evtSceneLoadingStarted, evtShowFPSChanged, evtShowStatsChanged } from './Events';
import { Button, Icon, Menu, MenuItem, Popover, Tooltip } from '@blueprintjs/core';
import { indexedDb } from './IndexedDb';

import { undoRedo } from './UndoRedo';
import { Camera, CameraHelper, DirectionalLight, GridHelper, Object3D, Raycaster, SkeletonHelper, SkinnedMesh, Vector2, WebGLInfo } from 'three';
import { GameUI, ISceneInfo, EngineStats, time, engine, input, utils, SphereCollider, evtSceneCreated, config, evtAssetLoaded } from 'powerplay-lib';

import Stats from "three/examples/jsm/libs/stats.module.js";
import styles from "./styles/Viewport.module.css";
import { ColliderHelper } from './ColliderHelper';
import "powerplay-lib/lib/style.css";

const raycaster = new Raycaster();
const normalizedPointer = new Vector2();
type TransformType = "translate" | "rotate" | "scale";

async function loadScene() {
    return indexedDb.read("files", "currentScene")
        .then(sceneData => {
            engine.parseScene(sceneData);
        });
}

async function createScene() {
    try {
        await loadScene();
    } catch (e) {
        if (e) {
            console.warn(e);
        }
        console.log("creating new scene");
        // engine.parseScene(createNewScene().toJSON());
        engine.parseScene(await loadDefaultGameScene());
    }    
}

function ViewportControls({ children }: { children: React.ReactNode }) {
    return <div
        onPointerDown={e => e.stopPropagation()}
        onPointerMove={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
    >
        {children}
    </div>
}

export function Viewport() {
    const root = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showStats, setShowStats] = useState(state.showStats);
    const [inGame, setInGame] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [forceEditorCamera, setForceEditorCamera] = useState(state.forceEditorCamera);
    const [localTransform, setLocalTransform] = useState(false);
    const [lightFrustums, setLightFrustums] = useState<CameraHelper[]>([]);
    const [showLightFrustums, setShowLightFrustums] = useState((localStorage.getItem("showLightFrustums") ?? "true") === "true");
    const [skeletons, setSkeletons] = useState<SkeletonHelper[]>([]);
    const [showSkeletons, setShowSkeletons] = useState((localStorage.getItem("showSkeletons") ?? "true") === "true");
    const [colliders, setColliders] = useState<ColliderHelper[]>([]);
    const [showColliders, setShowColliders] = useState((localStorage.getItem("showColliders") ?? "true") === "true");
    const initialShowGrid = (localStorage.getItem("showGrid") ?? "true") === "true";
    const [showGrid, setShowGrid] = useState(initialShowGrid);
    const selectionId = useRef<string>();
    const fps = useRef(new Stats());
    const renderInfo = useRef<WebGLInfo>();
    const gridHelper = useRef<GridHelper>();
    const forceEngineStep = useRef(false);

    useEffect(() => {
        const container = root.current!;

        if (!engine.renderer) {
            const { width, height } = container.getBoundingClientRect();
            engine.init(width, height, "editor");
            createScene();
            setLocalTransform(state.transformControls.space === "local");

            const _gridHelper = new GridHelper(1000 * config.game.cellSize, 1000, 0x888888, 0x444444);
            state.editorScene.add(_gridHelper);
            _gridHelper.visible = initialShowGrid;
            gridHelper.current = _gridHelper;
        }

        console.assert(container.children.length === 0);
        container.appendChild(engine.renderer!.domElement);

        const _fps = fps.current;
        _fps.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        container.appendChild(_fps.dom);
        _fps.dom.style.position = "absolute";
        _fps.dom.style.left = "unset";
        _fps.dom.style.right = "0";
        _fps.dom.style.display = state.showFPS ? "block" : "none";
        return () => {
            container.removeChild(engine.renderer!.domElement);
            container.removeChild(_fps.dom);
            setActive(false);
        }
    }, []);

    useEffect(() => {
        const onShowFPSChanged = (show: boolean) => {
            fps.current.dom.style.display = show ? "block" : "none";
        };
        const onShowRenderStatsChanged = (show: boolean) => {
            setShowStats(show);
        };
        const toggleControls = () => {
            setShowControls(prev => !prev);
        };
        evtShowFPSChanged.attach(onShowFPSChanged);
        evtShowStatsChanged.attach(onShowRenderStatsChanged);
        cmdToggleViewportControls.attach(toggleControls);
        return () => {
            evtShowFPSChanged.detach(onShowFPSChanged);
            evtShowStatsChanged.detach(onShowRenderStatsChanged);
            cmdToggleViewportControls.detach(toggleControls);
        }
    }, []);

    useEffect(() => {
        const onResize = () => {
            setTimeout(() => {
                const { width, height } = root.current!.getBoundingClientRect();
                engine.setScreenSize(width, height);
                utils.updateCameraAspect(state.currentCamera!, width, height);
            }, 10);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const animationFrameId = useRef<number>(0);
    const refreshTreeTimer = useRef<number>(-1);

    const screenshotRequest = useRef(false);
    useEffect(() => {
        const onRequestScreenshot = () => {
            screenshotRequest.current = true;
        };
        cmdRequestScreenshot.attach(onRequestScreenshot);
        return () => {
            cmdRequestScreenshot.detach(onRequestScreenshot);
        }
    }, []);

    const timeSinceLastAssetLoaded = useRef(0);
    useEffect(() => {
        const onAssetLoaded = () => {            
            timeSinceLastAssetLoaded.current = 0;
        }
        evtAssetLoaded.attach(onAssetLoaded);
        return () => {
            evtAssetLoaded.detach(onAssetLoaded);
        }
    }, []);

    const update = useCallback(() => {
        if (!active) {
            return;
        }

        fps.current.begin();

        const engineStep = state.engineStatus === "running" || forceEngineStep.current;
        if (engineStep) {
            engine.update();

            if (refreshTreeTimer.current < 0) {
                cmdRefreshTree.post();

                for (const helper of lightFrustums) {
                    helper.matrix = helper.camera.matrixWorld;
                    helper.update();
                }

                refreshTreeTimer.current = 1;
            } else {
                refreshTreeTimer.current -= time.deltaTime;
            }

            if (state.sceneLoadingInProgress) {
                timeSinceLastAssetLoaded.current += time.deltaTime;
                if (timeSinceLastAssetLoaded.current > 1) {
                    state.sceneLoadingInProgress = false;
                    evtSceneLoadingFinished.post();
                }
            }
        }

        engine.renderer!.info.reset();
        engine.render(state.currentCamera!);

        if (engineStep) {
            engine.renderUI();

            if (forceEngineStep.current) {
                forceEngineStep.current = false;
                time.setFixed(false);
            }
        }

        renderInfo.current = JSON.parse(JSON.stringify(engine.renderer!.info));
        engine.renderer!.render(state.editorScene, state.currentCamera!);
        fps.current.end();

        if (screenshotRequest.current) {
            const canvas = engine.renderer!.domElement;
            const link = document.createElement('a');
            const date = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
            link.setAttribute('download', `screenshot-${date}.png`);
            link.setAttribute('href', canvas.toDataURL("image/png"));
            link.click();
            screenshotRequest.current = false;
        }

        animationFrameId.current = requestAnimationFrame(update);
    }, [active, lightFrustums]);

    useEffect(() => {
        update();
        return () => {
            cancelAnimationFrame(animationFrameId.current);
        }
    }, [update]);

    const [showTransformControls, setShowTransformControls] = useState(false);
    const [transformType, setTransformType] = useState<TransformType | null>("translate");

    useEffect(() => {
        const onCreated = (obj: Object3D) => {
            const _camera = obj as Camera;
            if (_camera.isCamera) {
                const { width, height } = root.current!.getBoundingClientRect();
                utils.updateCameraAspect(_camera, width, height);
            }
        };

        const onObjectSelected = (obj: Object3D | null) => {
            setShowTransformControls(obj !== null);
            if (obj) {
                onCreated(obj);
            }
        };

        const onObjectCreated = (obj: Object3D) => obj.traverse(onCreated);
        evtObjectCreated.attach(onObjectCreated);
        evtObjectSelected.attach(onObjectSelected);
        return () => {
            evtObjectCreated.detach(onObjectCreated);
            evtObjectSelected.detach(onObjectSelected);
        };
    }, []);

    useEffect(() => {
        const onEngineStatusChanged = () => {
            setIsPlaying(state.engineStatus === "running");
            setIsPaused(state.engineStatus === "paused");
        }

        const onSceneCreated = (info: ISceneInfo) => {
            const { mainCamera } = info;
            state.camera = mainCamera;
            const container = root.current!;
            const { width, height } = container.getBoundingClientRect();
            engine.setScreenSize(width, height);
            utils.updateCameraAspect(state.currentCamera!, width, height);
            if (selectionId.current) {
                const obj = engine.scene!.getObjectByProperty("uuid", selectionId.current);
                state.selection = obj ?? null;
                selectionId.current = undefined;
            }
            undoRedo.clear();

            const newLightFrustums: CameraHelper[] = [];
            const skinnedMeshes: SkinnedMesh[] = [];
            const _colliders: Object3D[] = [];
            engine.scene!.traverse(obj => {
                const light = obj as DirectionalLight;
                const skinnedMesh = obj as SkinnedMesh;
                if (light.isDirectionalLight) {
                    const helper = new CameraHelper(light.shadow.camera);
                    helper.name = light.id.toString();
                    helper.visible = (localStorage.getItem("showLightFrustums") ?? "true") === "true";
                    state.editorScene.add(helper);
                    newLightFrustums.push(helper);
                } else if (skinnedMesh.isSkinnedMesh) {
                    skinnedMeshes.push(skinnedMesh);
                }

                if (obj.userData.components) {
                    const components = Object.keys(obj.userData.components);
                    if (components.includes("SphereCollider")) {
                        _colliders.push(obj);
                    }
                }
            });

            setLightFrustums(prev => {
                for (const helper of prev) {
                    helper.removeFromParent();
                }
                return newLightFrustums;
            });

            setSkeletons(prev => {
                for (const helper of prev) {
                    helper.removeFromParent();
                }
                return skinnedMeshes.map(mesh => {
                    const rootBone = mesh.skeleton.bones[0];
                    const helper = new SkeletonHelper(rootBone);
                    helper.name = mesh.id.toString();
                    helper.visible = (localStorage.getItem("showSkeletons") ?? "true") === "true";
                    state.editorScene.add(helper);
                    return helper;
                });
            });

            setColliders(prev => {
                for (const collider of prev) {
                    collider.removeFromParent();
                }
                return _colliders.reduce((prev, cur) => {
                    for (const [type, value] of Object.entries(cur.userData.components)) {
                        switch (type) {
                            case "SphereCollider": {
                                const sphereCollider = value as SphereCollider;
                                const helper = new ColliderHelper(cur, sphereCollider);
                                helper.visible = (localStorage.getItem("showColliders") ?? "true") === "true";
                                state.editorScene.add(helper);
                                prev.push(helper);
                            }
                            break;
                        }
                    }
                    return prev;
                }, [] as ColliderHelper[]);
            });        

            setActive(true);
        };

        evtEngineStatusChanged.attach(onEngineStatusChanged);
        evtSceneCreated.attach(onSceneCreated);
        return () => {
            evtEngineStatusChanged.detach(onEngineStatusChanged);
            evtSceneCreated.detach(onSceneCreated);
        };
    }, []);

    // Light frustums
    useEffect(() => {
        const onCreated = (obj: Object3D) => {
            const light = obj as DirectionalLight;
            if (light.isDirectionalLight) {
                const helper = new CameraHelper(light.shadow.camera);
                helper.visible = showLightFrustums;
                helper.name = light.id.toString();
                state.editorScene.add(helper);
                setLightFrustums(prev => prev.concat(helper));
            }
        };
        const onDeleted = (obj: Object3D) => {
            const light = obj as DirectionalLight;
            if (light.isDirectionalLight) {
                const id = light.id.toString();
                for (const helper of lightFrustums) {
                    if (helper.name === id) {
                        helper.removeFromParent();
                    }
                }
                setLightFrustums(prev => prev.filter(f => f.name !== id));
            }
        }

        const onObjectCreated = (obj: Object3D) => obj.traverse(onCreated);
        const onObjectDeleted = (obj: Object3D) => obj.traverse(onDeleted);
        const onObjectChanged = (obj: Object3D) => {
            const light = obj as DirectionalLight;
            if (light.isDirectionalLight) {
                const id = light.id.toString();
                for (const helper of lightFrustums) {
                    if (helper.name === id) {
                        helper.camera = light.shadow.camera;
                        helper.matrix = light.shadow.camera.matrixWorld;
                        helper.update();
                    }
                }
                utils.updateDirectionalLightTarget(light);
            }
        };
        evtObjectCreated.attach(onObjectCreated);
        evtObjectDeleted.attach(onObjectDeleted);
        evtObjectChanged.attach(onObjectChanged);
        evtObjectChanging.attach(onObjectChanged);
        return () => {
            evtObjectCreated.detach(onObjectCreated);
            evtObjectDeleted.detach(onObjectDeleted);
            evtObjectChanged.detach(onObjectChanged);
            evtObjectChanging.detach(onObjectChanged);
        }
    }, [lightFrustums, showLightFrustums]);

    // Skeletons
    useEffect(() => {
        const onCreated = (obj: Object3D) => {
            const skinnedMeshes = obj.getObjectsByProperty("type", "SkinnedMesh") as SkinnedMesh[];
            for (const mesh of skinnedMeshes) {
                const rootBone = mesh.skeleton.bones[0];
                const helper = new SkeletonHelper(rootBone);
                helper.name = mesh.id.toString();
                helper.visible = showSkeletons;
                state.editorScene.add(helper);
                setSkeletons(prev => prev.concat(helper));
            }
        };
        const onDeleted = (obj: Object3D) => {
            const skinnedMeshes = obj.getObjectsByProperty("type", "SkinnedMesh");
            for (const mesh of skinnedMeshes) {
                const id = mesh.id.toString();
                const helper = skeletons.find(f => f.name === id);
                helper?.removeFromParent();
                setSkeletons(prev => prev.filter(f => {
                    if (f.name === id) {
                        return false;
                    } else {
                        const skinnedMesh = engine.scene!.getObjectById(Number(f.name));
                        return skinnedMesh !== null;
                    }
                }));
            }
        }
        evtObjectCreated.attach(onCreated);
        evtObjectDeleted.attach(onDeleted);
        return () => {
            evtObjectCreated.detach(onCreated);
            evtObjectDeleted.detach(onDeleted);
        }
    }, [showSkeletons, skeletons]);

    // Colliders
    useEffect(() => {
        const onCreated = (obj: Object3D) => {
            const sphereCollider = obj.userData.components?.["SphereCollider"] as SphereCollider;
            if (sphereCollider) {
                const helper = new ColliderHelper(obj, sphereCollider);
                helper.visible = showColliders;
                state.editorScene.add(helper);
                setColliders(prev => prev.concat(helper));
            }            
        };
        const onDeleted = (obj: Object3D) => {            
            for (const collider of colliders) {
                if (collider.root === obj) {
                    collider.removeFromParent();
                }
            }
            setColliders(prev => prev.filter(p => p.root !== obj));
        }
        evtObjectCreated.attach(onCreated);
        evtObjectDeleted.attach(onDeleted);
        return () => {
            evtObjectCreated.detach(onCreated);
            evtObjectDeleted.detach(onDeleted);
        }
    }, [showColliders, colliders]);

    const touchPos = useRef(new Vector2());
    const rawTouchPos = useRef(new Vector2());
    const setTouchPos = (x: number, y: number) => {
        const rc = root.current!.getBoundingClientRect();
        rawTouchPos.current.set(x, y);
        touchPos.current.set(x - rc.x, y - rc.y);
        input.touchPos = touchPos.current;
    };

    const clickedInCanvas = (e: React.PointerEvent<HTMLElement>) => {
        const rc = root.current!.getBoundingClientRect();
        return utils.isPointInRect(e.clientX, e.clientY, rc);
    }

    const _setTransformType = useCallback((type: TransformType) => {
        const newType = transformType !== type ? type : null;
        setTransformType(newType);
        state.transformControls.setMode(type);
        state.transformControls.scale.setScalar(newType !== null ? 1 : 0);
    }, [transformType]);

    // const elementIsCanvas = (e: React.PointerEvent<HTMLElement>) => {
    //     return (e.target as HTMLElement).parentElement === root.current;
    // }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (state.engineStatus !== "running") {
                return;
            }
            const key = e.key.toLowerCase();
            input.setRawKeyPressed(key, true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (state.engineStatus !== "running") {
                return;
            }
            const key = e.key.toLowerCase();
            input.setRawKeyPressed(key, false);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
        }
    }, []);

    return <div
        className='unselectable'
        style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            position: "relative"
        }}
        onPointerDown={e => {
            if (!clickedInCanvas(e)) {
                return;
            }
            input.rawTouchDown = true;
            input.rawTouchButton = e.button;
            setTouchPos(e.clientX, e.clientY);
        }}
        onPointerMove={e => {
            input.rawTouchJustMoved = true;
            setTouchPos(e.clientX, e.clientY);
        }}
        onPointerUp={e => {
            if (!clickedInCanvas(e)) {
                return;
            }
            input.rawTouchDown = false;
            setTouchPos(e.clientX, e.clientY);
        }}
        onPointerEnter={() => input.touchInside = true}
        onPointerLeave={() => input.touchInside = false}
        onContextMenu={e => e.preventDefault()}
        onWheel={e => input.rawWheelDelta = e.nativeEvent}        
    >
        <div
            className={styles.root}
            ref={root}
            onPointerUp={event => {
                if (state.transformInProgress || state.cameraOrbitInProgress) {
                    return;
                }

                if (state.currentCamera !== state.editorCamera) {
                    if (state.engineStatus === "running") {
                        return;
                    }
                }

                const { x, y, width, height } = root.current!.getBoundingClientRect();
                const viewportX = event.clientX - x;
                const viewportY = event.clientY - y;
                normalizedPointer.x = (viewportX / width) * 2 - 1;
                normalizedPointer.y = - (viewportY / height) * 2 + 1;
                raycaster.setFromCamera(normalizedPointer, state.currentCamera!);
                const intersects = raycaster.intersectObjects(engine.scene!.children);
                const [closest] = intersects.filter(i => {
                    if (!i.object.visible) {
                        return false;
                    }
                    let visible = true;
                    i.object.traverseAncestors(ancestor => {
                        if (!ancestor.visible) {
                            visible = false;
                        }
                    });
                    return visible;
                });
                if (closest) {
                    // let obj = closest.object;
                    // let parent = obj.parent;
                    // while (parent !== engine.scene) {
                    //     obj = parent!;
                    //     parent = obj.parent;
                    // }
                    state.selection = closest.object;
                } else {
                    state.selection = null;
                }
            }}
        />
        {active && showStats && <EngineStats renderInfo={renderInfo} />}
        <GameUI rawPointerPos={rawTouchPos.current} />

        {
            showControls
            &&
            <ViewportControls>
                {
                    showTransformControls
                    &&
                    <div
                        style={{
                            position: "absolute",
                            right: ".5rem",
                            bottom: "calc(.5rem + 30px)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "1px"
                        }}
                    >
                        <Button
                            icon="move"
                            intent={transformType === "translate" ? 'primary' : 'none'}
                            onClick={() => _setTransformType("translate")}
                        />
                        <Button
                            icon="refresh"
                            intent={transformType === "rotate" ? 'primary' : 'none'}
                            onClick={() => _setTransformType("rotate")}
                        />
                        <Button
                            icon="maximize"
                            intent={transformType === "scale" ? 'primary' : 'none'}
                            onClick={() => _setTransformType("scale")}
                        />
                        <Tooltip content={localTransform ? "Local Transform" : "Global Transform"} usePortal={false}>
                            <Button
                                icon="flow-review-branch"
                                intent={localTransform ? 'primary' : 'none'}
                                onClick={() => {
                                    setLocalTransform(prev => {
                                        state.transformControls.space = prev ? "world" : "local";
                                        return !prev;
                                    });
                                }}
                            />
                        </Tooltip>
                        <div style={{ height: ".5rem" }} />
                    </div>
                }
                <div
                    style={{
                        position: "absolute",
                        right: ".5rem",
                        bottom: ".5rem"
                    }}
                >
                    <Popover
                        usePortal={false}
                        content={<Menu>
                            <MenuItem
                                text="Grid"
                                labelElement={showGrid ? <Icon icon="tick" /> : undefined}
                                shouldDismissPopover={false}
                                onClick={() => {
                                    setShowGrid(prev => !prev);
                                    localStorage.setItem("showGrid", (!showGrid).toString());
                                    gridHelper.current!.visible = !showGrid;
                                }}
                            />
                            <MenuItem
                                text="Light Frustums"
                                labelElement={showLightFrustums ? <Icon icon="tick" /> : undefined}
                                shouldDismissPopover={false}
                                onClick={() => {
                                    for (const helper of lightFrustums) {
                                        helper.visible = !showLightFrustums;
                                    }
                                    setShowLightFrustums(prev => !prev);
                                    localStorage.setItem("showLightFrustums", (!showLightFrustums).toString());
                                }}
                            />
                            <MenuItem
                                text="Skeletons"
                                labelElement={showSkeletons ? <Icon icon="tick" /> : undefined}
                                shouldDismissPopover={false}
                                onClick={() => {
                                    for (const skeleton of skeletons) {
                                        skeleton.visible = !showSkeletons;
                                    }
                                    setShowSkeletons(prev => !prev);
                                    localStorage.setItem("showSkeletons", (!showSkeletons).toString());
                                    }}
                                />

                                <MenuItem
                                    text="Colliders"
                                    labelElement={showColliders ? <Icon icon="tick" /> : undefined}
                                    shouldDismissPopover={false}
                                    onClick={() => {
                                        for (const collider of colliders) {
                                            collider.visible = !showColliders;
                                        }
                                        setShowColliders(prev => !prev);
                                        localStorage.setItem("showColliders", (!showColliders).toString());
                                    }}
                                />
                            </Menu>}
                        >
                        <Tooltip content={"Display"} usePortal={false}>
                            <Button icon="eye-open" />
                        </Tooltip>
                    </Popover>
                </div>
                <div style={{
                    position: "absolute",
                    left: "50%",
                    bottom: ".5rem"
                }}>
                    <Button
                        icon="play"
                        intent={isPlaying ? "primary" : "none"}
                        onPointerDown={e => e.stopPropagation()}
                        onPointerUp={e => e.stopPropagation()}
                        onClick={() => {
                            if (state.engineStatus !== "running") {
                                cmdSaveScene.post(true);
                                state.engineStatus = "running";
                                setInGame(true);                                
                                state.sceneLoadingInProgress = true;
                                evtSceneLoadingStarted.post();
                            }
                        }}
                    />
                    <Button
                        icon="step-forward"
                        onClick={() => {
                            state.engineStatus = "paused";
                            forceEngineStep.current = true;
                            time.setFixed(true);
                        }}
                    />
                    {
                        state.engineStatus !== "stopped"
                        &&
                        <Button
                            icon="pause"
                            intent={isPaused ? "primary" : "none"}
                            onClick={() => {
                                if (state.engineStatus !== "paused") {
                                    state.engineStatus = "paused";
                                } else {
                                    state.engineStatus = "running";
                                }
                            }}
                        />
                    }
                    {
                        state.engineStatus !== "stopped"
                        &&
                        <Button
                            icon="stop"
                            onClick={() => {
                                state.engineStatus = "stopping";
                                setInGame(false);
                                selectionId.current = state.selection?.uuid;
                                loadScene()
                                    .then(() => {
                                        state.engineStatus = "stopped";
                                    });
                            }}
                        />
                    }
                    {
                        inGame
                        &&
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: "calc(-30px - .5rem)",
                        }}>
                            <Popover
                                usePortal={false}
                                content={<Menu>
                                    <MenuItem
                                        text={"Game Camera"}
                                        labelElement={!forceEditorCamera ? <Icon icon="tick" /> : undefined}
                                        shouldDismissPopover={false}
                                        onClick={() => {
                                            setForceEditorCamera(false);
                                            state.forceEditorCamera = false;
                                        }}
                                    />
                                    <MenuItem
                                        text={"Editor Camera"}
                                        labelElement={forceEditorCamera ? <Icon icon="tick" /> : undefined}
                                        shouldDismissPopover={false}
                                        onClick={() => {
                                            setForceEditorCamera(true);
                                            state.forceEditorCamera = true;
                                        }}
                                    />
                                </Menu>}
                            >
                                <Tooltip content={"Cameras"} usePortal={false}>
                                    <Button icon="camera" />
                                </Tooltip>
                            </Popover>
                        </div>
                    }
                </div>
            </ViewportControls>
        }
    </div>
}

