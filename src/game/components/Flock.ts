
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";

export class FlockProps extends ComponentProps {

    public static get instance() { return this._instance!; }
    private static _instance: FlockProps | null = null;   

    radius = 20;
    count = 50;
    npcCount = 4;
    separation = 1;    
    speed = 7;
    avoidanceSpeed = 8;
    repulsion = .2;
    positionDamp = .05;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
        FlockProps._instance = this;
    }

    public dispose() {
        FlockProps._instance = null;
    }
}

export class Flock extends Component<FlockProps> {
    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
    }
    
    override dispose() {        
        this.props.dispose();
    }
}

