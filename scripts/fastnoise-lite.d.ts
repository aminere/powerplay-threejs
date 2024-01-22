/**
 * @description FastNoiseLite Lite is an extremely portable open source noise generation library with a large selection of noise algorithms
 * @author Jordan Peck, snowfoxsh
 * @version 1.1.0
 * @copyright Copyright(c) 2023 Jordan Peck, Contributors
 * @license MIT
 * @git https://github.com/Auburn/FastNoiseLite
 * @npm https://www.npmjs.com/package/fastnoise-lite
 * @example
// Import from npm (if you used npm)

import FastNoiseLite from "fastnoise-lite";

// Create and configure FastNoiseLite object

let noise = new FastNoiseLite();
noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);

// Gather noise data
let noiseData = [];

for (let x = 0; x < 128; x++) {
    noiseData[x] = [];

    for (let y = 0; y < 128; y++) {
        noiseData[x][y] = noise.GetNoise(x,y);
    }
}

// Do something with this data...
 */
export default class FastNoiseLite {
    /**
     * @static
     * @enum {string}
     * @type {Readonly<{Cellular: string, OpenSimplex2: string, Value: string, ValueCubic: string, Perlin: string, OpenSimplex2S: string}>}
     */
    static NoiseType: Readonly<{
        Cellular: "Cellular";
        OpenSimplex2: "OpenSimplex2";
        Value: "Value";
        ValueCubic: "ValueCubic";
        Perlin: "Perlin";
        OpenSimplex2S: "OpenSimplex2S";
    }>;

