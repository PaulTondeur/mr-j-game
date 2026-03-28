export function createPaddestoel(x, y) {
  const grootte = 12
  const snelheid = 0.5

  return {
    x,
    y,

    update(speler, muren) {
      const dx = speler.x - this.x
      const dy = speler.y - this.y
      const afstand = Math.sqrt(dx * dx + dy * dy)
      if (afstand > 0) {
        const nieuweX = this.x + (dx / afstand) * snelheid
        const nieuweY = this.y + (dy / afstand) * snelheid

        const raaktMuur = muren.some(
          (m) =>
            nieuweX + grootte > m.x &&
            nieuweX - grootte < m.x + m.breedte &&
            nieuweY + grootte > m.y &&
            nieuweY - grootte < m.y + m.hoogte
        )

        if (!raaktMuur) {
          this.x = nieuweX
          this.y = nieuweY
        }
      }
    },

    raaktSpeler(speler) {
      const dx = this.x - speler.x
      const dy = this.y - speler.y
      return Math.sqrt(dx * dx + dy * dy) < grootte + 12
    },

    draw(ctx) {
      // Steel
      ctx.fillStyle = '#eeddbb'
      ctx.fillRect(this.x - 4, this.y, 8, 10)

      // Hoed
      ctx.fillStyle = '#cc0000'
      ctx.beginPath()
      ctx.arc(this.x, this.y, grootte, Math.PI, 0)
      ctx.fill()

      // Witte stippen
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(this.x - 5, this.y - 6, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(this.x + 4, this.y - 4, 2.5, 0, Math.PI * 2)
      ctx.fill()
    },
  }
}
