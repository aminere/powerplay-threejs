
class GameState {
    public set inGameMenuOpen(value: boolean) { this._inGameMenuOpen = value; }
    public get inGameMenuOpen() { return this._inGameMenuOpen; }
    public set tutorialCompleted(value: boolean) { this._tutorialCompleted = value; }
    public get tutorialCompleted() { return this._tutorialCompleted; }

    private _tutorialCompleted = false;
    private _inGameMenuOpen = false;
}

export const gameState = new GameState();

