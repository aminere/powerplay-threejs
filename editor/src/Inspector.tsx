
import { Colors, Tab, Tabs } from '@blueprintjs/core';
import { useEffect, useState } from 'react';
import { cmdRefreshInspectors, evtObjectSelected } from './Events';
import { ObjectInspector } from './inspectors/ObjectInspector';
import { GeometryInspector } from './inspectors/GeometryInspector';
import { BufferGeometry, Material, Mesh, Object3D, Points } from 'three';
import { MaterialInspector } from './inspectors/MaterialInspector';
import { ComponentsInspector } from './inspectors/ComponentsInspector';

export function Inspector() {

    const [inspectorTab, setInspectorTab] = useState<"object" | "geometry" | "material" | "components">("object");
    const [selection, setSelection] = useState<Object3D | null>(null);
    const [selectionHasGeometry, setSelectionHasGeometry] = useState(false);
    const [timestamp, setTimestamp] = useState(Date.now());

    useEffect(() => {
        const onObjectSelected = (obj: Object3D | null) => {
            if (obj) {
                const mesh = obj as Mesh;
                const points = obj as Points;
                const hasGeometry = mesh.isMesh || points.isPoints;
                setSelectionHasGeometry(hasGeometry);
                if (!hasGeometry && inspectorTab !== "object" && inspectorTab !== "components") {
                    setInspectorTab("object");
                }
            }
            setSelection(obj);
            setTimestamp(Date.now());
        };

        const onRefreshInspector = () => {
            setTimestamp(Date.now());
        };

        evtObjectSelected.attach(onObjectSelected);
        cmdRefreshInspectors.attach(onRefreshInspector);
        return () => {
            evtObjectSelected.detach(onObjectSelected);
            cmdRefreshInspectors.detach(onRefreshInspector);
        };
    }, [inspectorTab]);

    return <div
        style={{
            height: "100%",
            backgroundColor: Colors.DARK_GRAY2
        }}
    >
        {
            selection
            &&
            <Tabs
                onChange={e => setInspectorTab(e as "object")}
                selectedTabId={inspectorTab}
            >
                <Tab
                    id="object"
                    title="Object"
                    panel={<ObjectInspector timestamp={timestamp} target={selection} />}
                />
                {
                    selectionHasGeometry
                    &&
                    <Tab
                        id="geometry"
                        title="Geometry"
                        panel={<GeometryInspector timestamp={timestamp} target={selection as (Object3D & { geometry: BufferGeometry })} />}
                    />
                }
                {
                    selectionHasGeometry
                    &&
                    (() => {
                        if (Array.isArray((selection as Mesh).material)) {
                            // TODO support multi-material
                            return null;
                        } else {
                            return <Tab
                                id="material"
                                title="Material"
                                panel={<MaterialInspector timestamp={timestamp} target={selection as (Object3D & { material: Material })} />}
                            />
                        }
                    })()
                }
                <Tab
                    id="components"
                    title="Components"
                    panel={<ComponentsInspector target={selection} timestamp={timestamp} />}
                />
            </Tabs>
        }
    </div>
}

