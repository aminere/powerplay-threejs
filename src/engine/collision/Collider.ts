
import { Component, IComponentState } from "../ecs/Component";
import { ComponentProps } from "../ecs/ComponentProps";

export type ColliderType = "sphere" | "box";

export class Collider<T extends ComponentProps, S extends IComponentState> extends Component<T, S> {
    getType(): ColliderType { return null!; }
}

