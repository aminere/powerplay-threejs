import { type TileType, TileTypes, type MineralType, MineralTypes } from "../GameDefinitions";
import { ComponentProps } from "../../engine/ComponentProps";
import * as Attributes from "../../engine/Attributes";

export class GameMapProps extends ComponentProps {

    constructor(props?: Partial<GameMapProps>) {
        super();
        this.deserialize(props);
    }

    @Attributes.enumOptions(TileTypes)
    tileType: TileType = "sand";

    @Attributes.enumOptions(MineralTypes)
    mineralType: MineralType = "aluminium";

    @Attributes.command("save")
    saveCommand = true;
}

