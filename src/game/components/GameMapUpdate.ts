
import { Color, Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { buildings } from "../buildings/Buildings";
import { conveyors } from "../Conveyors";
import { unitsManager } from "../unit/UnitsManager";
import { trees } from "../Trees";
import { gameMapInput } from "../GameMapInput";
import { GameMapState } from "./GameMapState";
import { Sector } from "../Sector";
import { config } from "../config/config";

const white = new Color(0xffffff);
const red = new Color(0xff0000);
const localCoords = new Vector2();
const { mapRes } = config.game;

export class GameMapUpdate extends Component<ComponentProps> {

    constructor() {
        super(new ComponentProps());
    }

    override update(_owner: Object3D) {

        // debug
        const sectors = GameMapState.instance.sectors;
        for (const [, sector] of sectors) {
            for (let i = 0; i < sector.cells.length; i++) {
                const cellY = Math.floor(i / mapRes);
                const cellX = i % mapRes;
                localCoords.set(cellX, cellY);
                const cell = sector.cells[i];
                const unitCount = cell.units?.length ?? 0;
                if (unitCount > 0) {
                    Sector.updateHighlightTexture(sector, localCoords, red);
                } else {
                    Sector.updateHighlightTexture(sector, localCoords, white);
                }
            }
        }

        gameMapInput.update();
        conveyors.update();
        unitsManager.update();
        buildings.update();
        trees.update();        
    }    
}

