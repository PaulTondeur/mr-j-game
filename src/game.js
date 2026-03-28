import { createSpeler } from './speler.js'
import { createPaddestoel } from './paddestoel.js'
import { levels } from './levels.js'
import { themas } from './themas.js'
import { tekenWereld, tekenSprite, tekenSpeler } from './raycaster.js'

// Starthal
const startKaart = [
  '##########################',
  '#........................#',
  '#..1..2..3..4..5........#',
  '#........................#',
  '#..6..7..8..9..0........#',
  '#........................#',
  '#........................#',
  '#...........S............#',
  '##########################',
]

const portalen = []
let startPos = { x: 12.5, y: 7.5 }

for (let rij = 0; rij < startKaart.length; rij++) {
  for (let kolom = 0; kolom < startKaart[rij].length; kolom++) {
    const cel = startKaart[rij][kolom]
    if (cel === 'S') startPos = { x: kolom + 0.5, y: rij + 0.5 }
    if (cel >= '0' && cel <= '9') {
      portalen.push({
        x: kolom + 0.5, y: rij + 0.5,
        level: cel === '0' ? 9 : parseInt(cel) - 1,
        label: cel === '0' ? '10' : cel,
      })
    }
  }
}

export function createGame() {
  let scherm = 'start'
  let levelNummer = 0
  let tijd = 0
  const speler = createSpeler(startPos.x, startPos.y)

  let kaart = null
  let paddestoelen = []
  let finishPos = null

  function parseKaart(level) {
    let start, finish
    const pads = []
    for (let rij = 0; rij < level.kaart.length; rij++) {
      for (let kolom = 0; kolom < level.kaart[rij].length; kolom++) {
        const cel = level.kaart[rij][kolom]
        if (cel === 'S') start = { x: kolom + 0.5, y: rij + 0.5 }
        if (cel === 'F') finish = { x: kolom + 0.5, y: rij + 0.5 }
        if (cel === 'P') pads.push({ x: kolom + 0.5, y: rij + 0.5 })
      }
    }
    return { start, finish, paddestoelen: pads }
  }

  function startLevel(nummer) {
    scherm = 'level'
    levelNummer = nummer
    kaart = levels[nummer].kaart
    const parsed = parseKaart(levels[nummer])
    speler.x = parsed.start.x
    speler.y = parsed.start.y
    finishPos = parsed.finish
    paddestoelen = parsed.paddestoelen.map((p) => createPaddestoel(p.x, p.y))
  }

  function naarStart() {
    scherm = 'start'
    speler.x = startPos.x
    speler.y = startPos.y
    kaart = null
  }

  return {
    update(keys) {
      tijd += 1 / 60

      if (scherm === 'gameover') {
        if (keys[' ']) naarStart()
        return
      }

      if (scherm === 'start') {
        speler.update(keys, startKaart)
        for (const p of portalen) {
          const dx = speler.x - p.x
          const dy = speler.y - p.y
          if (Math.sqrt(dx * dx + dy * dy) < 0.5) { startLevel(p.level); return }
        }
      }

      if (scherm === 'level') {
        speler.update(keys, kaart)
        for (const p of paddestoelen) p.update(speler, kaart)
        for (const p of paddestoelen) {
          if (p.raaktSpeler(speler)) { scherm = 'gameover'; return }
        }
        if (finishPos) {
          const dx = speler.x - finishPos.x
          const dy = speler.y - finishPos.y
          if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
            if (levelNummer + 1 < levels.length) startLevel(levelNummer + 1)
            else naarStart()
          }
        }
      }
    },

    draw(ctx, canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (scherm === 'start') {
        tekenWereld(ctx, canvas, speler, startKaart, tijd)

        for (const p of portalen) {
          tekenSprite(ctx, canvas, speler, p.x, p.y, (c) => {
            // Rondje op de grond
            c.fillStyle = '#ffdd00'
            c.beginPath()
            c.ellipse(0, 0, 14, 14, 0, 0, Math.PI * 2)
            c.fill()
            c.strokeStyle = '#cc9900'
            c.lineWidth = 2
            c.stroke()
            // Bordje
            c.fillStyle = '#6b4226'
            c.fillRect(18, -28, 4, 30)
            c.fillStyle = '#dda54a'
            c.fillRect(8, -32, 26, 16)
            c.strokeStyle = '#8B4513'
            c.lineWidth = 2
            c.strokeRect(8, -32, 26, 16)
            c.fillStyle = '#442200'
            c.font = 'bold 12px monospace'
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText('Lv ' + p.label, 21, -24)
          })
        }

        tekenSpeler(ctx, canvas, (c) => speler.draw(c))
        tekenTitel(ctx, canvas, "Mr. J's Game", 'Loop naar een portaal!')
      }

      if (scherm === 'level') {
        tekenWereld(ctx, canvas, speler, kaart, tijd, themas[levels[levelNummer].thema])

        if (finishPos) {
          tekenSprite(ctx, canvas, speler, finishPos.x, finishPos.y, (c) => {
            c.fillStyle = '#ffdd00'
            c.beginPath()
            c.ellipse(0, 0, 16, 16, 0, 0, Math.PI * 2)
            c.fill()
            c.strokeStyle = '#cc9900'
            c.lineWidth = 2
            c.stroke()
            c.fillStyle = '#442200'
            c.font = 'bold 10px monospace'
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText('FINISH', 0, 0)
          })
        }

        for (const p of paddestoelen) {
          tekenSprite(ctx, canvas, speler, p.x, p.y, (c) => p.draw(c))
        }

        tekenSpeler(ctx, canvas, (c) => speler.draw(c))

        ctx.fillStyle = 'white'
        ctx.font = 'bold 20px monospace'
        ctx.textAlign = 'left'
        ctx.shadowColor = 'black'
        ctx.shadowBlur = 4
        ctx.fillText(levels[levelNummer].naam, 20, 30)
        ctx.shadowBlur = 0
      }

      if (scherm === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ff4444'
        ctx.font = 'bold 48px monospace'
        ctx.fillText('GAME OVER!', canvas.width / 2, canvas.height / 2 - 20)
        ctx.fillStyle = 'white'
        ctx.font = '20px monospace'
        ctx.fillText('Paddestoel geraakt!', canvas.width / 2, canvas.height / 2 + 20)
        ctx.font = '16px monospace'
        ctx.fillText('Druk op SPATIE om opnieuw te beginnen', canvas.width / 2, canvas.height / 2 + 60)
        ctx.textAlign = 'left'
      }
    },
  }
}

function tekenTitel(ctx, canvas, titel, subtitel) {
  ctx.shadowColor = 'black'
  ctx.shadowBlur = 4
  ctx.fillStyle = 'white'
  ctx.font = 'bold 28px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(titel, canvas.width / 2, 40)
  ctx.font = '14px monospace'
  ctx.fillText(subtitel, canvas.width / 2, 65)
  ctx.textAlign = 'left'
  ctx.shadowBlur = 0
}
