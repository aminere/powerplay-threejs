## Powerplay RTS Three.js Prototype

Full source code to the <a href="https://powerplayrts.com" target="_blank">Powerplay RTS</a> prototype, including game, engine, and editor.

![Thumbnail](/powerplay-threejs.webp)

## Play it live 🎮

<a href="https://powerplayrts.com/prototype/" target="_blank">Live Prototype</a> 

Press the Play button to Play 😃

## Setup instructions (Windows 11)

1. `npm install`

2. `cd editor` ▶️ `npm install`

:warning: Open a terminal in administrator mode

3. `cd editor/public` ▶️ `create-symlinks.bat` or `./create-symlinks.sh` if you have mingw

This will allow the editor to access the game data located in `game/public`, through sym links.

## Run the editor

1. `npm run build:watch`

:warning: Keep the above command running and open a new terminal. It will allow hot reload of the game library within the editor.

2. `cd editor` ▶️ `npm run dev`

open `http://localhost:5173` in a web browser

Press the play button! 🎮

## Run the game

Coming Soon 🔜

