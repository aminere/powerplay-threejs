
import "reflect-metadata";

export function enumOptions(options: readonly string[]) {
    return Reflect.metadata("enumOptions", options);
}