    /**
     * @static
     * @enum {string}
     * @type {Readonly<{ImproveXYPlanes: string, ImproveXZPlanes: string, None: string}>}
     */
    static RotationType3D: Readonly<{
        ImproveXYPlanes: string;
        ImproveXZPlanes: string;
        None: string;
    }>;
    /**
     * @static
     * @enum {string}
     * @type {Readonly<{FBm: string, DomainWarpIndependent: string, PingPong: string, None: string, Ridged: string, DomainWarpProgressive: string}>}
     */
    static FractalType: Readonly<{
        FBm: "FBm";
        DomainWarpIndependent: "DomainWarpIndependent";
        PingPong: "PingPong";
        None: "None";
        Ridged: "Ridged";
        DomainWarpProgressive: "DomainWarpProgressive";
    }>;
    /**
     * @static
     * @enum {string}
     * @type {Readonly<{EuclideanSq: string, Euclidean: string, Hybrid: string, Manhattan: string}>}
     */
    static CellularDistanceFunction: Readonly<{
        EuclideanSq: "EuclideanSq";
        Euclidean: "Euclidean";
        Hybrid: "Hybrid";
        Manhattan: "Manhattan";
    }>;
    /**
     * @static
     * @enum {string}
     * @type {Readonly<{Distance2Sub: string, Distance2Mul: string, Distance2Add: string, Distance2Div: string, CellValue: string, Distance: string, Distance2: string}>}
     */
    static CellularReturnType: Readonly<{
        Distance2Sub: string;
        Distance2Mul: string;
        Distance2Add: string;
        Distance2Div: string;
        CellValue: string;
        Distance: string;
        Distance2: string;
    }>;
    /**
     * @static
     * @enum {string}
     * @type {Readonly<{BasicGrid: string, OpenSimplex2Reduced: string, OpenSimplex2: string}>}
     */
    static DomainWarpType: Readonly<{
        BasicGrid: string;
        OpenSimplex2Reduced: string;
        OpenSimplex2: string;
    }>;
    /**
     * @static
     * @enum {string}
     * @type {Readonly<{ImproveXYPlanes: string, ImproveXZPlanes: string, None: string, DefaultOpenSimplex2: string}>}
     */
    static TransformType3D: Readonly<{
        ImproveXYPlanes: string;
        ImproveXZPlanes: string;
        None: string;
        DefaultOpenSimplex2: string;
    }>;
    /**
     * @private
     * @param {number} a
     * @param {number} b
     * @param {number} t
     * @returns {number}
     */
    private static _Lerp;
    /**
     * @private
     * @param {number} t
     * @returns {number}
     */
    private static _InterpHermite;
    /**
     * @private
     * @param t
     * @returns {number}
     */
    private static _InterpQuintic;
    /**
     * @private
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @param {number} d
     * @param {number} t
     * @returns {number}
     */
    private static _CubicLerp;
    /**
     * @private
     * @param {number} t
     * @returns {number}
     */
    private static _PingPong;
    /**
     * @description Create new FastNoiseLite object with optional seed
     * @param {number} [seed]
     * @constructor
     */
    constructor(seed?: number);
    _Seed: number;
    _Frequency: number;
    _NoiseType: string;
    _RotationType3D: string;
    _TransformType3D: string;
    _DomainWarpAmp: number;
    _FractalType: string;
    _Octaves: number;
    _Lacunarity: number;
    _Gain: number;
    _WeightedStrength: number;
    _PingPongStrength: number;
    _FractalBounding: number;
    _CellularDistanceFunction: string;
    _CellularReturnType: string;
    _CellularJitterModifier: number;
    _DomainWarpType: string;
    _WarpTransformType3D: string;
    /**
     * @description Sets seed used for all noise types
     * @remarks Default: 1337
     * @default 1337
     * @param {number} seed
     */
    SetSeed(seed: number): void;
    /**
     * @description Sets frequency for all noise types
     * @remarks Default: 0.01
     * @default 0.01
     * @param {number} frequency
     */
    SetFrequency(frequency: number): void;
    /**
     * @description Sets noise algorithm used for GetNoise(...)
     * @remarks Default: OpenSimplex2
     * @default FastNoiseLite.NoiseType.OpenSimplex2
     * @param {FastNoiseLite.NoiseType} noiseType
     */
    SetNoiseType(noiseType: keyof typeof FastNoiseLite.NoiseType): void;
    /**
     * @description Sets domain rotation type for 3D Noise and 3D DomainWarp.
     * @description Can aid in reducing directional artifacts when sampling a 2D plane in 3D
     * @remarks Default: None
     * @default FastNoiseLite.RotationType3D.None
     * @param {FastNoiseLite.RotationType3D} rotationType3D
     */
    SetRotationType3D(rotationType3D: Readonly<{
        ImproveXYPlanes: string;
        ImproveXZPlanes: string;
        None: string;
    }>): void;
    /**
     * @description Sets method for combining octaves in all fractal noise types
     * @remarks Default: None
     * @default FastNoiseLite.FractalType.None
     * @param {FastNoiseLite.FractalType} fractalType
     */
    SetFractalType(fractalType: keyof typeof FastNoiseLite.FractalType): void;
    /**
     * @description Sets octave count for all fractal noise types
     * @remarks Default: 3
     * @default 3
     * @param {number} octaves
     */
    SetFractalOctaves(octaves: number): void;
    /**
     * @description Sets octave lacunarity for all fractal noise types
     * @remarks Default: 2.0
     * @default 2.0
     * @param {number} lacunarity
     */
    SetFractalLacunarity(lacunarity: number): void;
    /**
     * @description Sets octave gain for all fractal noise types
     * @remarks Default: 0.5
     * @default 0.5
     * @param {number} gain
     */
    SetFractalGain(gain: number): void;
    /**
     * @description Sets octave weighting for all none DomainWarp fratal types
     * @remarks Default: 0.0 | Keep between 0...1 to maintain -1...1 output bounding
     * @default 0.5
     * @param {number} weightedStrength
     */
    SetFractalWeightedStrength(weightedStrength: number): void;
    /**
     * @description Sets strength of the fractal ping pong effect
     * @remarks Default: 2.0
     * @default 2.0
     * @param {number} pingPongStrength
     */
    SetFractalPingPongStrength(pingPongStrength: number): void;
    /**
     * @description Sets distance function used in cellular noise calculations
     * @remarks Default: EuclideanSq
     * @default FastNoiseLite.CellularDistanceFunction.EuclideanSq
     * @param {FastNoiseLite.CellularDistanceFunction} cellularDistanceFunction
     */
    SetCellularDistanceFunction(cellularDistanceFunction: keyof typeof FastNoiseLite.CellularDistanceFunction): void;
    /**
     * @description Sets return type from cellular noise calculations
     * @remarks Default: Distance
     * @default FastNoiseLite.CellularReturnType.Distance
     * @param {FastNoiseLite.CellularReturnType} cellularReturnType
     */
    SetCellularReturnType(cellularReturnType: Readonly<{
        Distance2Sub: string;
        Distance2Mul: string;
        Distance2Add: string;
        Distance2Div: string;
        CellValue: string;
        Distance: string;
        Distance2: string;
    }>): void;
    /**
     * @description Sets the maximum distance a cellular point can move from it's grid position
     * @remarks Default: 1.0
     * @default 1.0
     * @param {number} cellularJitter
     */
    SetCellularJitter(cellularJitter: number): void;
    /**
     * @description Sets the warp algorithm when using DomainWarp(...)
     * @remarks Default: OpenSimplex2
     * @default FastNoiseLite.DomainWarpType.OpenSimplex2
     * @param {FastNoiseLite.DomainWarpType} domainWarpType
     */
    SetDomainWarpType(domainWarpType: Readonly<{
        BasicGrid: string;
        OpenSimplex2Reduced: string;
        OpenSimplex2: string;
    }>): void;
    /**
     * @description Sets the maximum warp distance from original position when using DomainWarp(...)
     * @remarks Default: 1.0
     * @default 1.0
     * @param {number} domainWarpAmp
     */
    SetDomainWarpAmp(domainWarpAmp: number): void;
    /**
     * @description 2D/3D noise at given position using current settings
     * @param {number} x X coordinate
     * @param {number} y Y coordinate
     * @param {number} [z] Z coordinate
     * @return {number} Noise output bounded between -1...1
     */
    GetNoise(x: number, y: number, z?: number, ...args: any[]): number;
    /**
     * @description 2D/3D warps the input position using current domain warp settings
     * @param {Vector2|Vector3} coord
     */
    DomainWrap(coord: Vector2 | Vector3): void;
    _Gradients2D: number[];
    _RandVecs2D: number[];
    _Gradients3D: number[];
    _RandVecs3D: number[];
    _PrimeX: number;
    _PrimeY: number;
    _PrimeZ: number;
    /**
     * @private
     */
    private _CalculateFractalBounding;
    /**
     * @private
     * @param {number} seed
     * @param {number} xPrimed
     * @param {number} yPrimed
     * @returns {number}
     */
    private _HashR2;
    /**
     *
     * @param {number} seed
     * @param {number} xPrimed
     * @param {number} yPrimed
     * @param {number} zPrimed
     * @returns {number}
     */
    _HashR3(seed: number, xPrimed: number, yPrimed: number, zPrimed: number): number;
    /**
     * @private
     * @param {number} seed
     * @param {number} xPrimed
     * @param {number} yPrimed
     * @returns {number}
     */
    private _ValCoordR2;
    /**
     *
     * @param {number} seed
     * @param {number} xPrimed
     * @param {number} yPrimed
     * @param {number} zPrimed
     * @returns {number}
     */
    _ValCoordR3(seed: number, xPrimed: number, yPrimed: number, zPrimed: number): number;
    /**
     *
     * @param {number} seed
     * @param {number} xPrimed
     * @param {number} yPrimed
     * @param {number} xd
     * @param {number} yd
     * @returns {number}
     */
    _GradCoordR2(seed: number, xPrimed: number, yPrimed: number, xd: number, yd: number): number;
    /**
     *
     * @param {number} seed
     * @param {number} xPrimed
     * @param {number} yPrimed
     * @param {number} zPrimed
     * @param {number} xd
     * @param {number} yd
     * @param {number} zd
     * @returns {number}
     */
    _GradCoordR3(seed: number, xPrimed: number, yPrimed: number, zPrimed: number, xd: number, yd: number, zd: number): number;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _GenNoiseSingleR2;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _GenNoiseSingleR3;
    /**
     * @private
     */
    private _UpdateTransformType3D;
    /**
     * @private
     */
    private _UpdateWarpTransformType3D;
    /**
     * @private
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _GenFractalFBmR2;
    /**
     * @private
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _GenFractalFBmR3;
    /**
     * @private
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _GenFractalRidgedR2;
    /**
     * @private
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _GenFractalRidgedR3;
    /**
     * @private
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _GenFractalPingPongR2;
    /**
     * @private
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _GenFractalPingPongR3;
    /**
     *
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    _SingleOpenSimplex2R2(seed: number, x: number, y: number): number;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _SingleOpenSimplex2R3;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _SingleOpenSimplex2SR2;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _SingleOpenSimplex2SR3;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _SingleCellularR2;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _SingleCellularR3;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _SinglePerlinR2;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _SinglePerlinR3;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _SingleValueCubicR2;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _SingleValueCubicR3;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    private _SingleValueR2;
    /**
     * @private
     * @param {number} seed
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {number}
     */
    private _SingleValueR3;
    /**
     * @private
     */
    private _DoSingleDomainWarp;
    /**
     * @private
     */
    private _DomainWarpSingle;
    _DomainWarpFractalProgressive(...args: any[]): void;
    /**
     * @private
     */
    private _DomainWarpFractalIndependent;
    /**
     * @private
     */
    private _SingleDomainWarpBasicGrid;
    /**
     * @private
     */
    private _SingleDomainWarpOpenSimplex2Gradient;
}
declare class Vector2 {
    /**
     * 2d Vector
     * @param {number} x
     * @param {number} y
     */
    constructor(x: number, y: number);
    x: number;
    y: number;
}
declare class Vector3 {
    /**
     * 3d Vector
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    constructor(x: number, y: number, z: number);
    x: number;
    y: number;
    z: number;
}
export {};

