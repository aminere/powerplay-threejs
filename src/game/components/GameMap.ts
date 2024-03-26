import { Component } from "../../engine/ecs/Component"
import { GameMapProps } from "./GameMapProps";

export class GameMap extends Component<GameMapProps> {

    constructor(props?: Partial<GameMapProps>) {
        super(new GameMapProps(props));
    }
    
    override dispose() {       
        this.props.dispose();
    }
}

