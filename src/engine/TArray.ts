import { Vector2 } from "three";

export class TArray<T> {
    public get length() { return this._data.length; }
    public set length(value: number) { this._data.length = value; }
    public get isArray() { return true; }
    public get data() { return this._data; }

    private _data: T[] = [];
    private get _createItem(): () => T { return this["_createItem"] as () => T; }
    private get _copy(): (data: T[]) => void { return this["_copy"] as (data: T[]) => void; }

    constructor(ctor: new() => T) {
        Object.defineProperty(this, '_createItem', { 
            enumerable: false, 
            value: () => {
                if (ctor.name === "Number") {
                    return 0;
                }
                return new ctor();
            }
        });
        Object.defineProperty(this, '_copy', { 
            enumerable: false, 
            value: (data: T[]) => {
                if (ctor.name.endsWith("Vector2")) {
                    this._data = data.map(v => {
                        return new Vector2().copy(v as Vector2) as T;
                    });                    
                } else {
                    this._data = [...data];
                }
            }
        });
    }

    public grow() {
        this._data.push(this._createItem());
    }

    public copy(other: TArray<T>) {
        this._copy(other._data);
    }

    public map(fn: (item: T, index: number) => any) {
        return this._data.map(fn);
    }

    public at(index: number) {
        return this._data[index];
    }
}

