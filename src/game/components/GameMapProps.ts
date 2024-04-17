import { type TileType, TileTypes, type MineralType, MineralTypes, RawResourceTypes, type RawResourceType, type ResourceType, ResourceTypes, type UnitType, UnitTypes } from "../GameDefinitions";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import * as Attributes from "../../engine/serialization/Attributes";
import { TArray } from "../../powerplay";
import { Vector2 } from "three";
import { type BuildingType, BuildingTypes } from "../buildings/BuildingTypes";

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

    @Attributes.enumOptions(TileTypes)
    tileType: TileType = "sand";

    @Attributes.enumOptions(MineralTypes)
    mineralType: MineralType = "aluminium";

    @Attributes.enumOptions(BuildingTypes)
    buildingType: BuildingType = "hq";

    @Attributes.enumOptions(RawResourceTypes)
    factoryInput: RawResourceType = "aluminium";

    @Attributes.enumOptions(ResourceTypes)
    factoryOutput: ResourceType = "steel";

    brushSize = 1;
    brushHeight = 1;
    relativeBrush = false;

    @Attributes.enumOptions(UnitTypes)
    unit: UnitType = "worker";

    saveToDisk = false;
    @Attributes.command("save")
    saveCommand = true;

    @Attributes.command("regen")
    regenCommand = true;

    @Attributes.command("trees")
    treesCommand = true;

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

    debugPathfinding = false;    
}

