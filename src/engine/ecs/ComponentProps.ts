import { Color, Vector2 } from "three";
import { TArray } from "../serialization/TArray";

export class ComponentProps {
    public active = true;

    protected deserialize(props?: Partial<ComponentProps>) {
        if (props) {
            for (const [prop, _value] of Object.entries(props)) {
                const value = _value as any;
                const instance = this[prop as keyof typeof this];
                if (instance === undefined) {
                    continue;
                }
                const vec2 = instance as Vector2;
                const color = instance as Color;
                const array = instance as TArray<any>;            
                if (vec2?.isVector2) {
                    vec2.copy(value as Vector2);
                } else if (color?.isColor) {
                    color.set(value as Color);
                } else if (array?.isArray) {
                    array.copy(value as TArray<any>);
                } else {
                    Object.assign(this, { [prop]: value });
                }
            }
        }
    }
}

