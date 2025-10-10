
import { Tree as BPTree, Colors, Icon, Menu, MenuItem, type TreeNodeInfo } from "@blueprintjs/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ObjectMoved, cmdFocusObject, cmdRefreshInspectors, cmdRefreshTree, cmdSaveScene, cmdShowPopover, evtObjectCreated, evtObjectDeleted, evtObjectMoved, evtObjectRenamed, evtObjectSelected } from "./Events";
import { state } from "./State";
import { Camera, Light, Object3D } from "three";
import { undoRedo } from "./UndoRedo";
import { getObjectAtPath, getObjectName, getObjectPath, pathEquals } from "./Utils";
import { engine, evtSceneCreated, serialization } from "powerplay-lib";
import FileSaver from 'file-saver';
import { InsertMenu } from "./InsertMenu";
import { TextField } from "./inspectors/TextField";
import styles from "./styles/tree.module.css";

function makeTreeNode(obj: Object3D): TreeNodeInfo {
    if (obj.children.length === 0) {
        return {
            id: obj.id,
            label: getObjectName(obj),
        };
    } else {
        const childNodes = obj.children.map(c => makeTreeNode(c));
        return {
            id: obj.id,
            label: getObjectName(obj),
            childNodes,
        };
    }
}

function isDescendant(parent: number[], child: number[]) {
    return pathEquals(parent, child.slice(0, parent.length));
}

function isDirectChild(parent: number[], child: number[]) {
    return pathEquals(parent, child.slice(0, -1));
}

function updateNode(nodes: TreeNodeInfo[], path: number[], update: (node: TreeNodeInfo) => TreeNodeInfo) {
    console.assert(path.length > 0);
    let currentParent = nodes;
    for (let i = 0; i < path.length; ++i) {
        const index = path[i];
        if (i === path.length - 1) {
            currentParent[index] = update(currentParent[index]);
        } else {
            console.assert(currentParent[index].childNodes !== undefined);
            currentParent = currentParent[index].childNodes!;
        }
    }
}

function getNode(nodes: TreeNodeInfo[], path: number[]): TreeNodeInfo {
    let currentParent = nodes;
    for (let i = 0; i < path.length; ++i) {
        const index = path[i];
        if (i === path.length - 1) {
            return currentParent[index];
        } else {
            console.assert(currentParent[index].childNodes !== undefined);
            currentParent = currentParent[index].childNodes!;
        }
    }
    console.assert(false);
    return null!;
}

function tryGetNode(nodes: TreeNodeInfo[], path: number[]): TreeNodeInfo | null {
    let currentParent = nodes;
    for (let i = 0; i < path.length; ++i) {
        const index = path[i];
        if (i === path.length - 1) {
            return currentParent[index];
        } else {
            const childNodes = currentParent[index]?.childNodes;
            if (childNodes !== undefined) {
                currentParent = childNodes;
            } else {
                break;
            }
        }
    }
    return null;
}

function refreshTreeNode(obj: Object3D, prevNodes: TreeNodeInfo[]): TreeNodeInfo {
    const path = getObjectPath(obj);
    const prevNode = tryGetNode(prevNodes, path);
    if (obj.children.length === 0) {
        return {
            id: obj.id,
            label: getObjectName(obj),
            isExpanded: prevNode?.isExpanded,
            isSelected: prevNode?.isSelected,
        };
    } else {
        const childNodes = obj.children.map(c => refreshTreeNode(c, prevNodes));
        return {
            id: obj.id,
            label: getObjectName(obj),
            isExpanded: prevNode?.isExpanded,
            isSelected: prevNode?.isSelected,
            childNodes
        };
    }
}

function removeNode(nodes: TreeNodeInfo[], path: number[]) {
    const parentPath = path.slice(0, -1);
    if (parentPath.length === 0) {
        const indexInParent = path[path.length - 1];
        nodes.splice(indexInParent, 1);
    } else {
        const node = getNode(nodes, path);
        updateNode(nodes, parentPath, oldParent => {
            console.assert(oldParent.childNodes !== undefined);
            const childNodes = oldParent.childNodes!.filter(f => f.id !== node.id);
            return {
                ...oldParent,
                childNodes,
                hasCaret: childNodes.length > 0
            };
        });
    }
}

