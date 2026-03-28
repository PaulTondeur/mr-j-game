export function createDoel(x, y) {
  const straal = 20
  const kleur = '#ffdd00'

  return {
    x,
    y,
    straal,

    raaktSpeler(speler) {
      const dx = this.x - speler.x
      const dy = this.y - speler.y
      const afstand = Math.sqrt(dx * dx + dy * dy)
      return afstand < straal + 15
    },

    draw(ctx) {
      ctx.fillStyle = kleur
      ctx.beginPath()
      ctx.arc(this.x, this.y, straal, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = '#ffaa00'
      ctx.lineWidth = 2
      ctx.stroke()
    },
  }
}
