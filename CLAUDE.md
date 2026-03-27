# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Dit is Mr. J's Game — een browsergame gebouwd in Mario-achtige stijl.

## Commands

- `npm run dev` — start Vite dev server met hot reloading
- `npm run build` — production build
- `./autocommit.sh` — auto-commit elke 2 minuten (of `./autocommit.sh 60` voor elke minuut)

## Architecture

Vanilla JavaScript met Vite (geen framework). Alles draait op een `<canvas>`.

- `index.html` — entry point, laadt canvas + `src/main.js`
- `src/main.js` — game loop, keyboard input, verbindt canvas met game
- `src/game.js` — game state: update + draw cycle, beheert alle game objecten
- `src/speler.js` — de speler (blokje), beweegt met pijltjestoetsen

**Patroon:** elk game object is een factory function die een object retourneert met `update(keys)` en `draw(ctx)` methods. Nieuwe objecten (vijanden, items, etc.) volgen dit patroon.

## Taal

Code variabelen en comments zijn in het **Nederlands** (speler, snelheid, grootte, etc.) voor leesbaarheid.
