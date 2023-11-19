import { Box2 } from "three";
import { ComponentProps } from "../../engine/Component";
import { ISector } from "../GameTypes";

export interface GameMapProps extends ComponentProps {
    sectors: Map<string, ISector>;
    bounds?: Box2;    
}

