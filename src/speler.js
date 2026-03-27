export function createSpeler(x, y) {
  const grootte = 40
  const snelheid = 5
  const kleur = '#00ff88'

  return {
    x,
    y,

    update(keys) {
      if (keys['ArrowUp']) this.y -= snelheid
      if (keys['ArrowDown']) this.y += snelheid
      if (keys['ArrowLeft']) this.x -= snelheid
      if (keys['ArrowRight']) this.x += snelheid
    },

    draw(ctx) {
      ctx.fillStyle = kleur
      ctx.fillRect(this.x - grootte / 2, this.y - grootte / 2, grootte, grootte)
    },
  }
}
