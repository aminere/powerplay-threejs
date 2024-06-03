
import { Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { buildings } from "../buildings/Buildings";
import { conveyors } from "../Conveyors";
import { unitsManager } from "../unit/UnitsManager";
import { trees } from "../Trees";
import { GameMapInput } from "../GameMapInput";

export class GameMapUpdate extends Component<ComponentProps> {

    constructor() {
        super(new ComponentProps());
    }

    override update(_owner: Object3D) {
        GameMapInput.update();
        conveyors.update();
        unitsManager.update();
        buildings.update();
        trees.update();
    }    
}

