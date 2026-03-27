import { createSpeler } from './speler.js'

export function createGame() {
  const speler = createSpeler(400, 300)

  return {
    update(keys) {
      speler.update(keys)
    },

    draw(ctx, canvas) {
      // Scherm leegmaken
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Speler tekenen
      speler.draw(ctx)
    },
  }
}
