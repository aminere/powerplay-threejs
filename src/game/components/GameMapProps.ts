import { ComponentProps } from "../../engine/ecs/ComponentProps";
import * as Attributes from "../../engine/serialization/Attributes";
import { Vector2 } from "three";
import { TArray } from "../../engine/serialization/TArray";
import { type GameMode, GameModes } from "../GameDefinitions";

export class GameMapProps extends ComponentProps {

    public static get instance() { return this._instance!; }
    private static _instance: GameMapProps | null = null;

    constructor(props?: Partial<GameMapProps>) {
        super();
        this.deserialize(props);
        GameMapProps._instance = this;
    }

    public dispose() {
        GameMapProps._instance = null;
    }

    debugFreeCosts = false;
    debugPathfinding = false;
    debugCollisions = false;

    saveToDisk = false;
    @Attributes.command("save")
    saveCommand = true;

    @Attributes.enumOptions(GameModes)
    gameMode: GameMode = "sandbox";

    brushSize = 1;
    brushHeight = 1;
    relativeBrush = false;

    @Attributes.command("trees")
    treesCommand = true;

    @Attributes.command("elevation")
    elevationCommand = true;

    size = 1;
    continentFreqInv = 30;    
    erosionFreqInv = 50;
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
    
    debugCells = false;
}

