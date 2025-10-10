
import { Model, IJsonModel, TabNode } from 'flexlayout-react';
import { Tree } from "./Tree";
import { Viewport } from './Viewport';
import { Inspector } from './Inspector';

const defaultLayout: IJsonModel = {
    "global": {
        "splitterSize": 4,
        "tabEnableRename": false
    },
    "layout": {
        "type": "row",
        "id": "root",
        "children": [
            {
                "type": "row",
                "weight": 15,
                "id": "leftRow",
                "children": [
                    {
                        "type": "tabset",
                        "weight": 16,
                        "children": [
                            {
                                "type": "tab",
                                "name": "Scene",
                                "component": "Tree",
                                "id": "Scene"
                            }
                        ]
                    },
                    {
                        "type": "tabset",
                        "weight": 33,
                        "children": [
                            {
                                "type": "tab",
                                "name": "Inspector",
                                "component": "Inspector",
                                "id": "Inspector"
                            }
                        ]
                    }
                ]
            },
            {
                "type": "tabset",
                "weight": 68,
                "children": [
                    {
                        "type": "tab",
                        "name": "Viewport",
                        "component": "Viewport",
                        "id": "Viewport",                     
                        "enableClose": false
                    }
                ],
                "active": true
            }
        ]
    }
}

export const model = (() => {
    const savedLayout = localStorage.getItem("flexlayout-react");
    if (savedLayout) {
        return Model.fromJson(JSON.parse(savedLayout));
    } else {
        return Model.fromJson(defaultLayout);
    }
})();

export const factory = (node: TabNode) => {
    const component = node.getComponent();
    switch (component) {
        case "Tree":
            return <Tree />
        case "Viewport":
            return <Viewport />
        case "Inspector":
            return <Inspector />
        default:
            return <div>Unknown component: {component}</div>;
    }
}

