
import { Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { GameMapState } from "./GameMapState";

export class Sandbox extends Component<ComponentProps> {    
    override start(_owner: Object3D) {
        const { config } = GameMapState.instance;
        config.sandbox = true;
        config.freeBuildings = true;
        config.freeConveyors = true;
    }
}