function addNode(nodes: TreeNodeInfo[], path: number[], obj: Object3D, isSelected: boolean) {
    const parentPath = path.slice(0, -1);
    const indexInParent = path[path.length - 1];
    const newNode = {
        ...makeTreeNode(obj),
        isSelected
    };
    if (parentPath.length === 0) {
        nodes.splice(indexInParent, 0, newNode);
    } else {
        updateNode(nodes, parentPath, node => {
            if (node.childNodes !== undefined) {
                node.childNodes.splice(indexInParent, 0, newNode);
            } else {
                node.childNodes = [newNode];
            }
            node.hasCaret = node.childNodes.length > 0;
            return node;
        });
    }
}

export function Tree() {
    const [nodes, setNodes] = useState<TreeNodeInfo[]>([]);
    const tree = useRef<BPTree<object>>(null!);
    const [search, setSearch] = useState<string>("");
    const searchResults = useRef<Object3D[]>([]);

    const onClick = useCallback((_node: TreeNodeInfo, path: number[], e: React.MouseEvent<HTMLElement>) => {
        // if (!e.shiftKey) TODO multiple selection
        state.selection = getObjectAtPath(path);
        e.stopPropagation();
    }, []);

    const onCollapse = useCallback((_node: TreeNodeInfo, path: number[]) => {
        setNodes(prev => {
            updateNode(prev, path, node => {
                node.isExpanded = false;
                return node;
            });
            return [...prev];
        });
    }, []);

    const onExpand = useCallback((_node: TreeNodeInfo, path: number[]) => {
        setNodes(prev => {
            updateNode(prev, path, node => {
                node.isExpanded = true;
                return node;
            });
            return [...prev];
        });
    }, []);

    const hoveredNode = useRef<number[]>();
    const onMouseEnter = useCallback((_node: TreeNodeInfo, path: number[]) => {
        hoveredNode.current = [...path];
    }, []);
    const onMouseLeave = useCallback(() => {
        hoveredNode.current = undefined;
    }, []);

    useEffect(() => {
        const onObjectCreated = (obj: Object3D) => {
            const path = getObjectPath(obj);
            setNodes(prev => {
                const newState = [...prev];
                addNode(newState, path, obj, false);
                return newState;
            });
        };

        const onObjectDeleted = (obj: Object3D) => {
            const path = getObjectPath(obj);
            setNodes(prev => {
                const newState = [...prev];
                removeNode(newState, path);
                return newState;
            });
        };

        const onObjectRenamed = (obj: Object3D) => {
            setNodes(prev => {
                const newState = [...prev];
                const path = getObjectPath(obj);
                updateNode(newState, path, node => {
                    node.label = getObjectName(obj);
                    return node;
                });
                return newState;
            });
        };

        const onObjectMoved = (params: ObjectMoved) => {
            setNodes(prev => {
                const newState = [...prev];
                const { srcPath, destPath } = params;
                const wasSelected = getNode(prev, srcPath).isSelected === true;
                removeNode(newState, srcPath);
                const obj = getObjectAtPath(destPath)!;
                addNode(newState, destPath, obj, wasSelected);
                return newState;
            });
        };

        const onSceneCreated = () => {
            setNodes(engine.scene!.children.map(c => makeTreeNode(c)));
        };

        const onObjectSelected = (obj: Object3D | null) => {
            const previousSelected = state.selection;
            const selectionPath = previousSelected ? getObjectPath(previousSelected) : null;
            setNodes(prev => {
                const newState = [...prev];

                if (selectionPath !== null && selectionPath.length > 0) {
                    const prevNode = tryGetNode(prev, selectionPath);
                    if (prevNode) {
                        updateNode(newState, selectionPath, node => {
                            node.isSelected = false;
                            return node;
                        });
                    }
                }

                if (obj) {
                    const path = getObjectPath(obj);
                    updateNode(newState, path, node => {
                        node.isSelected = true;
                        return node;
                    });
                    if (path.length > 0) {
                        // ensure parent nodes are expanded
                        let parentPath = path.slice(0, -1);
                        while (parentPath.length >= 1) {
                            updateNode(newState, parentPath, node => {
                                node.isExpanded = true;
                                return node;
                            });
                            parentPath = parentPath.slice(0, -1);
                        }
                    }
                }
                return newState;
            });
        };

        const onRefresh = () => {
            // TODO use Object3D "childadded" and "childremoved" events instead
            setNodes(prev => engine.scene!.children.map(c => refreshTreeNode(c, prev)));
        };

        if (engine.scene) {
            setNodes(engine.scene.children.map(c => makeTreeNode(c)));
        }

        evtObjectCreated.attach(onObjectCreated);
        evtObjectDeleted.attach(onObjectDeleted);
        evtObjectRenamed.attach(onObjectRenamed);
        evtObjectMoved.attach(onObjectMoved);
        evtObjectSelected.attach(onObjectSelected);
        evtSceneCreated.attach(onSceneCreated);
        cmdRefreshTree.attach(onRefresh);
        return () => {
            evtObjectCreated.detach(onObjectCreated);
            evtObjectDeleted.detach(onObjectDeleted);
            evtObjectRenamed.detach(onObjectRenamed);
            evtObjectMoved.detach(onObjectMoved);
            evtObjectSelected.detach(onObjectSelected);
            evtSceneCreated.detach(onSceneCreated);
            cmdRefreshTree.detach(onRefresh);
        }
    }, []);

    useEffect(() => {
        const onObjectSelected = (obj: Object3D | null) => {
            if (obj) {
                setTimeout(() => {
                    if (search.length > 0) {
                        return;
                    }
                    const elem = tree.current?.getNodeContentElement(obj.id);
                    if (elem) {
                        elem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
                    }
                }, 300);
            }
        };
        evtObjectSelected.attach(onObjectSelected);
        return () => {
            evtObjectSelected.detach(onObjectSelected);
        }
    }, [search]);

    const allowDrop = useRef<boolean>();
    const root = useRef<HTMLDivElement>(null);
    const draggedNode = useRef<number[]>();
    const pressedNode = useRef<number[]>();
    return <div
        ref={root}
        style={{
            height: "100%",
            width: "100%",
            backgroundColor: Colors.DARK_GRAY2
        }}
        onPointerDown={() => {
            if (hoveredNode.current) {
                pressedNode.current = [...hoveredNode.current];
            }
        }}
        onPointerUp={() => {
            if (draggedNode.current) {
                if (allowDrop.current) {
                    const draggedObj = getObjectAtPath(draggedNode.current)!;
                    const oldNode = getNode(nodes, draggedNode.current!);
                    const wasSelected = oldNode.isSelected;

                    if (hoveredNode.current) {

                        const hoveredObj = getObjectAtPath(hoveredNode.current!)!;
                        if (!isDirectChild(hoveredNode.current, draggedNode.current)) {
                            hoveredObj.attach(draggedObj);
                            draggedObj.userData.eulerRotation = draggedObj.rotation.clone();
                            const parentPathAfterMove = getObjectPath(hoveredObj);
                            undoRedo.pushMove(draggedNode.current, [...parentPathAfterMove, hoveredObj.children.length - 1]);
                            cmdSaveScene.post(false);

                            updateNode(nodes, hoveredNode.current!, node => {
                                return {
                                    ...node,
                                    childNodes: [
                                        ...(node.childNodes ?? []),
                                        {
                                            ...makeTreeNode(draggedObj),
                                            isSelected: wasSelected,
                                        }
                                    ],
                                    hasCaret: true
                                };
                            });
                            removeNode(nodes, draggedNode.current!);

                        } else {

                            hoveredObj.remove(draggedObj);
                            hoveredObj.add(draggedObj);
                            const parentPathAfterMove = getObjectPath(hoveredObj);
                            undoRedo.pushMove(draggedNode.current, [...parentPathAfterMove, hoveredObj.children.length - 1]);
                            cmdSaveScene.post(false);

                            updateNode(nodes, hoveredNode.current!, node => {
                                const previousChildren = node.childNodes ?? [];
                                return {
                                    ...node,
                                    childNodes: [
                                        ...previousChildren.filter(c => c.id !== draggedObj.id),
                                        {
                                            ...makeTreeNode(draggedObj),
                                            isSelected: wasSelected,
                                        }
                                    ],
                                    hasCaret: true
                                };
                            });
                        }

                    } else {
                        engine.scene!.attach(draggedObj);
                        draggedObj.userData.eulerRotation = draggedObj.rotation.clone();

                        undoRedo.pushMove(draggedNode.current, [engine.scene!.children.length - 1]);
                        cmdSaveScene.post(false);

                        removeNode(nodes, draggedNode.current!);
                        nodes.push({
                            ...makeTreeNode(draggedObj),
                            isSelected: oldNode.isSelected,
                            isExpanded: oldNode.isExpanded,
                        });
                    }
                    setNodes([...nodes]);
                }
                draggedNode.current = undefined;
                pressedNode.current = undefined;
                allowDrop.current = undefined;
                root.current!.style.cursor = "default";
            } else if (pressedNode.current) {
                pressedNode.current = undefined;
            }
        }}
        onPointerMove={() => {
            if (draggedNode.current) {
                const _allowDrop = (() => {
                    if (hoveredNode.current) {
                        if (pathEquals(draggedNode.current, hoveredNode.current!)) {
                            return false;
                        } else {
                            return !isDescendant(draggedNode.current, hoveredNode.current);
                        }
                    } else {
                        return true;
                    }
                })();
                if (_allowDrop !== allowDrop.current) {
                    allowDrop.current = _allowDrop;
                    root.current!.style.cursor = _allowDrop ? "grabbing" : "no-drop";
                }
            } else if (pressedNode.current) {
                draggedNode.current = [...pressedNode.current];
                root.current!.style.cursor = "grabbing";
            }
        }}
        onClick={() => {
            if (hoveredNode.current) {
                return;
            }
            state.selection = null;
        }}
        onContextMenu={e => {
            e.preventDefault();
            cmdShowPopover.post({
                target: e.currentTarget,
                content: <InsertMenu />
            });
        }}
    >
        <TextField
            initialValue={search}
            border={true}
            onChanging={e => {
                setSearch(e);
                searchResults.current.length = 0;
                if (e.length === 0) {                    
                    return;
                }
                engine.scene!.traverse(obj => {
                    if (getObjectName(obj).toLowerCase().includes(e.toLowerCase())) {
                        searchResults.current.push(obj);
                    }
                });
            }}
        />
        {
            search !== ""
            &&
            <div className={styles.content}>
                <ul className="bp5-tree-node-list bp5-tree-root">
                    {searchResults.current.map(obj => {
                        const selected = state.selection === obj;
                        return <li
                            key={obj.uuid}
                            className={`bp5-tree-node ${selected ? "bp5-tree-node-selected" : ""}`}
                            onClick={e => {
                                state.selection = obj;
                                e.stopPropagation();
                            }}
                        >
                            <div className="bp5-tree-node-content bp5-tree-node-content-0">
                                <span className="bp5-tree-node-caret-none"></span>
                                <span className="bp5-tree-node-label">{getObjectName(obj)}</span>
                            </div>
                        </li>
                    })}
                </ul>
            </div>
        }
        {
            search === ""
            &&
            <BPTree
                className={styles.content}
                ref={e => tree.current = e!}
                contents={nodes}
                onNodeClick={onClick}
                onNodeDoubleClick={(_node, path) => {
                    const obj = getObjectAtPath(path);
                    cmdFocusObject.post(obj!);
                }}
                onNodeCollapse={onCollapse}
                onNodeExpand={onExpand}
                onNodeMouseLeave={onMouseLeave}
                onNodeMouseEnter={onMouseEnter}
                onNodeContextMenu={(_node, path, e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const obj = getObjectAtPath(path)!;
                    const isLight = (obj as Light).isLight;
                    const isCamera = (obj as Camera).isCamera;
                    cmdShowPopover.post({
                        target: e.currentTarget,
                        content: <Menu style={{ pointerEvents: "all" }}>
                            {
                                !obj.userData.unserializable
                                &&
                                <MenuItem text={"Save Object"} onClick={() => {
                                    const serialized = serialization.serialize(obj, true)!;
                                    FileSaver.saveAs(new Blob([serialized], { type: "application/json" }), `${getObjectName(obj)}.json`);
                                }} />
                            }
                            {
                                (!isLight && !isCamera)
                                &&
                                <MenuItem
                                    text={"Cast Shadow"}
                                    labelElement={obj.castShadow ? <Icon icon="tick" /> : undefined}
                                    onClick={() => {
                                        undoRedo.recordState(obj);
                                        obj.traverse(o => {
                                            o.castShadow = !o.castShadow;
                                        });
                                        undoRedo.pushState();
                                        cmdRefreshInspectors.post(obj);
                                        cmdSaveScene.post(false);
                                    }} />
                            }
                            {
                                obj.parent !== engine.scene
                                &&
                                <MenuItem text={"Move to Root"} onClick={() => {
                                    const srcPath = getObjectPath(obj);
                                    engine.scene!.attach(obj);
                                    obj.userData.eulerRotation = obj.rotation.clone();
                                    const destPath = [engine.scene!.children.length - 1];
                                    undoRedo.pushMove(srcPath, destPath);
                                    cmdSaveScene.post(false);
                                    setNodes(prev => {
                                        const newState = [...prev];
                                        const wasSelected = getNode(prev, srcPath).isSelected === true;
                                        removeNode(newState, srcPath);
                                        const obj = getObjectAtPath(destPath)!;
                                        addNode(newState, destPath, obj, wasSelected);
                                        return newState;
                                    });
                                }} />
                            }
                        </Menu>
                    });
                }}
            />
        }
    </div>
}

