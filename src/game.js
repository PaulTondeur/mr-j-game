import { createSpeler } from './speler.js'
import { createDoel } from './doel.js'
import { createPaddestoel } from './paddestoel.js'
import { levels } from './levels.js'

export function createGame() {
  let scherm = 'start' // 'start', 'level', of 'gameover'
  let levelNummer = 0
  const speler = createSpeler(400, 450)

  // 10 rondjes op het startscherm, 2 rijen van 5
  const doelen = levels.map((level, i) => {
    const kolom = i % 5
    const rij = Math.floor(i / 5)
    const x = 160 + kolom * 130
    const y = 200 + rij * 120
    return { doel: createDoel(x, y), level: i }
  })

  let huidigLevel = null
  let paddestoelen = []

  function startLevel(nummer) {
    scherm = 'level'
    levelNummer = nummer
    huidigLevel = levels[nummer]
    speler.x = huidigLevel.spelerStart.x
    speler.y = huidigLevel.spelerStart.y
    paddestoelen = huidigLevel.paddestoelen.map((p) => createPaddestoel(p.x, p.y))
  }

  function naarStart() {
    scherm = 'start'
    speler.x = 400
    speler.y = 450
  }

  function raaktMuur(px, py, muren) {
    const s = 15
    for (const muur of muren) {
      if (
        px + s > muur.x &&
        px - s < muur.x + muur.breedte &&
        py + s > muur.y &&
        py - s < muur.y + muur.hoogte
      ) {
        return true
      }
    }
    return false
  }

  return {
    update(keys) {
      if (scherm === 'gameover') {
        if (keys[' ']) {
          naarStart()
        }
        return
      }

      if (scherm === 'start') {
        speler.update(keys)
        for (const { doel, level } of doelen) {
          if (doel.raaktSpeler(speler)) {
            startLevel(level)
            return
          }
        }
      }

      if (scherm === 'level' && huidigLevel) {
        const oudeX = speler.x
        const oudeY = speler.y

        speler.update(keys)

        if (raaktMuur(speler.x, speler.y, huidigLevel.muren)) {
          speler.x = oudeX
          speler.y = oudeY
        }

        // Paddestoelen bewegen
        for (const paddestoel of paddestoelen) {
          paddestoel.update(speler, huidigLevel.muren)
        }

        // Paddestoel geraakt = game over!
        for (const paddestoel of paddestoelen) {
          if (paddestoel.raaktSpeler(speler)) {
            scherm = 'gameover'
            return
          }
        }

        // Check finish
        const finish = huidigLevel.finish
        const dx = speler.x - finish.x
        const dy = speler.y - finish.y
        if (Math.sqrt(dx * dx + dy * dy) < 30) {
          if (levelNummer + 1 < levels.length) {
            startLevel(levelNummer + 1)
          } else {
            naarStart()
          }
        }
      }
    },

    draw(ctx, canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (scherm === 'start') {
        ctx.fillStyle = 'white'
        ctx.font = 'bold 28px monospace'
        ctx.textAlign = 'center'
        ctx.fillText("Mr. J's Game", canvas.width / 2, 60)
        ctx.font = '14px monospace'
        ctx.fillText('Loop naar een rondje om een level te starten!', canvas.width / 2, 90)

        for (const { doel, level } of doelen) {
          doel.draw(ctx)
          ctx.fillStyle = '#333'
          ctx.font = 'bold 16px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(level + 1, doel.x, doel.y)
        }
        ctx.textBaseline = 'alphabetic'
        ctx.textAlign = 'left'

        speler.draw(ctx)
      }

      if (scherm === 'level' && huidigLevel) {
        // Muren tekenen
        ctx.fillStyle = '#555'
        for (const muur of huidigLevel.muren) {
          ctx.fillRect(muur.x, muur.y, muur.breedte, muur.hoogte)
        }

        // Paddestoelen tekenen
        for (const paddestoel of paddestoelen) {
          paddestoel.draw(ctx)
        }

        // Finish tekenen
        const finish = huidigLevel.finish
        ctx.fillStyle = '#ffdd00'
        ctx.beginPath()
        ctx.arc(finish.x, finish.y, 20, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffaa00'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = 'white'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('FINISH', finish.x, finish.y - 28)
        ctx.textAlign = 'left'

        speler.draw(ctx)

        ctx.fillStyle = 'white'
        ctx.font = 'bold 20px monospace'
        ctx.fillText(huidigLevel.naam, 30, 50)
      }

      if (scherm === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = '#ff4444'
        ctx.font = 'bold 48px monospace'
        ctx.textAlign = 'center'
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
