// Mario pixel art (12x16 pixels, opgeschaald)
const marioPixels = [
  '...rrrrr...',
  '..rrrrrrrrr',
  '..bbbhhbh..',
  '.bhbhhhbhhh',
  '.bhbbhhhbhh',
  '.bbhhhbbbb.',
  '...hhhhhh..',
  '..rrbrrr...',
  '.rrrbrbrrrr',
  'rrrrbbbrrr.',
  'hhrbbbbrhh.',
  'hhhbbbbbhh.',
  'hhbb..bbhh.',
  '..bbb..bbb.',
  '.bbb....bbb',
  '...........',
]

const kleuren = {
  r: '#ff0000', // rood (pet + shirt)
  b: '#8B4513', // bruin (haar + schoenen)
  h: '#ffcc99', // huid
  '.': null,    // doorzichtig
}

export function createSpeler(x, y) {
  const pixelGrootte = 3
  const snelheid = 5
  const breedte = marioPixels[0].length * pixelGrootte
  const hoogte = marioPixels.length * pixelGrootte

  return {
    x,
    y,
    breedte,
    hoogte,

    update(keys) {
      if (keys['ArrowUp']) this.y -= snelheid
      if (keys['ArrowDown']) this.y += snelheid
      if (keys['ArrowLeft']) this.x -= snelheid
      if (keys['ArrowRight']) this.x += snelheid
    },

    draw(ctx) {
      const startX = this.x - breedte / 2
      const startY = this.y - hoogte / 2

      for (let rij = 0; rij < marioPixels.length; rij++) {
        for (let kolom = 0; kolom < marioPixels[rij].length; kolom++) {
          const kleur = kleuren[marioPixels[rij][kolom]]
          if (kleur) {
            ctx.fillStyle = kleur
            ctx.fillRect(
              startX + kolom * pixelGrootte,
              startY + rij * pixelGrootte,
              pixelGrootte,
              pixelGrootte
            )
          }
        }
      }
    },
  }
}
