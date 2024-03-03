import { type TileType, TileTypes, type MineralType, MineralTypes } from "../GameDefinitions";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import * as Attributes from "../../engine/serialization/Attributes";
import { TArray } from "../../powerplay";
import { Vector2 } from "three";

export class GameMapProps extends ComponentProps {

    constructor(props?: Partial<GameMapProps>) {
        super();
        this.deserialize(props);
    }

    @Attributes.enumOptions(TileTypes)
    tileType: TileType = "sand";

    @Attributes.enumOptions(MineralTypes)
    mineralType: MineralType = "aluminium";

    buildingId = "building1";

    @Attributes.command("save")
    saveCommand = true;

    @Attributes.command("regen")
    regenCommand = true;

    size = 1;
    continentFreq = 0.03;    
    erosionFreq = 0.02;
    continentWeight = 0.6;
    erosionWeight = 0.4;
    continentGain = 1;
    erosionGain = 1;
    continent = new TArray(Vector2, [
        new Vector2(-1, 0),
        new Vector2(0, 0),
        new Vector2(0, 0),
        new Vector2(0, 0),
        new Vector2(.4, 1),
        new Vector2(.5, 5),
        new Vector2(.6, 18),
        new Vector2(1, 20)

    ]);
    erosion = new TArray(Vector2, [
        new Vector2(-1, 0),
        new Vector2(-.5, 0),
        new Vector2(-.5, 0),
        new Vector2(0, 0),
        new Vector2(.4, 1),
        new Vector2(.45, 1),
        new Vector2(.5, 10),
        new Vector2(1, 30)
    ]);
}

