import { Game } from "./game.js";

const canvas = document.getElementById("game-canvas");
const uiRoot = document.getElementById("ui-root");

new Game(canvas, uiRoot);
