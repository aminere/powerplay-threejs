
import "reflect-metadata";
import { Object3D } from "three";

export function enumOptions(options: readonly string[]) {
    return Reflect.metadata("enumOptions", options);
}

export function componentRequires(requires: (obj: Object3D) => boolean) {
    return Reflect.metadata("componentRequires", requires);
}

