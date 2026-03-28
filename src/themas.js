// Thema's per level — kleuren, decoraties en effecten

export const themas = {
  strand: {
    gras: ['#e8d68c', '#dbc87a'],   // zand
    water: [30, 140, 220],           // helder blauw
    rand: '#f5e6b8',                 // licht zand
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      // Schelpen en zeesterren
      const seed = kolom * 7 + rij * 13
      if (seed % 11 === 0) {
        ctx.fillStyle = '#ffccaa'
        ctx.beginPath()
        ctx.arc(sx + 15, sy + 20, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      if (seed % 17 === 0) {
        // Palmboom
        ctx.fillStyle = '#8B6914'
        ctx.fillRect(sx + 18, sy - 10, 5, 30)
        ctx.fillStyle = '#228B22'
        ctx.beginPath()
        ctx.ellipse(sx + 20, sy - 14, 14, 8, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    effect: null,
  },

  bos: {
    gras: ['#2d5a1e', '#1e4a12'],   // donker groen
    water: [20, 70, 40],             // donker water
    rand: '#3a6b2a',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 5 === 0) {
        // Boom
        ctx.fillStyle = '#4a2a0a'
        ctx.fillRect(sx + 17, sy + 5, 6, 20)
        ctx.fillStyle = '#1a6b1a'
        ctx.beginPath()
        ctx.moveTo(sx + 20, sy - 12)
        ctx.lineTo(sx + 8, sy + 10)
        ctx.lineTo(sx + 32, sy + 10)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(sx + 20, sy - 6)
        ctx.lineTo(sx + 10, sy + 5)
        ctx.lineTo(sx + 30, sy + 5)
        ctx.fill()
      }
    },
    effect: null,
  },

  regen: {
    gras: ['#3a6633', '#2d5528'],    // nat groen
    water: [40, 80, 120],            // grijs water
    rand: '#5a7a55',
    decoraties: null,
    effect(ctx, breedte, hoogte, tijd) {
      ctx.strokeStyle = 'rgba(180,200,220,0.4)'
      ctx.lineWidth = 1
      for (let i = 0; i < 120; i++) {
        const x = (i * 37 + tijd * 300) % (breedte + 40) - 20
        const y = (i * 53 + tijd * 500) % (hoogte + 40) - 20
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - 3, y + 12)
        ctx.stroke()
      }
    },
  },

  zomer: {
    gras: ['#5cb835', '#4da82a'],    // fris groen
    water: [30, 150, 230],           // helder blauw
    rand: '#c2b280',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 9 === 0) {
        // Vlinder
        const vx = sx + 20 + Math.sin(tijd * 3 + seed) * 10
        const vy = sy + 10 + Math.cos(tijd * 2 + seed) * 5
        ctx.fillStyle = seed % 2 ? '#ff88cc' : '#ffaa44'
        ctx.beginPath()
        ctx.ellipse(vx - 3, vy, 4, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(vx + 3, vy, 4, 3, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    effect(ctx, breedte, hoogte, tijd) {
      // Zon
      ctx.fillStyle = '#ffe844'
      ctx.beginPath()
      ctx.arc(breedte - 60, 50, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,232,68,0.2)'
      ctx.beginPath()
      ctx.arc(breedte - 60, 50, 45, 0, Math.PI * 2)
      ctx.fill()
    },
  },

  bloemen: {
    gras: ['#4a9a35', '#3d8a2a'],
    water: [40, 120, 190],
    rand: '#7ab86a',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 4 === 0) {
        const kleuren = ['#ff4466', '#ffaa22', '#ff66cc', '#aa44ff', '#4488ff']
        const kleur = kleuren[seed % kleuren.length]
        const bx = sx + 10 + (seed % 20)
        const by = sy + 8 + (seed % 15)
        // Stengel
        ctx.strokeStyle = '#2a7a1a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(bx, by + 6)
        ctx.lineTo(bx, by)
        ctx.stroke()
        // Bloem
        ctx.fillStyle = kleur
        for (let p = 0; p < 5; p++) {
          const hoek = (p / 5) * Math.PI * 2
          ctx.beginPath()
          ctx.arc(bx + Math.cos(hoek) * 3, by + Math.sin(hoek) * 3, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#ffee44'
        ctx.beginPath()
        ctx.arc(bx, by, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    effect: null,
  },

  mario: {
    gras: ['#5cb835', '#4da82a'],
    water: [30, 100, 200],
    rand: '#c2a060',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 7 === 0) {
        // Vraagteken blok
        const bob = Math.sin(tijd * 3 + seed) * 2
        ctx.fillStyle = '#dda020'
        ctx.fillRect(sx + 10, sy + 5 + bob, 20, 20)
        ctx.strokeStyle = '#aa7010'
        ctx.lineWidth = 2
        ctx.strokeRect(sx + 10, sy + 5 + bob, 20, 20)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('?', sx + 20, sy + 15 + bob)
      }
      if (seed % 13 === 0) {
        // Munt
        const spin = Math.abs(Math.sin(tijd * 4 + seed))
        ctx.fillStyle = '#ffcc00'
        ctx.beginPath()
        ctx.ellipse(sx + 25, sy + 15, 6 * spin, 6, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#cc9900'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    },
    effect: null,
  },

  huis: {
    gras: ['#4a9a35', '#3d8a2a'],
    water: [30, 110, 180],
    rand: '#8a7a5a',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 9 === 0) {
        // Huisje
        ctx.fillStyle = '#cc6633'
        ctx.fillRect(sx + 8, sy + 10, 24, 18)
        // Dak
        ctx.fillStyle = '#8B0000'
        ctx.beginPath()
        ctx.moveTo(sx + 5, sy + 10)
        ctx.lineTo(sx + 20, sy - 4)
        ctx.lineTo(sx + 35, sy + 10)
        ctx.fill()
        // Deur
        ctx.fillStyle = '#6b3311'
        ctx.fillRect(sx + 17, sy + 16, 7, 12)
        // Raam
        ctx.fillStyle = '#aaddff'
        ctx.fillRect(sx + 11, sy + 13, 5, 5)
      }
      if (seed % 15 === 0) {
        // Hekje
        ctx.fillStyle = '#ddd'
        for (let h = 0; h < 4; h++) {
          ctx.fillRect(sx + 5 + h * 9, sy + 20, 3, 12)
        }
        ctx.fillRect(sx + 4, sy + 22, 30, 2)
        ctx.fillRect(sx + 4, sy + 28, 30, 2)
      }
    },
    effect: null,
  },

  spookjes: {
    gras: ['#2a2a3a', '#222233'],    // donker
    water: [15, 20, 40],             // zwart water
    rand: '#3a3a4a',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 6 === 0) {
        // Spookje
        const bob = Math.sin(tijd * 2 + seed) * 5
        const gx = sx + 20
        const gy = sy + 12 + bob
        ctx.fillStyle = 'rgba(220,220,255,0.7)'
        ctx.beginPath()
        ctx.arc(gx, gy, 8, Math.PI, 0)
        ctx.lineTo(gx + 8, gy + 10)
        ctx.lineTo(gx + 4, gy + 7)
        ctx.lineTo(gx, gy + 10)
        ctx.lineTo(gx - 4, gy + 7)
        ctx.lineTo(gx - 8, gy + 10)
        ctx.fill()
        // Ogen
        ctx.fillStyle = '#111'
        ctx.beginPath()
        ctx.arc(gx - 3, gy - 2, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(gx + 3, gy - 2, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    effect(ctx, breedte, hoogte, tijd) {
      // Mist
      ctx.fillStyle = 'rgba(100,100,130,0.15)'
      ctx.fillRect(0, 0, breedte, hoogte)
    },
  },

  boerderij: {
    gras: ['#5aaa35', '#4d9a2a'],
    water: [40, 120, 180],
    rand: '#8a7a4a',
    decoraties(ctx, kolom, rij, sx, sy, T, tijd) {
      const seed = kolom * 7 + rij * 13
      if (seed % 8 === 0) {
        // Koe
        const kx = sx + 18
        const ky = sy + 18
        ctx.fillStyle = 'white'
        ctx.fillRect(kx - 8, ky - 4, 16, 10)
        ctx.fillStyle = '#222'
        ctx.fillRect(kx - 5, ky - 2, 5, 4)
        ctx.fillRect(kx + 2, ky, 4, 3)
        // Hoofd
        ctx.fillStyle = 'white'
        ctx.fillRect(kx + 8, ky - 5, 6, 7)
        ctx.fillStyle = '#ffaaaa'
        ctx.fillRect(kx + 9, ky - 1, 4, 3)
        // Poten
        ctx.fillStyle = '#222'
        ctx.fillRect(kx - 6, ky + 6, 2, 4)
        ctx.fillRect(kx + 4, ky + 6, 2, 4)
      }
      if (seed % 12 === 0) {
        // Kaas
        ctx.fillStyle = '#ffd700'
        ctx.beginPath()
        ctx.moveTo(sx + 10, sy + 25)
        ctx.lineTo(sx + 22, sy + 25)
        ctx.lineTo(sx + 19, sy + 18)
        ctx.lineTo(sx + 7, sy + 18)
        ctx.fill()
        ctx.fillStyle = '#eec600'
        ctx.beginPath()
        ctx.arc(sx + 13, sy + 22, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    effect: null,
  },

  borden: {
    gras: ['#4a9a55', '#3d8a48'],
    water: [30, 120, 200],
    rand: '#7aba7a',
    decoraties: null,
    effect(ctx, breedte, hoogte, tijd) {
      // Vliegende borden
      const teksten = ['MR.J!', 'COOL!', 'WOW!', 'YES!', 'TOP!', 'NICE!', 'GO!', 'YAY!']
      for (let i = 0; i < 8; i++) {
        const x = ((i * 137 + tijd * 60) % (breedte + 200)) - 100
        const y = 40 + i * 55 + Math.sin(tijd * 2 + i * 1.5) * 20
        const rot = Math.sin(tijd * 1.5 + i) * 0.15

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rot)
        ctx.fillStyle = ['#ff4444', '#44aaff', '#ffaa22', '#44dd44', '#ff66cc', '#aa88ff', '#ff8844', '#44dddd'][i]
        ctx.fillRect(-28, -12, 56, 24)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.strokeRect(-28, -12, 56, 24)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(teksten[i], 0, 0)
        ctx.restore()
      }
    },
  },
}
