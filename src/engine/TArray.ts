import { Color, Vector2 } from "three";

export class TArray<T> {
    public get length() { return this._data.length; }
    public set length(value: number) { this._data.length = value; }
    public get isArray() { return true; }
    public get data() { return this._data; }    

    private _data: T[] = [];
    private get createItem() { return (this as any)["_createItem"] as () => T; }    
    private get copyInternal() { return (this as any)["_copy"] as (data: T[]) => void; }

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
                } else if (ctor.name.endsWith("Color")) {
                    this._data = data.map(v => {
                        return new Color().set(v as Color) as T;
                    });
                } else {
                    this._data = [...data];
                }
            }
        });
    }

    public grow() {
        this._data.push(this.createItem());
    }

    public copy(other: TArray<T>) {
        this.copyInternal(other._data);
    }

    public map(fn: (item: T, index: number) => any) {
        return this._data.map(fn);
    }

    public at(index: number) {
        return this._data[index];
    }
}

