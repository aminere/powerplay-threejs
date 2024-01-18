
export type Constructor<T> = { new(...args: any[]): T };

export const LoopModes = [
    "Once",
    "Repeat",
    "PingPong"
] as const;

export type LoopMode = typeof LoopModes[number];

