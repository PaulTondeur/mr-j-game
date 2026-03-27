import { createGame } from './game.js'

const canvas = document.getElementById('game')
canvas.width = 800
canvas.height = 600

const ctx = canvas.getContext('2d')
const game = createGame()

// Toetsen bijhouden
const keys = {}
window.addEventListener('keydown', (e) => {
  keys[e.key] = true
  e.preventDefault()
})
window.addEventListener('keyup', (e) => {
  keys[e.key] = false
})

// Game loop
function loop() {
  game.update(keys)
  game.draw(ctx, canvas)
  requestAnimationFrame(loop)
}

loop()
