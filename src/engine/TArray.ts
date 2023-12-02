
export class TArray<T> {
    public get length() { return this._array.length; }
    public set length(value: number) { this._array.length = value; }
    public get isArray() { return true; }

    private _array: T[] = [];
    private get _createItem(): () => T { return this["_createItem"] as () => T; }

    constructor(ctor: { new(): T; }) {
        Object.defineProperty(this, '_createItem', { 
            enumerable: false, 
            value: () => new ctor()
        });
    }

    public grow() {
        this._array.push(this._createItem());
    }

    public copy(other: TArray<T>) {
        this._array = [...other._array];
    }

    public map(fn: (item: T, index: number) => any) {
        return this._array.map(fn);
    }
}

