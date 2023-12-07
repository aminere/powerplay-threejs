import { type TileType, TileTypes } from "../GameTypes";
import { ComponentProps } from "../../engine/ComponentProps";
import * as Attributes from "../../engine/Attributes";

export class GameMapProps extends ComponentProps {

    constructor(props?: Partial<GameMapProps>) {
        super();
        this.deserialize(props);
    }

    @Attributes.enumOptions(TileTypes)
    tileType: TileType = "sand";    
}

