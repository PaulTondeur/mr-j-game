const marioStil = [
  '..rrr..',
  '.rrrrr.',
  '.rhhrh.',
  'rhhhhhr',
  '.rrrrr.',
  '.rr.rr.',
  '.bb.bb.',
]
const marioLoop1 = [
  '..rrr..',
  '.rrrrr.',
  '.rhhrh.',
  'rhhhhhr',
  '.rrrrr.',
  'rr...rr',
  'bb...bb',
]
const marioLoop2 = [
  '..rrr..',
  '.rrrrr.',
  '.rhhrh.',
  'rhhhhhr',
  '.rrrrr.',
  '..rr.rr',
  '..bb.bb',
]

const kleuren = { r: '#ff0000', b: '#8B4513', h: '#ffcc99', '.': null }
const loopFrames = [marioLoop1, marioStil, marioLoop2, marioStil]

function tekenPixels(ctx, pixels, schaal) {
  const b = pixels[0].length * schaal
  const h = pixels.length * schaal
  for (let rij = 0; rij < pixels.length; rij++) {
    for (let kolom = 0; kolom < pixels[rij].length; kolom++) {
      const kleur = kleuren[pixels[rij][kolom]]
      if (kleur) {
        ctx.fillStyle = kleur
        ctx.fillRect(-b / 2 + kolom * schaal, -h / 2 + rij * schaal, schaal, schaal)
      }
    }
  }
}

function blokkert(cel) {
  return !cel || cel === '#' || cel === '~'
}

function isVrij(kaart, px, py, marge) {
  return (
    !blokkert(kaart[Math.floor(py - marge)]?.[Math.floor(px - marge)]) &&
    !blokkert(kaart[Math.floor(py - marge)]?.[Math.floor(px + marge)]) &&
    !blokkert(kaart[Math.floor(py + marge)]?.[Math.floor(px - marge)]) &&
    !blokkert(kaart[Math.floor(py + marge)]?.[Math.floor(px + marge)])
  )
}

export function createSpeler(x, y) {
  const snelheid = 0.07
  const marge = 0.2
  let loopTeller = 0
  let loopt = false

  return {
    x,
    y,

    update(keys, kaart) {
      let dx = 0, dy = 0
      if (keys['ArrowUp']) dy -= snelheid
      if (keys['ArrowDown']) dy += snelheid
      if (keys['ArrowLeft']) dx -= snelheid
      if (keys['ArrowRight']) dx += snelheid

      loopt = dx !== 0 || dy !== 0
      if (loopt) loopTeller += 0.15; else loopTeller = 0

      if (isVrij(kaart, this.x + dx, this.y + dy, marge)) { this.x += dx; this.y += dy }
      else if (isVrij(kaart, this.x + dx, this.y, marge)) { this.x += dx }
      else if (isVrij(kaart, this.x, this.y + dy, marge)) { this.y += dy }
    },

    draw(ctx) {
      const frame = loopt ? loopFrames[Math.floor(loopTeller) % loopFrames.length] : marioStil
      tekenPixels(ctx, frame, 4)
    },
  }
}
