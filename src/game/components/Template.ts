
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";

export class TemplateProps extends ComponentProps {
    constructor(props?: Partial<TemplateProps>) {
        super();
        this.deserialize(props);
    }
}

export class Template extends Component<TemplateProps> {
    constructor(props?: Partial<TemplateProps>) {
        super(new TemplateProps(props));
    }
}

