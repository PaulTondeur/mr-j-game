export function createPaddestoel(x, y) {
  const snelheid = 0.01

  return {
    x,
    y,

    update(speler, kaart) {
      const dx = speler.x - this.x
      const dy = speler.y - this.y
      const afstand = Math.sqrt(dx * dx + dy * dy)
      if (afstand > 0.3) {
        const nieuweX = this.x + (dx / afstand) * snelheid
        const nieuweY = this.y + (dy / afstand) * snelheid
        const cel = kaart[Math.floor(nieuweY)]?.[Math.floor(nieuweX)]
        if (cel && cel !== '#' && cel !== '~') {
          this.x = nieuweX
          this.y = nieuweY
        }
      }
    },

    raaktSpeler(speler) {
      const dx = this.x - speler.x
      const dy = this.y - speler.y
      return Math.sqrt(dx * dx + dy * dy) < 0.4
    },

    draw(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.beginPath()
      ctx.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#eeddbb'
      ctx.fillRect(-3, -2, 6, 8)
      ctx.fillStyle = '#cc0000'
      ctx.beginPath()
      ctx.arc(0, -4, 10, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(-4, -7, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(3, -6, 2, 0, Math.PI * 2)
      ctx.fill()
    },
  }
}
