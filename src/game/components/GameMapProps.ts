import { IComponentProps } from "../../engine/Component";
import { type TileType, TileTypes } from "../GameTypes";
import * as Attributes from "../../engine/Attributes";
import { serialization } from "../../engine/Serialization";

export class GameMapProps implements IComponentProps {    
    constructor(props?: GameMapProps) {
        if (props) {
            serialization.deserializeComponentProps(this, props);
        }
    }

    @Attributes.enumOptions(TileTypes)
    tileType: TileType = "sand";
}

