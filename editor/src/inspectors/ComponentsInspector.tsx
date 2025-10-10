import { Button, Menu, MenuItem } from "@blueprintjs/core";
import { Object3D, Vector2 } from "three"
import { cmdRefreshInspectors, cmdSaveScene, cmdShowPopover } from "../Events";
import { Component, ComponentProps, GameMap, TArray, componentFactory, engineState, trees, terrain, serializeGameMap } from "powerplay-lib";
import { state } from "../State";
import { undoRedo } from "../UndoRedo";
import { Section } from "./Section";
import { Property } from "./Property";
import { Properties } from "./Properties";
import 'reflect-metadata';
import { ArrayProperty } from "./ArrayProperty";
import { getObjectName, setComponent } from "../Utils";
import FileSaver from "file-saver";

interface IProps {
    target: Object3D;
    timestamp: number;
}

function createComponent(type: string) {
    const obj = state.selection!;
    console.assert(obj);
    const instance = componentFactory.create(type)!;
    undoRedo.recordState(obj);
    setComponent(obj, instance);
    if (state.engineStatus !== "stopped") {
        instance.start(obj);
    }
    engineState.registerComponent(instance, obj);
    undoRedo.pushState();
    cmdRefreshInspectors.post(obj);
    cmdSaveScene.post(false);
}

const dummyInstances = new Map<string, Component<ComponentProps>>();
const sectorCoords = new Vector2();

export function ComponentsInspector(props: IProps) {

    const { target } = props;
    const components = target.userData.components as Record<string, Component<ComponentProps>>;
    return <div style={{ position: "relative", height: "100%" }}>
        <div style={{ height: "30px" }}>
            <Button
                text="Add Component"
                icon="plus"
                minimal
                fill
                intent="primary"
                onClick={e => {
                    cmdShowPopover.post({
                        target: e.currentTarget,
                        content: <Menu style={{ pointerEvents: "all" }}>
                            {Array.from(componentFactory.getTypes()).map(type => {
                                const allowed = (() => {
                                    let instance = dummyInstances.get(type);
                                    if (!instance) {
                                        instance = componentFactory.create(type)!;
                                        dummyInstances.set(type, instance);
                                    }
                                    const requires = Reflect.getMetadata("componentRequires", instance.constructor) as (obj: Object3D) => boolean;
                                    return requires?.(target) ?? true;
                                })();
                                if (allowed) {
                                    return <MenuItem key={type} text={type} onClick={() => createComponent(type)} />
                                }
                            }).filter(Boolean)}
                        </Menu>
                    });
                }}
            />
        </div>
        <div style={{
            height: "calc(100% - 30px)",
            overflowY: "auto"
        }}>
            {
                components
                &&
                Object.entries(components).map(([componentType, component]) => {
                    return <Section
                        key={componentType}
                        name={componentType}
                        actions={[
                            {
                                icon: "cog",
                                onClick: e => {
                                    cmdShowPopover.post({
                                        target: e,
                                        content: <Menu style={{ pointerEvents: "all" }}>
                                            <MenuItem text="Copy" onClick={() => {
                                                state.setComponentClipboard(component);
                                            }} />
                                            <MenuItem
                                                text={`Paste ${state.componentClipboard?.typeName ?? ""}`}
                                                disabled={!state.componentClipboard || state.componentClipboard.typeName !== componentType}
                                                onClick={() => {
                                                    const { typeName, data } = state.componentClipboard!;
                                                    console.assert(typeName === componentType);
                                                    const props = JSON.parse(data) as ComponentProps;
                                                    const deserialized = componentFactory.create(typeName, props)!;
                                                    component.props = deserialized.props;
                                                    
                                                    cmdRefreshInspectors.post(target);
                                                    cmdSaveScene.post(false);
                                                }}
                                            />
                                        </Menu>
                                    });
                                }
                            },
                            {
                            icon: "cross",
                            onClick: () => {
                                undoRedo.recordState(target);
                                engineState.removeComponentByType(componentType, target);
                                undoRedo.pushState();
                                cmdRefreshInspectors.post(target);
                                cmdSaveScene.post(false);
                            }
                        }]}
                    >
                        <Properties>
                            {Object.keys(component.props).map(prop => {
                                const value = component.props[prop as keyof typeof component.props] as unknown;
                                if ((value as TArray<unknown>).isArray) {
                                    return <ArrayProperty
                                        key={`${target.uuid}-${componentType}-${prop}-${props.timestamp}`}
                                        target={component.props}
                                        owner={target}
                                        property={prop}
                                        onChanged={() => {
                                            undoRedo.pushState();
                                            cmdSaveScene.post(false);
                                        }}
                                    />
                                } else {
                                    const command = Reflect.getMetadata("command", component.props, prop) as string;
                                    if (command) {
                                        return <Property
                                            key={`${target.uuid}-${props.timestamp}-${command}`}
                                            target={{ [command]: { command } }}
                                            owner={target}
                                            property={command}
                                            onChanged={() => {
                                                switch (command) {
                                                    case "save": {
                                                        if (component instanceof GameMap) {                                                            
                                                            const data = JSON.stringify(serializeGameMap(), null, 2);
                                                            const fileName = getObjectName(target);

                                                            const gamemap = component as GameMap;
                                                            if (gamemap.props.saveToDisk) {
                                                                FileSaver.saveAs(new Blob([data], { type: "application/json" }), `${fileName}.json`);
                                                            }

                                                            localStorage.setItem(`gameMap_${fileName}`, data);
                                                            console.log(`Saved ${fileName}.json`);
                                                        } else {
                                                            console.warn(`Saving of component '${component.constructor.name}' is not implemented`);
                                                        }
                                                    }
                                                        break;

                                                    case "trees": {
                                                        if (component instanceof GameMap) {
                                                            const gameMap = component as GameMap;
                                                            trees.generate(gameMap.props.size);
                                                        }
                                                    }
                                                    break;

                                                    case "elevation": {
                                                        if (component instanceof GameMap) {
                                                            const gameMap = component as GameMap;
                                                            const size = gameMap.props.size;
                                                            for (let i = 0; i < size; ++i) {
                                                                for (let j = 0; j < size; ++j) {
                                                                    sectorCoords.set(j, i);
                                                                    terrain.generateElevation(sectorCoords);
                                                                }
                                                            }                                                            
                                                        }
                                                    }
                                                    break;

                                                    default:
                                                        console.warn(`Unknown command: ${command}`);
                                                }
                                            }}
                                        />
                                    } else {
                                        const options = Reflect.getMetadata("enumOptions", component.props, prop) as string[];
                                        const range = Reflect.getMetadata("range", component.props, prop) as [number, number];
                                        return <Property
                                            key={`${target.uuid}-${componentType}-${prop}-${props.timestamp}`}
                                            target={component.props}
                                            owner={target}
                                            property={prop}
                                            onChanged={() => {
                                                undoRedo.pushState();
                                                cmdSaveScene.post(false);
                                            }}
                                            options={{ values: options, range }}
                                        />
                                    }

                                }
                            })}
                        </Properties>
                    </Section>
                })
            }
        </div>
    </div>
}


