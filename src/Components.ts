
export interface ComponentProps {}
export interface ComponentState {}

export class Component {
    props: ComponentProps;
    state?: ComponentState;
    constructor(props?: ComponentProps) {
        this.props = props ?? {};        
    }
}

