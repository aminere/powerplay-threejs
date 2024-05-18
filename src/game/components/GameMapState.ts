import { Box2, Camera, DirectionalLight, MathUtils, Object3D, OrthographicCamera, Vector2, Vector3 } from "three";
import { ICell, ISector } from "../GameTypes";
import { TileSector } from "../TileSelector";
import { Action } from "../GameDefinitions";
import { utils } from "../../engine/Utils";
import { engine } from "../../engine/Engine";
import { config } from "../config/config";
import { BuildableType, BuildableTypes, BuildingType, IBuildingInstance } from "../buildings/BuildingTypes";
import { PathViewer } from "../pathfinding/PathViewer";
import { depots } from "../buildings/Depots";

const root = () => engine.scene!;

export class GameMapState {   

    public static get instance() { return this._instance!; }
    private static _instance: GameMapState | null = null;    

    public sectorRes = 1;
    public sectorsRoot = utils.createObject(root(), "sectors");
    public sectors = new Map<string, ISector>();
    public previousRoad: Vector2[] = [];
    public previousRail: ICell[] = [];
    public previousConveyors: Vector2[] = [];
    public cameraZoom = 1;
    public cameraAngleRad = 0;
    public cameraTween: gsap.core.Tween | null = null;
    public cameraRoot: Object3D;
    public cameraPivot: Object3D;
    public camera: Camera;
    public light: DirectionalLight;
    public cameraBoundsAccessors = [0, 1, 2, 3];
    public cameraBounds = [
        new Vector3(), // top
        new Vector3(), // right
        new Vector3(), // bottom
        new Vector3() // left
    ];

    public pressedKeys = new Set<string>();
    public previousTouchPos = new Vector2();
    public tileSelector: TileSector = null!;
    public selectedCellCoords = new Vector2();
    public highlightedCellCoords = new Vector2();
    public touchStartCoords = new Vector2();
    public touchHoveredCoords = new Vector2();
    public touchDragged = false;
    public selectionInProgress = false;
    public layers = {
        rails: utils.createObject(root(), "rails"),
        trains: utils.createObject(root(), "trains"),
        cars: utils.createObject(root(), "cars"),
        buildings: utils.createObject(root(), "buildings"),
        conveyors: utils.createObject(root(), "conveyors"),
        conveyorsPreview: utils.createObject(root(), "conveyors-preview"),
        pickedItems: utils.createObject(root(), "pickedItems"),
        trees: utils.createObject(root(), "trees"),
        flyingItems: utils.createObject(root(), "flyingItems")        
    };
    public buildings = new Map<string, IBuildingInstance>();
    public depotsCache = new Map<string, IBuildingInstance[]>();
    public rails = new Map<string, Object3D>();
    public initialDragAxis: "x" | "z" | null= null;
    public bounds: Box2 | null = null;
    public liquidPatches = new Map<string, {
        id: string;
        cells: Vector2[];
        resourceAmount: number;
    }>();
    
    public enabled = {
        minimap: false,
        sideActions: {
            self: false,
            enabled: {
                build: {
                    self: false,
                    enabled: BuildableTypes.reduce((prev, cur) => {
                        return {
                            ...prev,
                            [cur]: false
                        }
                    }, {} as Record<BuildableType, boolean>)
                }                
            }
        },
        bottomPanels: false,
        actionPanel: false,
        cameraPan: false
    };

    public debug = {
        path: new PathViewer(),
        selectedElem: new PathViewer()
    };

    public get cursorOverUI() { return this._cursorOverUI; }
    public set cursorOverUI(value: boolean) {
        this._cursorOverUI = value;
        if (this.action) {
            this.tileSelector.visible = !value;
        }
    }

    public get action() { return this._action; }
    public set action(value: Action | null) {
        this._action = value;
        if (!value) {
            this.tileSelector.visible = false;
            this.tileSelector.resolution = 1;
            depots.highlightDepotRanges(false);
        } else {
            switch (value) {
                case "building": {                    
                    depots.highlightDepotRanges(true);
                }
                break;
            }
        }
    }

    private _cursorOverUI = false;
    private _action: Action | null = null;
    
    constructor() {
        GameMapState._instance = this;

        this.cameraRoot = root().getObjectByName("camera-root")!;
        const camera = this.cameraRoot.getObjectByProperty("type", "OrthographicCamera") as OrthographicCamera;        
        this.camera = camera;
        this.cameraPivot = this.camera.parent!;

        const light = this.cameraRoot.getObjectByProperty("type", "DirectionalLight") as DirectionalLight;
        this.light = light;
        
        // configure for best shadows
        camera.position.z = 150;
        camera.far = 300;
        light.shadow.camera.far = 200;
        light.position.set(51, 87, 15);        

        const [, rotationY] = config.camera.rotation;
        this.cameraAngleRad = MathUtils.degToRad(rotationY);

        this.tileSelector = new TileSector();
        this.tileSelector.visible = false;
        root().add(this.tileSelector);        
        root().add(this.debug.path);
        root().add(this.debug.selectedElem);
    }   

    public dispose() {
        GameMapState._instance = null;
    }
}

