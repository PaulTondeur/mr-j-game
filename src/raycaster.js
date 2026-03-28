// Bird's eye 3D renderer met thema-ondersteuning

const TEGEL = 40

export function tekenWereld(ctx, canvas, speler, kaart, tijd, thema) {
  const { width: breedte, height: hoogte } = canvas
  const cameraX = speler.x * TEGEL - breedte / 2
  const cameraY = speler.y * TEGEL - hoogte / 2

  const grasKleuren = thema?.gras || ['#3da52e', '#45b535']
  const waterBasis = thema?.water || [40, 100, 180]
  const randKleur = thema?.rand || '#c2b280'

  for (let rij = 0; rij < kaart.length; rij++) {
    for (let kolom = 0; kolom < kaart[rij].length; kolom++) {
      const sx = kolom * TEGEL - cameraX
      const sy = rij * TEGEL - cameraY
      if (sx + TEGEL < -5 || sx > breedte + 5 || sy + TEGEL < -5 || sy > hoogte + 5) continue

      const cel = kaart[rij][kolom]

      if (cel === '~') {
        const wave = Math.sin(kolom * 0.8 + rij * 0.6 + tijd * 2) * 12
        ctx.fillStyle = `rgb(${waterBasis[0] + wave},${waterBasis[1] + wave},${waterBasis[2] + wave})`
        ctx.fillRect(sx, sy, TEGEL, TEGEL)
      } else if (cel === '=') {
        // Water onder de brug
        const wave = Math.sin(kolom * 0.8 + rij * 0.6 + tijd * 2) * 12
        ctx.fillStyle = `rgb(${waterBasis[0] + wave},${waterBasis[1] + wave},${waterBasis[2] + wave})`
        ctx.fillRect(sx, sy, TEGEL, TEGEL)
        // Brug
        ctx.fillStyle = '#a07040'
        ctx.fillRect(sx + 4, sy, TEGEL - 8, TEGEL)
        ctx.strokeStyle = '#785530'
        ctx.lineWidth = 1
        for (let p = 0; p < TEGEL; p += 8) {
          ctx.beginPath()
          ctx.moveTo(sx + 4, sy + p)
          ctx.lineTo(sx + TEGEL - 4, sy + p)
          ctx.stroke()
        }
        // Leuningen
        ctx.fillStyle = '#6b4226'
        ctx.fillRect(sx + 2, sy, 3, TEGEL)
        ctx.fillRect(sx + TEGEL - 5, sy, 3, TEGEL)
      } else if (cel === '#') {
        ctx.fillStyle = '#555'
        ctx.fillRect(sx, sy, TEGEL, TEGEL)
      } else {
        // Eiland
        ctx.fillStyle = (rij + kolom) % 2 === 0 ? grasKleuren[0] : grasKleuren[1]
        ctx.fillRect(sx, sy, TEGEL, TEGEL)

        // Strandje naar water
        const boven = kaart[rij - 1]?.[kolom]
        const onder = kaart[rij + 1]?.[kolom]
        const links = kaart[rij]?.[kolom - 1]
        const rechts = kaart[rij]?.[kolom + 1]
        ctx.fillStyle = randKleur
        if (boven === '~' || boven === '=') ctx.fillRect(sx, sy, TEGEL, 4)
        if (onder === '~' || onder === '=') ctx.fillRect(sx, sy + TEGEL - 4, TEGEL, 4)
        if (links === '~' || links === '=') ctx.fillRect(sx, sy, 4, TEGEL)
        if (rechts === '~' || rechts === '=') ctx.fillRect(sx + TEGEL - 4, sy, 4, TEGEL)

        // Thema decoraties
        if (thema?.decoraties) {
          thema.decoraties(ctx, kolom, rij, sx, sy, TEGEL, tijd)
        }
      }
    }
  }

  // Thema effect (regen, zon, mist, borden)
  if (thema?.effect) {
    thema.effect(ctx, breedte, hoogte, tijd)
  }
}

export function tekenSprite(ctx, canvas, speler, spriteX, spriteY, tekenFunctie) {
  const cameraX = speler.x * TEGEL - canvas.width / 2
  const cameraY = speler.y * TEGEL - canvas.height / 2
  const sx = spriteX * TEGEL - cameraX
  const sy = spriteY * TEGEL - cameraY
  if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return
  ctx.save()
  ctx.translate(sx, sy)
  tekenFunctie(ctx)
  ctx.restore()
}

export function tekenSpeler(ctx, canvas, tekenFunctie) {
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  tekenFunctie(ctx)
  ctx.restore()
}
