
import { Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { objects } from "../resources/Objects";
import { engineState } from "../EngineState";

export class PrefabLoaderProps extends ComponentProps {
    path = "";

    constructor(props?: Partial<PrefabLoaderProps>) {
        super();
        this.deserialize(props);
    }
}

export class PrefabLoader extends Component<PrefabLoaderProps> {

    constructor(props?: Partial<PrefabLoaderProps>) {
        super(new PrefabLoaderProps(props));
    }
    override start(owner: Object3D) {
        objects.load(`${this.props.path}.json`).then(instance => {
            owner.parent!.add(instance);
            instance.traverse(child => {
                // TODO register components?
                engineState.registerAnimations(child);
            });
            owner.removeFromParent();
        });
    }
}

