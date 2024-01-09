
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";

export class Props extends ComponentProps {
    constructor(props?: Partial<Props>) {
        super();
        this.deserialize(props);
    }
}

interface IState extends IComponentState {    
}

export class Template extends Component<Props, IState> {
    constructor(props?: Partial<Props>) {
        super(new Props(props));
    }
}

