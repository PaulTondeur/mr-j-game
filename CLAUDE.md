# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Dit is Mr. J's Game — een 3D browsergame in Mario-achtige stijl met Three.js.

## Commands

- `npm run dev` — start Vite dev server met hot reloading
- `npm run build` — production build

## Architecture

Three.js + Vite. 3D bird's eye / third-person camera.

- `index.html` — entry point met HUD overlay
- `src/main.js` — game loop, keyboard input
- `src/game.js` — game state, Three.js scene setup, camera, speler logica, level management
- `src/wereld3d.js` — 3D objecten: wereld tiles, Mario model, paddestoelen, finish, portalen
- `src/levels.js` — 10 eiland-levels als grid kaarten (~ = water, . = grond, = = brug, S/F/P)
- `src/themas.js` — visuele thema's per level (kleuren, decoraties)

## Taal

Code variabelen en comments zijn in het **Nederlands** voor leesbaarheid.
