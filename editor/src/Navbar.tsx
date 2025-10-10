
import { Button, Colors, Icon, Menu, MenuDivider, MenuItem, Popover, Tooltip } from "@blueprintjs/core";
import * as THREE from "three";
import { getObjectName, loadDefaultGameScene } from "./Utils";
import { cmdImportObject, cmdImportScene, cmdRequestScreenshot, cmdSaveScene, cmdToggleViewportControls, evtObjectSelected, evtTabRemoved } from "./Events";
import styles from "./styles/Navbar.module.css";
import { model } from "./EditorLayout";
import { useEffect, useState } from "react";
import { Actions, DockLocation } from "flexlayout-react";
import { serialization, engine } from "powerplay-lib";
import { state } from "./State";
import FileSaver from "file-saver";
import { InsertMenu } from "./InsertMenu";

export function Navbar() {   

    const [visible, setVisible] = useState({
        Scene: model.getNodeById("Scene") !== undefined,
        Inspector: model.getNodeById("Inspector") !== undefined,
        RenderStats: state.showStats,
        FPS: state.showFPS,
        ViewportControls: true
    });
    const [selection, setSelection] = useState<THREE.Object3D | null>(null);

    useEffect(() => {
        const onTabRemoved = (tab: string) => {
            setVisible(prev => {
                return {
                    ...prev,
                    [tab]: false
                }
            });
        };

        const onObjectSelected = (obj: THREE.Object3D | null) => {
            setSelection(obj);
        };

        evtTabRemoved.attach(onTabRemoved);
        evtObjectSelected.attach(onObjectSelected);
        return () => {
            evtTabRemoved.detach(onTabRemoved);
            evtObjectSelected.detach(onObjectSelected);
        }

    }, []);

    return <div
        className={styles.navbar}
        style={{ backgroundColor: Colors.BLACK }}
    >
        <Popover usePortal={false} content={<InsertMenu />}>
            <Tooltip content={"Insert"} usePortal={false}>
                <Button
                    icon="plus"
                    large
                    minimal
                    intent="primary"
                />
            </Tooltip>
        </Popover>
        <Popover
            usePortal={false}
            content={<Menu>
                <MenuItem text="New Scene" onClick={() => {
                     loadDefaultGameScene().then(data => {
                        engine.parseScene(data);
                        cmdSaveScene.post(false);
                     });
                    // engine.parseScene(createNewScene().toJSON());
                    // cmdSaveScene.post(false);
                }} />
                <MenuItem text="Load Scene" onClick={() => {
                    cmdImportScene.post();
                }} />
                <MenuItem text="Save Scene" onClick={() => {
                    engine.scene!.userData.mainCamera = state.camera!.uuid;
                    const sceneData = engine.scene!.toJSON();
                    FileSaver.saveAs(new Blob([JSON.stringify(sceneData, null, 2)], { type: "application/json" }), "scene.json");
                }} />
                <MenuDivider />
                <MenuItem text="Import Object" onClick={() => cmdImportObject.post()} />
                {
                    selection
                    &&
                    !selection.userData.unserializable
                    &&
                    <MenuItem text="Save Object" onClick={() => {
                        const serialized = serialization.serialize(selection, true)!;
                        FileSaver.saveAs(new Blob([serialized], { type: "application/json" }), `${getObjectName(selection)}.json`);
                    }} />
                }
            </Menu>}
        >
            <Tooltip content={"Scene"} usePortal={false}>
                <Button
                    icon="document"
                    large
                    minimal
                    intent="primary"
                />
            </Tooltip>
        </Popover>
        <Popover
            usePortal={false}
            content={<Menu>
                <MenuItem
                    text="Scene"
                    labelElement={visible.Scene ? <Icon icon="tick" /> : undefined}
                    shouldDismissPopover={false}
                    onClick={() => {
                        if (visible.Scene) {
                            model.doAction(Actions.deleteTab("Scene"));
                        } else {
                            model.doAction(Actions.addNode(
                                {
                                    type: "tab",
                                    component: "Tree",
                                    name: "Scene",
                                    id: "Scene"
                                },
                                model.getNodeById("Viewport")!.getParent()!.getId(),
                                DockLocation.LEFT,
                                0
                            ));
                        }
                        setVisible(prev => ({ ...prev, Scene: !visible.Scene }));
                    }}
                />
                <MenuItem
                    text="Inspector"
                    labelElement={visible.Inspector ? <Icon icon="tick" /> : undefined}
                    shouldDismissPopover={false}
                    onClick={() => {
                        if (visible.Inspector) {
                            model.doAction(Actions.deleteTab("Inspector"));
                        } else {
                            model.doAction(Actions.addNode(
                                {
                                    type: "tab",
                                    component: "Inspector",
                                    name: "Inspector",
                                    id: "Inspector"
                                },
                                model.getNodeById("Viewport")!.getParent()!.getId(),
                                DockLocation.LEFT,
                                0
                            ));
                        }
                        setVisible(prev => ({ ...prev, Inspector: !visible.Inspector }));
                    }}
                />
                <MenuDivider />
                <MenuItem
                    text="Stats"
                    labelElement={visible.RenderStats ? <Icon icon="tick" /> : undefined}
                    shouldDismissPopover={false}
                    onClick={() => {
                        const newValue = !visible.RenderStats;
                        state.showStats = newValue;
                        setVisible(prev => ({ ...prev, RenderStats: newValue }));
                    }}
                />
                <MenuItem
                    text="FPS"
                    labelElement={visible.FPS ? <Icon icon="tick" /> : undefined}
                    shouldDismissPopover={false}
                    onClick={() => {
                        const newValue = !visible.FPS;
                        state.showFPS = newValue;
                        setVisible(prev => ({ ...prev, FPS: newValue }));
                    }}
                />
                <MenuItem
                    text="Viewport Controls"
                    labelElement={visible.ViewportControls ? <Icon icon="tick" /> : undefined}
                    shouldDismissPopover={false}
                    onClick={() => {
                        cmdToggleViewportControls.post();
                        setVisible(prev => ({ ...prev, ViewportControls: !prev.ViewportControls }));
                    }}
                />
            </Menu>}
        >
            <Tooltip content={"View"} usePortal={false}>
                <Button
                    icon="applications"
                    large
                    minimal
                    intent="primary"
                />
            </Tooltip>
        </Popover>
        <Tooltip content={"Screenshot"} usePortal={false}>
            <Button
                icon="clip"
                large
                minimal
                intent="primary"
                onClick={() => {
                    cmdRequestScreenshot.post();
                }}
            />
        </Tooltip>
    </div>
}

