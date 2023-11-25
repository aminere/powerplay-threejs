import { IComponentProps } from "../../engine/Component";
import { type TileType, TileTypes } from "../GameTypes";
import * as Attributes from "../../engine/Attributes";

export class GameMapProps implements IComponentProps {    
    constructor(props?: Partial<GameMapProps>) {
        if (props) {
            Object.assign(this, props);
        }
    }

    @Attributes.enumOptions(TileTypes)
    tileType: TileType = "sand";
}

