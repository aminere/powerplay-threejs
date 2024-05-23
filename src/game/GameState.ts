
class GameState {
    public set tutorialCompleted(value: boolean) { this._tutorialCompleted = value; }
    public get tutorialCompleted() { return this._tutorialCompleted; }

    private _tutorialCompleted = false;
}

export const gameState = new GameState();

