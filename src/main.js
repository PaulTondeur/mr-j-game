import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { levels } from './levels.js'
import { themas } from './themas.js'

// === MODEL LOADER ===
const glbPad = import.meta.env.BASE_URL + 'models/kenney/'
const loader = new GLTFLoader()
const modelCache = {}

// Kenney colormap texture (gedeeld door alle modellen)
const textureLoader = new THREE.TextureLoader()
let kenneyTexture = null
textureLoader.load(import.meta.env.BASE_URL + 'models/kenney/variation-a.png', (tex) => {
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  kenneyTexture = tex
})

function laadModel(naam) {
  if (modelCache[naam]) return Promise.resolve(modelCache[naam].clone())
  return new Promise((resolve) => {
    loader.load(glbPad + naam + '.glb', (gltf) => {
      // Pas Kenney texture toe op alle meshes
      if (kenneyTexture) {
        gltf.scene.traverse(child => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone()
            child.material.map = kenneyTexture
            child.material.needsUpdate = true
          }
        })
      }
      modelCache[naam] = gltf.scene
      resolve(gltf.scene.clone())
    }, undefined, () => resolve(null))
  })
}

const TEGEL = 2

// Geluiden
const boerAudio = new Audio(import.meta.env.BASE_URL + 'geluid/boer.m4a')
const bahSanderAudio = new Audio(import.meta.env.BASE_URL + 'geluid/bah-sander.m4a')

// === ACHTERGROND MUZIEK (Mario-stijl chiptune) ===
let muziekCtx = null
let muziekSpeelt = false
let muziekInterval = null

function startMuziek() {
  if (muziekSpeelt || !geluidAan) return
  try {
    if (!muziekCtx) muziekCtx = new (window.AudioContext || window.webkitAudioContext)()
    muziekSpeelt = true
    // Mario melodie [frequentie, duur in ms]
    const melodie = [
      [660,100],[660,100],[0,100],[660,100],[0,100],[520,100],[660,100],[0,100],
      [784,100],[0,300],[392,100],[0,300],
      [520,100],[0,100],[392,100],[0,100],[330,100],[0,100],
      [440,100],[0,100],[494,100],[0,100],[466,100],[440,100],[0,100],
      [392,100],[660,100],[784,100],[880,100],[0,100],
      [700,100],[784,100],[0,100],[660,100],[0,100],[520,100],[587,100],[494,100],[0,100],
      [520,100],[0,100],[392,100],[0,100],[330,100],[0,100],
      [440,100],[0,100],[494,100],[0,100],[466,100],[440,100],[0,100],
      [392,100],[660,100],[784,100],[880,100],[0,100],
      [700,100],[784,100],[0,100],[660,100],[0,100],[520,100],[587,100],[494,100],[0,200],
    ]
    let nootIdx = 0
    function speelNoot() {
      if (!muziekSpeelt || !geluidAan) { muziekInterval = null; muziekSpeelt = false; return }
      const [freq, duur] = melodie[nootIdx % melodie.length]
      if (freq > 0) {
        const osc = muziekCtx.createOscillator()
        const gain = muziekCtx.createGain()
        osc.type = 'square'
        osc.frequency.value = freq
        gain.gain.value = 0.04
        gain.gain.exponentialRampToValueAtTime(0.001, muziekCtx.currentTime + duur / 1000)
        osc.connect(gain); gain.connect(muziekCtx.destination)
        osc.start(); osc.stop(muziekCtx.currentTime + duur / 1000)
      }
      nootIdx++
      muziekInterval = setTimeout(speelNoot, duur)
    }
    speelNoot()
  } catch (e) {}
}

function stopMuziek() {
  muziekSpeelt = false
  if (muziekInterval) { clearTimeout(muziekInterval); muziekInterval = null }
}

// Spring geluid
let springGeluidActief = false
function speelSpringGeluid() {
  if (!geluidAan || springGeluidActief) return
  springGeluidActief = true
  stopMuziek()
  try {
    if (!muziekCtx) muziekCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = muziekCtx.createOscillator()
    const gain = muziekCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, muziekCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(800, muziekCtx.currentTime + 0.15)
    gain.gain.value = 0.12
    gain.gain.exponentialRampToValueAtTime(0.001, muziekCtx.currentTime + 0.2)
    osc.connect(gain); gain.connect(muziekCtx.destination)
    osc.start(); osc.stop(muziekCtx.currentTime + 0.2)
  } catch (e) {}
}

// Game over / dood geluid
function speelDoodGeluid() {
  if (!geluidAan) return
  try {
    const ctx = muziekCtx || new (window.AudioContext || window.webkitAudioContext)()
    const noten = [494, 440, 392, 330, 294, 262]
    noten.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.value = 1.0
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * 0.2)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + (i + 1) * 0.15)
    })
  } catch (e) {}
}

// Start muziek direct + bij elke interactie (browser vereist user gesture voor audio)
setTimeout(() => { if (geluidAan) startMuziek() }, 100)
document.addEventListener('click', () => { if (!muziekSpeelt && geluidAan && !nijntjeSpeelt) startMuziek() }, { once: false })
document.addEventListener('keydown', () => { if (!muziekSpeelt && geluidAan && !nijntjeSpeelt) startMuziek() }, { once: false })
document.addEventListener('touchstart', () => { if (!muziekSpeelt && geluidAan && !nijntjeSpeelt) startMuziek() }, { once: false })
// Versterkt via Web Audio
let bahGain = null
try {
  const bahCtx = new (window.AudioContext || window.webkitAudioContext)()
  const bahBron = bahCtx.createMediaElementSource(bahSanderAudio)
  bahGain = bahCtx.createGain()
  bahGain.gain.value = 8.0
  bahBron.connect(bahGain)
  bahGain.connect(bahCtx.destination)
} catch (e) { bahSanderAudio.volume = 1.0 }
function speelBoer() {
  try {
    // Boer: 1 op 8 keer
    if (geluidAan && Math.random() < 1 / 8) {
      boerAudio.currentTime = 0
      boerAudio.play()
      // "Bah Sander" reactie: 1 op 3 keer na een boer
      if (Math.random() < 1 / 3) {
        setTimeout(() => {
          bahSanderAudio.currentTime = 0
          bahSanderAudio.play()
        }, 1500)
      }
    }
  } catch (e) {}
}

// === RENDERER ===
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.domElement.classList.add('game-canvas')
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x4aa4e8)
scene.fog = new THREE.Fog(0x4aa4e8, 40, 120)

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)

function resize() {
  const vv = window.visualViewport
  const w = vv ? vv.width : window.innerWidth
  const h = vv ? vv.height : window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
}
resize()
window.addEventListener('resize', resize)
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize)

// Pauzeer als window focus verliest
let windowFocus = true
window.addEventListener('blur', () => { windowFocus = false })
window.addEventListener('focus', () => { windowFocus = true; vorigeTijd = performance.now() / 1000 })

// Muis voor first-person camera
let muisDX = 0, fpKijkY = 0
document.addEventListener('mousemove', (e) => {
  if (cameraView === 'ingezoomd' && document.pointerLockElement) {
    spelerRichting -= e.movementX * 0.003
    fpKijkY = Math.max(-0.8, Math.min(0.8, fpKijkY - e.movementY * 0.003))
  }
})
renderer.domElement.addEventListener('click', () => {
  if (cameraView === 'ingezoomd' && !document.pointerLockElement) {
    renderer.domElement.requestPointerLock()
  }
})
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && cameraView === 'ingezoomd') {
    // Pointer lock verloren, reset
  }
})

// === LICHT ===
scene.add(new THREE.AmbientLight(0xffffff, 0.6))
const zon = new THREE.DirectionalLight(0xffffff, 1.0)
zon.position.set(10, 15, 5)
zon.castShadow = true
zon.shadow.mapSize.set(1024, 1024)
zon.shadow.camera.left = -20
zon.shadow.camera.right = 20
zon.shadow.camera.top = 20
zon.shadow.camera.bottom = -20
scene.add(zon)
scene.add(zon.target)

// Zee
const zee = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 100),
  new THREE.MeshStandardMaterial({ color: 0x2090d0, transparent: true, opacity: 0.5 })
)
zee.rotation.x = -Math.PI / 2
zee.position.y = -0.3
scene.add(zee)

// === SKYBOX ACHTERGROND ===
// Verwijder canvas-achtergrond, gebruik een afbeelding op een grote kubus
// Alleen blauwe achtergrond
const skybox = null

// Dummy variabelen (canvas-achtergrond is weg)
const bgMesh = null
const wolken = []

// Skip oude canvas-code
if (false) {
const bgCanvas = document.createElement('canvas')
bgCanvas.width = 1; bgCanvas.height = 1
const bg = bgCanvas.getContext('2d')

// Lucht — warm, levendig, Mario-blauw
const luchtGrad = bg.createLinearGradient(0, 0, 0, 2048)
luchtGrad.addColorStop(0, '#2878c8')
luchtGrad.addColorStop(0.25, '#4aa4e8')
luchtGrad.addColorStop(0.5, '#7ec8f4')
luchtGrad.addColorStop(0.7, '#b0e0ff')
luchtGrad.addColorStop(0.85, '#d8f0ff')
luchtGrad.addColorStop(1, '#c8e8c0')
bg.fillStyle = luchtGrad
bg.fillRect(0, 0, 4096, 2048)

// Zon met stralen
bg.fillStyle = 'rgba(255,250,200,0.15)'
for (let i = 0; i < 12; i++) {
  bg.save(); bg.translate(3200, 300); bg.rotate(i * Math.PI / 6)
  bg.fillRect(-15, 0, 30, 400); bg.restore()
}
bg.fillStyle = '#fff8d0'
bg.beginPath(); bg.arc(3200, 300, 120, 0, Math.PI * 2); bg.fill()
bg.fillStyle = '#fffef0'
bg.beginPath(); bg.arc(3200, 300, 90, 0, Math.PI * 2); bg.fill()

// Wolken — groot, pluizig, Mario-stijl
function tekenWolk(cx, cy, schaal) {
  bg.fillStyle = '#ffffff'
  const s = schaal
  bg.beginPath(); bg.arc(cx, cy, 40*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(cx-35*s, cy+10*s, 30*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(cx+35*s, cy+10*s, 32*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(cx-55*s, cy+20*s, 22*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(cx+58*s, cy+18*s, 24*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(cx-20*s, cy+25*s, 28*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(cx+20*s, cy+25*s, 26*s, 0, Math.PI*2); bg.fill()
  // Schaduw onderaan
  bg.fillStyle = 'rgba(200,220,255,0.4)'
  bg.beginPath(); bg.ellipse(cx, cy+35*s, 70*s, 12*s, 0, 0, Math.PI*2); bg.fill()
}
tekenWolk(400, 250, 1.8)
tekenWolk(1200, 180, 2.2)
tekenWolk(2200, 280, 1.6)
tekenWolk(3000, 200, 2.0)
tekenWolk(3800, 320, 1.4)
tekenWolk(700, 450, 1.2)
tekenWolk(1800, 400, 1.5)
tekenWolk(2800, 480, 1.1)
tekenWolk(3500, 420, 1.3)

// Verre bergen — zacht blauw, ronde toppen
function tekenHeuvelRij(baseY, kleur, heuvels) {
  bg.fillStyle = kleur
  bg.beginPath(); bg.moveTo(0, baseY)
  for (const [hx, hy, hr] of heuvels) {
    bg.quadraticCurveTo(hx - hr, baseY, hx, hy)
    bg.quadraticCurveTo(hx + hr, baseY, hx + hr * 1.5, baseY)
  }
  bg.lineTo(4096, baseY); bg.lineTo(4096, 2048); bg.lineTo(0, 2048); bg.fill()
}

// Laag 4: verre blauwe bergen
tekenHeuvelRij(1100, '#8ab4d4', [[200,850,200],[600,780,250],[1100,820,300],[1600,760,280],[2100,800,250],[2600,750,300],[3100,790,250],[3600,830,200],[4000,780,250]])

// Laag 3: groene bergen
tekenHeuvelRij(1200, '#5a9a5a', [[100,950,180],[500,900,220],[900,930,250],[1400,880,230],[1900,920,200],[2400,870,260],[2900,910,220],[3400,890,240],[3900,940,180]])

// Laag 2: frisgroene heuvels
tekenHeuvelRij(1350, '#5cb835', [[0,1100,160],[350,1080,200],[700,1120,180],[1050,1060,220],[1400,1100,190],[1750,1050,210],[2100,1090,200],[2500,1060,180],[2800,1100,220],[3200,1070,200],[3600,1110,180],[4000,1080,160]])

// Laag 1: voorgrond heuvels (donkergroen)
tekenHeuvelRij(1450, '#4a9a2a', [[150,1300,150],[500,1280,180],[850,1310,160],[1200,1270,190],[1600,1300,170],[2000,1260,200],[2400,1290,180],[2800,1270,190],[3200,1300,170],[3600,1280,160],[4000,1310,150]])

// === GROND MET MARIO-LEVEL ===
// Aarde/grond
bg.fillStyle = '#b87830'
bg.fillRect(0, 1650, 4096, 400)
bg.fillStyle = '#6cb835'
bg.fillRect(0, 1600, 4096, 55)
// Gras tufjes
bg.fillStyle = '#5aaa2a'
for (let gx = 0; gx < 4096; gx += 60 + Math.random() * 40) {
  const gh = 8 + Math.random() * 12
  bg.beginPath()
  bg.moveTo(gx, 1600); bg.quadraticCurveTo(gx+5, 1600-gh, gx+10, 1600)
  bg.moveTo(gx+8, 1600); bg.quadraticCurveTo(gx+14, 1600-gh-3, gx+20, 1600)
  bg.moveTo(gx+16, 1600); bg.quadraticCurveTo(gx+21, 1600-gh+2, gx+26, 1600)
  bg.fill()
}

// Kleine ronde heuveltjes op de grond
for (const [hx, hr] of [[200,50],[550,35],[900,55],[1300,40],[1700,60],[2100,45],[2500,50],[2900,38],[3300,55],[3700,42]]) {
  bg.fillStyle = '#5cb835'
  bg.beginPath(); bg.arc(hx, 1600, hr, Math.PI, 0); bg.fill()
  bg.fillStyle = '#4da82a'
  bg.beginPath(); bg.arc(hx, 1600, hr * 0.7, Math.PI, 0); bg.fill()
}

// Pijpen (groot, gedetailleerd)
function tekenPijp(px, ph) {
  // Buis
  const breedte = 50
  bg.fillStyle = '#28a028'
  bg.fillRect(px - breedte/2, 1600 - ph, breedte, ph)
  // Lichte zijde
  bg.fillStyle = '#3acd3a'
  bg.fillRect(px - breedte/2, 1600 - ph, breedte * 0.3, ph)
  // Rand bovenaan
  bg.fillStyle = '#30bb30'
  bg.fillRect(px - breedte/2 - 8, 1600 - ph, breedte + 16, 18)
  bg.fillStyle = '#3acd3a'
  bg.fillRect(px - breedte/2 - 8, 1600 - ph, (breedte + 16) * 0.3, 18)
  // Donkere rand
  bg.fillStyle = '#1a7a1a'
  bg.fillRect(px + breedte/2 - 4, 1600 - ph, 4, ph)
  bg.fillRect(px + breedte/2 + 4, 1600 - ph, 4, 18)
}
tekenPijp(400, 80)
tekenPijp(1100, 110)
tekenPijp(1800, 70)
tekenPijp(2500, 95)
tekenPijp(3200, 85)
tekenPijp(3800, 105)

// Blokken in de lucht
function tekenVraagBlok(bx, by, s) {
  bg.fillStyle = '#e8a818'
  bg.fillRect(bx, by, s, s)
  bg.fillStyle = '#f0c030'
  bg.fillRect(bx+2, by+2, s-4, s-4)
  bg.strokeStyle = '#c08010'
  bg.lineWidth = 2
  bg.strokeRect(bx, by, s, s)
  bg.fillStyle = '#fff'
  bg.font = 'bold ' + Math.floor(s*0.7) + 'px monospace'
  bg.textAlign = 'center'; bg.textBaseline = 'middle'
  bg.fillText('?', bx+s/2, by+s/2+2)
  // Bolletjes in de hoeken
  bg.fillStyle = '#c08010'
  for (const [cx,cy] of [[bx+5,by+5],[bx+s-5,by+5],[bx+5,by+s-5],[bx+s-5,by+s-5]]) {
    bg.beginPath(); bg.arc(cx,cy,3,0,Math.PI*2); bg.fill()
  }
}
function tekenBaksteen(bx, by, s) {
  bg.fillStyle = '#c06020'
  bg.fillRect(bx, by, s, s)
  bg.strokeStyle = '#904818'
  bg.lineWidth = 1.5
  bg.strokeRect(bx, by, s, s)
  bg.strokeRect(bx, by, s/2, s/2)
  bg.strokeRect(bx+s/2, by+s/2, s/2, s/2)
}
// Blokkenrij 1
for (let i = 0; i < 5; i++) tekenBaksteen(700 + i*40, 1420, 38)
tekenVraagBlok(740, 1420, 38)
tekenVraagBlok(820, 1420, 38)
// Blokkenrij 2
for (let i = 0; i < 3; i++) tekenBaksteen(2000 + i*40, 1440, 38)
tekenVraagBlok(2040, 1440, 38)
// Blokkenrij 3
for (let i = 0; i < 7; i++) tekenBaksteen(3000 + i*40, 1400, 38)
tekenVraagBlok(3080, 1400, 38)
tekenVraagBlok(3160, 1400, 38)

// Muntjes
bg.fillStyle = '#ffd700'
for (const [mx,my] of [[760,1380],[800,1380],[840,1380],[2060,1400],[2100,1400],[3100,1360],[3140,1360],[3180,1360],[3220,1360]]) {
  bg.beginPath(); bg.arc(mx,my,8,0,Math.PI*2); bg.fill()
  bg.strokeStyle = '#cc9900'; bg.lineWidth = 1.5; bg.stroke()
  bg.fillStyle = '#ffee44'
  bg.beginPath(); bg.arc(mx-2,my-2,3,0,Math.PI*2); bg.fill()
  bg.fillStyle = '#ffd700'
}

// === MARIO KARAKTERS IN ACTIE ===
function tekenMarioRennend(fx, fy, petKleur, letter, s, spiegelX) {
  bg.save()
  if (spiegelX) { bg.translate(fx * 2, 0); bg.scale(-1, 1) }
  // Schaduw
  bg.fillStyle = 'rgba(0,0,0,0.12)'
  bg.beginPath(); bg.ellipse(fx, fy+2, 12*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  // Achterbeen (gestrekt naar achteren)
  bg.fillStyle = '#2b3caa'
  bg.save(); bg.translate(fx-4*s, fy-4*s); bg.rotate(0.5)
  bg.fillRect(-2*s, 0, 5*s, 12*s); bg.restore()
  // Achterschoen
  bg.fillStyle = '#7a3f10'
  bg.beginPath(); bg.ellipse(fx-10*s, fy+2*s, 5*s, 3*s, -0.3, 0, Math.PI*2); bg.fill()
  // Voorbeen (gebogen naar voren)
  bg.fillStyle = '#2b3caa'
  bg.save(); bg.translate(fx+3*s, fy-4*s); bg.rotate(-0.4)
  bg.fillRect(-2*s, 0, 5*s, 10*s); bg.restore()
  // Voorschoen
  bg.fillStyle = '#7a3f10'
  bg.beginPath(); bg.ellipse(fx+8*s, fy+1*s, 5*s, 3*s, 0.2, 0, Math.PI*2); bg.fill()
  // Lichaam
  bg.fillStyle = '#2b3caa'
  bg.beginPath(); bg.ellipse(fx, fy-12*s, 8*s, 7*s, 0.1, 0, Math.PI*2); bg.fill()
  // Shirt
  bg.fillStyle = petKleur
  bg.beginPath(); bg.ellipse(fx, fy-20*s, 7*s, 5*s, 0, 0, Math.PI*2); bg.fill()
  // Achterarm (zwaai naar achteren)
  bg.fillStyle = petKleur
  bg.save(); bg.translate(fx-5*s, fy-18*s); bg.rotate(0.6)
  bg.fillRect(-2*s, 0, 4*s, 9*s); bg.restore()
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.arc(fx-10*s, fy-13*s, 3*s, 0, Math.PI*2); bg.fill()
  // Voorarm (zwaai naar voren)
  bg.fillStyle = petKleur
  bg.save(); bg.translate(fx+5*s, fy-18*s); bg.rotate(-0.7)
  bg.fillRect(-2*s, 0, 4*s, 9*s); bg.restore()
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.arc(fx+10*s, fy-13*s, 3*s, 0, Math.PI*2); bg.fill()
  // Hoofd
  bg.fillStyle = '#fec29a'
  bg.beginPath(); bg.arc(fx+2*s, fy-28*s, 8*s, 0, Math.PI*2); bg.fill()
  // Ogen
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.ellipse(fx+4*s, fy-30*s, 3*s, 3.5*s, 0, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#1a6aff'
  bg.beginPath(); bg.arc(fx+5*s, fy-30*s, 2*s, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#111'
  bg.beginPath(); bg.arc(fx+5.5*s, fy-30*s, 1.2*s, 0, Math.PI*2); bg.fill()
  // Neus
  bg.fillStyle = '#e8a070'
  bg.beginPath(); bg.ellipse(fx+8*s, fy-27*s, 4*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  // Snor
  bg.fillStyle = '#3a1800'
  bg.beginPath(); bg.ellipse(fx+4*s, fy-24*s, 6*s, 2*s, -0.1, 0, Math.PI*2); bg.fill()
  // Pet
  bg.fillStyle = petKleur
  bg.beginPath(); bg.arc(fx+2*s, fy-32*s, 9*s, Math.PI, 0); bg.fill()
  bg.fillRect(fx+4*s, fy-37*s, 12*s, 3.5*s) // klep
  // Pet embleem
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.arc(fx+5*s, fy-34*s, 4*s, 0, Math.PI*2); bg.fill()
  bg.fillStyle = petKleur
  bg.font = 'bold ' + Math.floor(5*s) + 'px sans-serif'
  bg.textAlign = 'center'; bg.textBaseline = 'middle'
  bg.fillText(letter, fx+5*s, fy-33.5*s)
  bg.restore()
}

function tekenMarioSpringend(fx, fy, petKleur, letter, s) {
  // Schaduw (klein, ver weg)
  bg.fillStyle = 'rgba(0,0,0,0.08)'
  bg.beginPath(); bg.ellipse(fx, fy+40*s, 8*s, 2*s, 0, 0, Math.PI*2); bg.fill()
  // Benen gespreid
  bg.fillStyle = '#2b3caa'
  bg.save(); bg.translate(fx-3*s, fy); bg.rotate(0.3)
  bg.fillRect(-2*s, 0, 5*s, 10*s); bg.restore()
  bg.save(); bg.translate(fx+3*s, fy); bg.rotate(-0.3)
  bg.fillRect(-2*s, 0, 5*s, 10*s); bg.restore()
  // Schoenen
  bg.fillStyle = '#7a3f10'
  bg.beginPath(); bg.ellipse(fx-7*s, fy+10*s, 4*s, 3*s, 0.3, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.ellipse(fx+7*s, fy+10*s, 4*s, 3*s, -0.3, 0, Math.PI*2); bg.fill()
  // Lichaam
  bg.fillStyle = '#2b3caa'
  bg.beginPath(); bg.ellipse(fx, fy-5*s, 8*s, 6*s, 0, 0, Math.PI*2); bg.fill()
  // Shirt
  bg.fillStyle = petKleur
  bg.beginPath(); bg.ellipse(fx, fy-13*s, 7*s, 5*s, 0, 0, Math.PI*2); bg.fill()
  // Arm omhoog (vuist in de lucht!)
  bg.fillStyle = petKleur
  bg.fillRect(fx+4*s, fy-25*s, 4*s, 12*s)
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.arc(fx+6*s, fy-27*s, 3.5*s, 0, Math.PI*2); bg.fill()
  // Andere arm
  bg.fillStyle = petKleur
  bg.save(); bg.translate(fx-5*s, fy-12*s); bg.rotate(0.5)
  bg.fillRect(-2*s, 0, 4*s, 8*s); bg.restore()
  // Hoofd
  bg.fillStyle = '#fec29a'
  bg.beginPath(); bg.arc(fx, fy-22*s, 8*s, 0, Math.PI*2); bg.fill()
  // Blij gezicht
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.ellipse(fx+2*s, fy-24*s, 3*s, 3.5*s, 0, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#111'
  bg.beginPath(); bg.arc(fx+3*s, fy-24*s, 1.5*s, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#e8a070'
  bg.beginPath(); bg.ellipse(fx+6*s, fy-21*s, 3.5*s, 2.5*s, 0, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#3a1800'
  bg.beginPath(); bg.ellipse(fx+3*s, fy-18*s, 5*s, 2*s, 0, 0, Math.PI*2); bg.fill()
  // Open mond (blij!)
  bg.fillStyle = '#222'
  bg.beginPath(); bg.arc(fx+2*s, fy-17*s, 2.5*s, 0, Math.PI); bg.fill()
  // Pet
  bg.fillStyle = petKleur
  bg.beginPath(); bg.arc(fx, fy-26*s, 9*s, Math.PI, 0); bg.fill()
  bg.fillRect(fx+2*s, fy-31*s, 12*s, 3.5*s)
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.arc(fx+4*s, fy-28*s, 4*s, 0, Math.PI*2); bg.fill()
  bg.fillStyle = petKleur
  bg.font = 'bold ' + Math.floor(5*s) + 'px sans-serif'
  bg.textAlign = 'center'; bg.textBaseline = 'middle'
  bg.fillText(letter, fx+4*s, fy-27.5*s)
}

function tekenToad(fx, fy, s) {
  // Schaduw
  bg.fillStyle = 'rgba(0,0,0,0.12)'
  bg.beginPath(); bg.ellipse(fx, fy+2, 10*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  // Schoentjes
  bg.fillStyle = '#7a3f10'
  bg.beginPath(); bg.ellipse(fx-4*s, fy, 4*s, 2.5*s, 0, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.ellipse(fx+4*s, fy, 4*s, 2.5*s, 0, 0, Math.PI*2); bg.fill()
  // Lijfje (vest)
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.ellipse(fx, fy-8*s, 7*s, 8*s, 0, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#4444cc'
  bg.fillRect(fx-6*s, fy-12*s, 12*s, 6*s)
  bg.fillStyle = '#eedd44'
  bg.fillRect(fx-6*s, fy-12*s, 12*s, 2*s)
  // Groot paddestoelhoofd
  bg.fillStyle = '#fff8f0'
  bg.beginPath(); bg.arc(fx, fy-18*s, 11*s, 0, Math.PI*2); bg.fill()
  // Rode stippen
  bg.fillStyle = '#ee2222'
  bg.beginPath(); bg.arc(fx-5*s, fy-26*s, 5*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(fx+5*s, fy-26*s, 5*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(fx, fy-30*s, 4.5*s, 0, Math.PI*2); bg.fill()
  // Gezichtje
  bg.fillStyle = '#222'
  bg.beginPath(); bg.arc(fx-3*s, fy-17*s, 1.8*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(fx+3*s, fy-17*s, 1.8*s, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#ff8888'
  bg.beginPath(); bg.arc(fx-6*s, fy-14*s, 2*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(fx+6*s, fy-14*s, 2*s, 0, Math.PI*2); bg.fill()
  bg.strokeStyle = '#884444'
  bg.lineWidth = 1.5
  bg.beginPath(); bg.arc(fx, fy-13*s, 2.5*s, 0.1, Math.PI-0.1); bg.stroke()
}

function tekenYoshi(fx, fy, s) {
  bg.fillStyle = 'rgba(0,0,0,0.12)'
  bg.beginPath(); bg.ellipse(fx, fy+2, 12*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  // Schoenen
  bg.fillStyle = '#ff6622'
  bg.beginPath(); bg.ellipse(fx-5*s, fy, 5*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.ellipse(fx+5*s, fy, 5*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  // Lichaam
  bg.fillStyle = '#33aa33'
  bg.beginPath(); bg.ellipse(fx, fy-10*s, 9*s, 10*s, 0, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.ellipse(fx, fy-8*s, 5*s, 7*s, 0, 0, Math.PI*2); bg.fill()
  // Zadel
  bg.fillStyle = '#ee2222'
  bg.beginPath(); bg.ellipse(fx, fy-18*s, 7*s, 3*s, 0, 0, Math.PI*2); bg.fill()
  // Hoofd + snuit
  bg.fillStyle = '#33aa33'
  bg.beginPath(); bg.arc(fx+4*s, fy-24*s, 7*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.ellipse(fx+12*s, fy-24*s, 6*s, 4*s, 0, 0, Math.PI*2); bg.fill()
  // Grote ogen
  bg.fillStyle = '#fff'
  bg.beginPath(); bg.ellipse(fx+4*s, fy-29*s, 4*s, 5*s, 0, 0, Math.PI*2); bg.fill()
  bg.fillStyle = '#111'
  bg.beginPath(); bg.arc(fx+5*s, fy-28*s, 2*s, 0, Math.PI*2); bg.fill()
  // Neusgaten
  bg.fillStyle = '#228822'
  bg.beginPath(); bg.arc(fx+16*s, fy-25*s, 1.5*s, 0, Math.PI*2); bg.fill()
  bg.beginPath(); bg.arc(fx+16*s, fy-22*s, 1.5*s, 0, Math.PI*2); bg.fill()
}

// Plaats karakters — rennend en springend, alsof ze aan het spelen zijn
tekenMarioRennend(500, 1590, '#e52521', 'M', 3, false)     // Mario rent naar rechts
tekenMarioRennend(650, 1590, '#1ea52a', 'L', 3, false)     // Luigi rent erachter
tekenMarioSpringend(850, 1520, '#e52521', 'M', 2.8)        // Mario springt bij blokken
tekenToad(1550, 1590, 2.8)                                   // Toad
tekenYoshi(1750, 1585, 3)                                    // Yoshi
tekenMarioRennend(2650, 1590, '#e52521', 'M', 2.5, true)   // Mario rent naar links
tekenToad(2850, 1590, 2.5)                                   // Toad rent mee
tekenMarioSpringend(3150, 1500, '#1ea52a', 'L', 3)         // Luigi springt hoog

} // einde skip oude canvas-code

// === MATERIALEN ===
const matGras = new THREE.MeshStandardMaterial({ color: 0x4caf50 })
const matGras2 = new THREE.MeshStandardMaterial({ color: 0x388e3c })
const matWater = new THREE.MeshPhysicalMaterial({ color: 0x2196f3, transparent: true, opacity: 0.7, clearcoat: 0.5 })
const matBrug = new THREE.MeshStandardMaterial({ color: 0x8d6e63 })
const matBrugRail = new THREE.MeshStandardMaterial({ color: 0x6d4c41 })
const matMuur = new THREE.MeshStandardMaterial({ color: 0x666666 })
const matZand = new THREE.MeshStandardMaterial({ color: 0xe8d68c })

// === STATE ===
let scherm = 'start' // start, level, gameover
let levelNummer = 0
let tijd = 0
let actieveKaart = null
let wereldObjecten = []
let waterTiles = []
let spelerX = 0, spelerY = 0
let spelerRichting = 0
let spelerVY = 0, spelerHoogte = 0, opGrond = true
let loopt = false, loopTeller = 0
let inputUit = false
let mario = null
let paddestoelenData = []
let finishPos = null
let portalenData = []
let levens = 3
let score = parseInt(localStorage.getItem('mrj-score') || '0')
let finishFase = null // null, 'spring', 'glijden', 'lopen', 'huisje'
let finishTimer = 0
let finishHuis = null
let finishPaal = null
let sandersData = []
let shawarmaData = []
let muntenData = []        // { mesh, x, y, gepakt }
let vraagBlokken = []      // { mesh, x, y, geopend }
let muntenGepakt = 0
let muntenTotaal = 0
let gezondheid = 3 // 3 hits per leven
let snelleSchoenen = false // tijdelijk (1 level)
let snelleSchoenenAltijd = JSON.parse(localStorage.getItem('mrj-snelle-schoenen') || 'false')
let onkwetsbaarTot = 0 // tijdstip tot wanneer je onkwetsbaar bent
let ontgrendeld = [true, false, false, false, false, false, false, false, false, false, false]

try {
  const saved = JSON.parse(localStorage.getItem('mrj-ontgrendeld'))
  if (saved && saved.length >= 10) {
    ontgrendeld = saved
    while (ontgrendeld.length < 11) ontgrendeld.push(false)
  }
} catch (e) {}

// Achtervolging state
let knopPos = null       // positie van de S-knop
let huisPos = null        // positie van Sander's huisje
let knopGedrukt = false   // is de knop ingedrukt?
let achtervolger = null   // { mesh, x, y, knuppelHoek }
let sanderHuisMesh = null // het huisje 3D object
let knopMesh = null       // de knop 3D object
let autoWalkNaar = null   // level index waar Mario naartoe loopt (null = uit)
let introWalk = null      // { doelX, doelY } voor intro-loopje
let geheimeBrug = false   // of de geheime brug open is
let kenneyPos = null      // positie van het Kenney karakter op startscherm
let luigiPos = null       // positie van Luigi op startscherm
let marioShowPos = null   // positie van het Mario display-poppetje
let bowserActief = false  // bowser sequentie actief
let nijntjeSpeelt = false
let nijntjeInterval = null

function startNijntjeMuziek() {
  if (nijntjeSpeelt) return
  nijntjeSpeelt = true
  stopMuziek()
  try {
    if (!muziekCtx) muziekCtx = new (window.AudioContext || window.webkitAudioContext)()
    // Scheet geluiden (18 seconden) - brown noise + modulatie
    const schetenTijd = 18
    function maakScheet() {
      if (!nijntjeSpeelt) return
      const duur = 0.3 + Math.random() * 1.2
      // Brown noise via oscillator modulatie
      const osc1 = muziekCtx.createOscillator()
      const osc2 = muziekCtx.createOscillator()
      const gain = muziekCtx.createGain()
      const filter = muziekCtx.createBiquadFilter()
      // Basis: laag gerommel
      osc1.type = 'sawtooth'
      osc1.frequency.value = 40 + Math.random() * 30
      osc1.frequency.linearRampToValueAtTime(20 + Math.random() * 40, muziekCtx.currentTime + duur)
      // Modulatie: trillen/prutten
      osc2.type = 'square'
      osc2.frequency.value = 8 + Math.random() * 25
      const modGain = muziekCtx.createGain()
      modGain.gain.value = 20 + Math.random() * 30
      osc2.connect(modGain)
      modGain.connect(osc1.frequency)
      // Filter: dof, realistisch
      filter.type = 'lowpass'
      filter.frequency.value = 100 + Math.random() * 150
      filter.Q.value = 5 + Math.random() * 10
      // Volume: start hard, fade
      gain.gain.setValueAtTime(0.2 + Math.random() * 0.15, muziekCtx.currentTime)
      gain.gain.linearRampToValueAtTime(0.05, muziekCtx.currentTime + duur * 0.7)
      gain.gain.exponentialRampToValueAtTime(0.001, muziekCtx.currentTime + duur)
      osc1.connect(filter); filter.connect(gain); gain.connect(muziekCtx.destination)
      osc1.start(); osc2.start()
      osc1.stop(muziekCtx.currentTime + duur)
      osc2.stop(muziekCtx.currentTime + duur)
      // Pauze tussen scheten
      const pauze = 0.1 + Math.random() * 0.8
      setTimeout(() => maakScheet(), (duur + pauze) * 1000)
    }
    maakScheet()
    setTimeout(() => { if (nijntjeSpeelt) { stopNijntjeMuziek(); if (geluidAan) startMuziek() } }, schetenTijd * 1000)
    return
    const melodie = [
      [100,200],
    ]
    let idx = 0
    function speelNoot() {
      if (!nijntjeSpeelt) { nijntjeInterval = null; return }
      const [freq, duur] = melodie[idx % melodie.length]
      if (freq > 0) {
        const osc = muziekCtx.createOscillator()
        const gain = muziekCtx.createGain()
        osc.type = 'triangle' // zachter, kindvriendelijk geluid
        osc.frequency.value = freq
        gain.gain.value = 0.08
        gain.gain.exponentialRampToValueAtTime(0.001, muziekCtx.currentTime + duur / 1000)
        osc.connect(gain); gain.connect(muziekCtx.destination)
        osc.start(); osc.stop(muziekCtx.currentTime + duur / 1000)
      }
      idx++
      nijntjeInterval = setTimeout(speelNoot, duur)
    }
    speelNoot()
  } catch (e) {}
}

function stopNijntjeMuziek() {
  nijntjeSpeelt = false
  if (nijntjeInterval) { clearTimeout(nijntjeInterval); nijntjeInterval = null }
}
let buisAnimatie = null   // { fase: 'in'|'uit', timer, level, buisMesh }
let autoWalkNaarKanon = false
let autoWalkKanonFase = null // 'lopen', 'in', 'vuur'
let kanonMesh = null
let kanonTimer = 0
let levelStartBuis = null // buis mesh bij level start
let autoWalkPunten = null // waypoints voor de route
let autoWalkStap = 0      // huidige waypoint index

const keys = {}
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return
  keys[e.key] = true; e.preventDefault()
})
window.addEventListener('keyup', (e) => { keys[e.key] = false })

// === TOUCH BESTURING (telefoon/tablet) ===
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
let touchJoystick = null // { startX, startY, currentX, currentY, id }
let touchSpring = false

if (isTouchDevice) {
  // Maak touch UI
  const touchUI = document.createElement('div')
  touchUI.id = 'touch-ui'
  touchUI.style.cssText = 'position:fixed;bottom:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:5'
  touchUI.innerHTML = `
    <div id="joystick-zone" style="position:absolute;bottom:20px;left:20px;width:150px;height:150px;pointer-events:auto;touch-action:none">
      <div id="joystick-base" style="position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);left:15px;top:15px"></div>
      <div id="joystick-knop" style="position:absolute;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.4);left:35px;top:35px;transition:none"></div>
    </div>
    <div id="spring-knop-touch" style="position:absolute;bottom:30px;right:30px;width:80px;height:80px;border-radius:50%;background:rgba(255,100,100,0.3);border:2px solid rgba(255,255,255,0.4);pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;font-size:24px;color:rgba(255,255,255,0.7)">⬆</div>
  `
  document.body.appendChild(touchUI)

  const joystickZone = document.getElementById('joystick-zone')
  const joystickKnop = document.getElementById('joystick-knop')
  const springKnopTouch = document.getElementById('spring-knop-touch')

  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const t = e.changedTouches[0]
    const rect = joystickZone.getBoundingClientRect()
    touchJoystick = {
      startX: rect.left + rect.width / 2,
      startY: rect.top + rect.height / 2,
      currentX: t.clientX,
      currentY: t.clientY,
      id: t.identifier
    }
  })

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault()
    for (const t of e.changedTouches) {
      if (touchJoystick && t.identifier === touchJoystick.id) {
        touchJoystick.currentX = t.clientX
        touchJoystick.currentY = t.clientY
        // Visuele knop verplaatsen
        const dx = t.clientX - touchJoystick.startX
        const dy = t.clientY - touchJoystick.startY
        const afst = Math.sqrt(dx * dx + dy * dy)
        const max = 40
        const bx = afst > max ? dx / afst * max : dx
        const by = afst > max ? dy / afst * max : dy
        joystickKnop.style.left = (35 + bx) + 'px'
        joystickKnop.style.top = (35 + by) + 'px'
      }
    }
  })

  joystickZone.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (touchJoystick && t.identifier === touchJoystick.id) {
        touchJoystick = null
        joystickKnop.style.left = '35px'
        joystickKnop.style.top = '35px'
        keys['ArrowUp'] = false; keys['ArrowDown'] = false
        keys['ArrowLeft'] = false; keys['ArrowRight'] = false
      }
    }
  })

  springKnopTouch.addEventListener('touchstart', (e) => {
    e.preventDefault()
    keys[' '] = true
  })
  springKnopTouch.addEventListener('touchend', (e) => {
    keys[' '] = false
  })

  // Update keys vanuit joystick in de game loop
  function updateTouchKeys() {
    if (!touchJoystick) return
    const dx = touchJoystick.currentX - touchJoystick.startX
    const dy = touchJoystick.currentY - touchJoystick.startY
    const afst = Math.sqrt(dx * dx + dy * dy)
    const drempel = 15
    keys['ArrowUp'] = dy < -drempel
    keys['ArrowDown'] = dy > drempel
    keys['ArrowLeft'] = dx < -drempel
    keys['ArrowRight'] = dx > drempel
  }
  // Hook in de game loop
  const origRAF = window.requestAnimationFrame
  const touchUpdate = () => { updateTouchKeys() }
  setInterval(touchUpdate, 16)
}

const hudNaam = document.getElementById('level-naam')
const hudBericht = document.getElementById('bericht')
const hudLevens = document.getElementById('levens')
const hudScore = document.getElementById('score')

// === HELPERS ===
function blokkert(cel) { return !cel || cel === '#' || cel === '~' }

function tegelVrij(cel, hoogte) {
  if (!cel || cel === '~') return false
  if (cel === '#' || cel === 'B') return hoogte >= 0.15
  return true
}

function isVrij(kaart, px, py, hoogte) {
  const r = 0.25

  function check(x, y) {
    return tegelVrij(kaart[Math.floor(y)]?.[Math.floor(x)], hoogte)
  }

  return check(px, py) && check(px - r, py) && check(px + r, py) && check(px, py - r) && check(px, py + r)
}

function clearWereld() {
  for (const obj of wereldObjecten) scene.remove(obj)
  wereldObjecten = []
  waterTiles = []
  paddestoelenData = []
  portalenData = []
  finishPos = null
  finishFase = null
  finishHuis = null
  finishPaal = null
  sandersData = []
  shawarmaData = []
  muntenData = []
  vraagBlokken = []
  muntenGepakt = 0
  muntenTotaal = 0
  knopPos = null
  huisPos = null
  knopGedrukt = false
  achtervolger = null
  sanderHuisMesh = null
  knopMesh = null
  geheimeBrug = false
  kenneyPos = null
  luigiPos = null
  marioShowPos = null
  bowserActief = false
  stopNijntjeMuziek()
  if (mario) { scene.remove(mario); mario = null }
}

function brugIsHorizontaal(kaart, kolom, rij) {
  const l = kaart[rij]?.[kolom - 1]
  const r = kaart[rij]?.[kolom + 1]
  if (l === '=' || r === '=' || (l && !blokkert(l)) || (r && !blokkert(r))) return true
  return false
}

// === WERELD BOUWEN ===
function bouwKaart(kaart) {
  const grasGeo = new THREE.BoxGeometry(TEGEL, 0.4, TEGEL)
  const waterGeo = new THREE.PlaneGeometry(TEGEL, TEGEL)
  const muurGeo = new THREE.BoxGeometry(TEGEL, 1.5, TEGEL)

  for (let rij = 0; rij < kaart.length; rij++) {
    for (let kolom = 0; kolom < kaart[rij].length; kolom++) {
      const cel = kaart[rij][kolom]
      const x = (kolom + 0.5) * TEGEL
      const z = (rij + 0.5) * TEGEL

      if (cel === '~') {
        const w = new THREE.Mesh(waterGeo, matWater)
        w.rotation.x = -Math.PI / 2
        w.position.set(x, -0.1, z)
        scene.add(w)
        wereldObjecten.push(w)
        waterTiles.push({ mesh: w, kolom, rij })
      } else if (cel === '=') {
        // Water onder brug
        const w = new THREE.Mesh(waterGeo, matWater)
        w.rotation.x = -Math.PI / 2
        w.position.set(x, -0.1, z)
        scene.add(w)
        wereldObjecten.push(w)
        waterTiles.push({ mesh: w, kolom, rij })

        const isH = brugIsHorizontaal(kaart, kolom, rij)
        const dekGeo = isH
          ? new THREE.BoxGeometry(TEGEL, 0.12, TEGEL * 0.75)
          : new THREE.BoxGeometry(TEGEL * 0.75, 0.12, TEGEL)
        const dek = new THREE.Mesh(dekGeo, matBrug)
        dek.position.set(x, 0.1, z)
        dek.receiveShadow = true
        scene.add(dek)
        wereldObjecten.push(dek)

        // Leuningen
        for (const s of [-1, 1]) {
          const balkGeo = new THREE.CylinderGeometry(0.03, 0.03, TEGEL, 6)
          const balk = new THREE.Mesh(balkGeo, matBrugRail)
          if (isH) {
            balk.rotation.z = Math.PI / 2
            balk.position.set(x, 0.35, z + s * TEGEL * 0.4)
          } else {
            balk.rotation.x = Math.PI / 2
            balk.position.set(x + s * TEGEL * 0.4, 0.35, z)
          }
          scene.add(balk)
          wereldObjecten.push(balk)
        }
      } else if (cel === '#') {
        const m = new THREE.Mesh(muurGeo, matMuur)
        m.position.set(x, 0.75, z)
        m.castShadow = true
        scene.add(m)
        wereldObjecten.push(m)
      } else {
        // Grond
        const isRand = [kaart[rij-1]?.[kolom], kaart[rij+1]?.[kolom], kaart[rij]?.[kolom-1], kaart[rij]?.[kolom+1]]
          .some(b => b === '~' || b === '=')
        const mat = isRand ? matZand : ((rij + kolom) % 2 === 0 ? matGras : matGras2)
        const g = new THREE.Mesh(grasGeo, mat)
        g.position.set(x, 0, z)
        g.receiveShadow = true
        scene.add(g)
        wereldObjecten.push(g)
      }
    }
  }
}

// === MARIO (gedetailleerd, Nintendo-stijl) ===
function setupFotoTexture(tex) {
  tex.offset.x = -0.25
  tex.offset.y = -0.2
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
}

function maakFotoHoofdGeo() {
  const geo = new THREE.SphereGeometry(0.25, 20, 16)
  // In Three.js SphereGeometry: U=0→-X, U=0.25→+Z, U=0.5→+X, U=0.75→-Z
  // Mario's gezicht is -Z. Texture centrum is U=0.5.
  // Shift +0.25 zodat texture centrum (0.5) → 0.75 → -Z (voorkant)
  const uvs = geo.attributes.uv
  for (let i = 0; i < uvs.count; i++) {
    let u = uvs.getX(i) + 0.25
    if (u > 1) u -= 1
    uvs.setX(i, u)
  }
  uvs.needsUpdate = true
  return geo
}

function maakMario() {
  const g = new THREE.Group()

  // Kenney karakter: laad 3D model
  if (gekozenKarakter === 'kenney') {
    loader.load(glbPad + 'character-oozi.glb', (gltf) => {
      const model = gltf.scene
      // Meet de grootte en schaal naar Mario-formaat
      const box = new THREE.Box3().setFromObject(model)
      const hoogte = box.max.y - box.min.y
      const schaal = hoogte > 0 ? 1.6 / hoogte : 3
      model.scale.set(schaal, schaal, schaal)
      model.position.y = -box.min.y * schaal
      model.rotation.y = Math.PI // Kenney model kijkt standaard andere kant op
      // Pas texture toe als die geladen is
      if (kenneyTexture) {
        model.traverse(child => {
          if (child.isMesh) {
            child.material = child.material.clone()
            child.material.map = kenneyTexture
            child.material.needsUpdate = true
            child.castShadow = true
            child.receiveShadow = true
          }
        })
      }
      g.add(model)
    })
    g.position.y = 0.2
    scene.add(g)
    return g
  }

  // Kleuren per karakter
  const isMario = gekozenKarakter === 'mario' || gekozenKarakter === 'foto'
  const petKleur = isMario ? 0xe52521 : 0x1ea52a
  const shirtKleur = isMario ? 0xe52521 : 0x1ea52a
  const overallKleur = 0x2b3caa

  const petMat = new THREE.MeshStandardMaterial({ color: petKleur, roughness: 0.5 })
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtKleur, roughness: 0.5 })
  const blauw = new THREE.MeshStandardMaterial({ color: overallKleur, roughness: 0.5 })
  const huid = new THREE.MeshStandardMaterial({ color: 0xfec29a, roughness: 0.7 })
  const heeftSchoenen = schoenenAan && (snelleSchoenen || snelleSchoenenAltijd)
  const schoenMat = new THREE.MeshStandardMaterial({ color: heeftSchoenen ? 0xffffff : 0x7a3f10, roughness: heeftSchoenen ? 0.3 : 0.7 })
  const wit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })

  // Hoofd
  if (gekozenKarakter === 'foto' && fotoTexture) {
    // Hoofd met foto rondom de hele bol, gezicht naar voren (-Z)
    // Game foto is al gespiegeld opgeslagen, dus geen extra UV shift nodig
    setupFotoTexture(fotoTexture)
    const fotoMat = new THREE.MeshBasicMaterial({ map: fotoTexture })
    const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), fotoMat)
    hoofd.position.y = 1.2; hoofd.castShadow = true; g.add(hoofd)
  } else {
    // Normaal hoofd met ogen/neus/snor
    const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), huid)
    hoofd.position.y = 1.2; hoofd.castShadow = true; g.add(hoofd)

    const oogMat = new THREE.MeshStandardMaterial({ color: 0x111111 })
    for (const s of [-0.08, 0.08]) {
      const oogW = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), wit)
      oogW.position.set(s, 1.24, -0.2); g.add(oogW)
      const oog = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), oogMat)
      oog.position.set(s, 1.24, -0.25); g.add(oog)
    }
    const neus = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), huid)
    neus.position.set(0, 1.14, -0.26); g.add(neus)
    const snorMat = new THREE.MeshStandardMaterial({ color: 0x1a0800 })
    for (const s of [-1, 1]) {
      const snor = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), snorMat)
      snor.position.set(s * 0.1, 1.06, -0.22); snor.scale.set(1.2, 0.5, 0.7); g.add(snor)
    }

    // Pet (alleen bij mario/luigi, niet bij eigen foto)
    const pet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), petMat)
    pet.position.y = 1.35; g.add(pet)
    const klep = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.18), petMat)
    klep.position.set(0, 1.33, -0.22); g.add(klep)
  }

  // Lichaam
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.35, 12), shirtMat)
  shirt.position.y = 0.75; shirt.castShadow = true; g.add(shirt)
  const overall = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.35, 12), blauw)
  overall.position.y = 0.42; overall.castShadow = true; g.add(overall)

  // Gele knopen
  const geelMat = new THREE.MeshStandardMaterial({ color: 0xf5d623, metalness: 0.5 })
  for (const s of [-0.14, 0.14]) {
    const knoop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), geelMat)
    knoop.position.set(s, 0.6, -0.2); g.add(knoop)
  }

  // Armen + handschoenen
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 8), shirtMat)
    arm.position.set(s * 0.28, 0.72, 0); arm.rotation.z = s * 0.25; g.add(arm)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), wit)
    hand.position.set(s * 0.33, 0.55, 0); hand.name = s < 0 ? 'linkerHand' : 'rechterHand'; g.add(hand)
  }

  // Benen + schoenen
  for (const s of [-0.1, 0.1]) {
    const been = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 8), blauw)
    been.position.set(s, 0.14, 0); been.name = s < 0 ? 'linkerBeen' : 'rechterBeen'; g.add(been)
    const schoen = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), schoenMat)
    schoen.scale.set(0.7, 0.4, 1.2); schoen.position.set(s, 0.02, -0.04)
    schoen.name = s < 0 ? 'linkerSchoen' : 'rechterSchoen'; g.add(schoen)
  }

  g.position.y = 0.2
  scene.add(g)
  return g
}

// === PADDESTOEL ===
function maakPaddestoel(px, py) {
  const g = new THREE.Group()
  const steel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xf5f0dc }))
  steel.position.y = 0.35; steel.castShadow = true; g.add(steel)
  const hoed = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd32f2f }))
  hoed.position.y = 0.5; hoed.castShadow = true; g.add(hoed)
  const stipGeo = new THREE.SphereGeometry(0.06, 6, 4)
  const wit = new THREE.MeshStandardMaterial({ color: 0xffffff })
  for (const [sx, sy, sz] of [[0.14, 0.65, 0.16], [-0.16, 0.62, 0.12], [0.04, 0.7, -0.18]]) {
    const stip = new THREE.Mesh(stipGeo, wit)
    stip.position.set(sx, sy, sz); g.add(stip)
  }
  g.position.set(px * TEGEL, 0.2, py * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// === MUNT (draaiend gouden muntje) ===
function maakMunt(mx, my) {
  // Fallback tot Kenney model geladen is
  const g = new THREE.Group()
  const fallback = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.2 })
  )
  fallback.rotation.x = Math.PI / 2
  fallback.name = 'fallback'
  g.add(fallback)
  g.position.set(mx * TEGEL, 0.7, my * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  laadModel('coin-gold').then(model => {
    if (model && g.parent) {
      const fb = g.getObjectByName('fallback')
      if (fb) g.remove(fb)
      model.scale.set(1.2, 1.2, 1.2)
      g.add(model)
    }
  })
  return g
}

// === VRAAGTEKEN BLOK (geeft beloning) ===
function maakVraagBlok(vx, vy) {
  const g = new THREE.Group()
  // Fallback
  const fallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xdda020, roughness: 0.4 })
  )
  fallback.name = 'blok'; g.add(fallback)
  // Kenney chest model
  laadModel('chest').then(model => {
    if (model && g.parent) {
      const fb = g.getObjectByName('blok')
      if (fb) g.remove(fb)
      model.scale.set(1.5, 1.5, 1.5)
      model.name = 'blok'
      g.add(model)
    }
  })
  // Licht
  const licht = new THREE.PointLight(0xffd700, 0.3, 3)
  licht.position.y = 0.5; g.add(licht)

  g.position.set(vx * TEGEL, 0.7, vy * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// === MEESTER SANDER (vijand — groene hoodie, bruin haar, shawarma) ===
function maakSander(sx, sy) {
  const g = new THREE.Group()

  const huid = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 })
  const groen = new THREE.MeshStandardMaterial({ color: 0x2d6b3f, roughness: 0.5 })
  const groenDonker = new THREE.MeshStandardMaterial({ color: 0x1f5030, roughness: 0.5 })
  const jeans = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.7 })
  const haar = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 })
  const schoenGroen = new THREE.MeshStandardMaterial({ color: 0x2d6b3f, roughness: 0.6 })
  const wit = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 })

  // Hoofd
  const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), huid)
  hoofd.position.y = 1.35; hoofd.castShadow = true; g.add(hoofd)

  // Haar (kort, bruin, bovenop)
  const haarMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), haar)
  haarMesh.position.y = 1.42; g.add(haarMesh)

  // Ogen (klein, vriendelijk)
  const oogMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a })
  for (const s of [-0.08, 0.08]) {
    const oog = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), oogMat)
    oog.position.set(s, 1.38, -0.18); g.add(oog)
  }

  // Brede glimlach
  const mond = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), wit)
  mond.position.set(0, 1.28, -0.2); g.add(mond)

  // Oren
  for (const s of [-1, 1]) {
    const oor = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), huid)
    oor.position.set(s * 0.22, 1.35, 0); g.add(oor)
  }

  // Groene hoodie (lichaam)
  const hoodie = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.5, 12), groen)
  hoodie.position.y = 0.85; hoodie.castShadow = true; g.add(hoodie)

  // Capuchon (op de rug)
  const capuchon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), groenDonker)
  capuchon.position.set(0, 1.15, 0.12); g.add(capuchon)

  // Koordjes hoodie
  for (const s of [-0.05, 0.05]) {
    const koord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 4), wit)
    koord.position.set(s, 0.95, -0.2); g.add(koord)
  }

  // Armen (groen)
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 8), groen)
    arm.position.set(s * 0.28, 0.78, -0.05)
    arm.rotation.z = s * 0.2
    arm.rotation.x = -0.3 // Armen iets naar voren (shawarma vasthouden)
    g.add(arm)
    // Handen
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), huid)
    hand.position.set(s * 0.3, 0.58, -0.15)
    g.add(hand)
  }

  // Blauwe spijkerbroek
  const broek = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.3, 12), jeans)
  broek.position.y = 0.45; g.add(broek)

  // Benen
  for (const s of [-0.09, 0.09]) {
    const been = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.25, 8), jeans)
    been.position.set(s, 0.18, 0)
    been.name = s < 0 ? 'lBeen' : 'rBeen'
    g.add(been)
    // Groene sneakers
    const schoen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), schoenGroen)
    schoen.scale.set(0.7, 0.4, 1.2)
    schoen.position.set(s, 0.03, -0.03)
    g.add(schoen)
    // Witte zool
    const zool = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.18), wit)
    zool.position.set(s, -0.01, -0.03)
    g.add(zool)
  }

  // Shawarma in de hand (zichtbaar)
  const shawarma = maakShawarmaModel()
  shawarma.position.set(0, 0.6, -0.2)
  shawarma.scale.set(0.7, 0.7, 0.7)
  shawarma.name = 'shawarma'
  g.add(shawarma)

  g.position.set(sx * TEGEL, 0.2, sy * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// Broodje shawarma 3D model
function maakShawarmaModel() {
  const g = new THREE.Group()

  // Pitabroodje (halve cilinder)
  const brood = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xd4a055, roughness: 0.8 })
  )
  brood.rotation.z = Math.PI / 2
  g.add(brood)

  // Vlees (bruin, binnenin)
  const vlees = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.7 })
  )
  vlees.position.y = 0.05
  vlees.scale.set(1, 0.6, 0.8)
  g.add(vlees)

  // Sla (groen, bovenop)
  const sla = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x55aa33, roughness: 0.6 })
  )
  sla.position.set(0.03, 0.1, 0)
  g.add(sla)

  // Tomaat (rood, kleine bol)
  const tomaat = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 })
  )
  tomaat.position.set(-0.05, 0.1, 0.04)
  g.add(tomaat)

  // Saus (wit, druppel)
  const saus = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xf5f0dc, roughness: 0.4 })
  )
  saus.position.set(0, 0.08, -0.05)
  g.add(saus)

  return g
}

// Vliegende shawarma projectiel
function maakVliegendeShawarma() {
  const g = maakShawarmaModel()
  g.scale.set(0.5, 0.5, 0.5)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// === KNUPPEL SANDER (achtervolging — rent achter je aan met knuppel) ===
function maakKnuppelSander(sx, sy) {
  const g = new THREE.Group()

  const huid = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 })
  const groen = new THREE.MeshStandardMaterial({ color: 0x2d6b3f, roughness: 0.5 })
  const groenDonker = new THREE.MeshStandardMaterial({ color: 0x1f5030, roughness: 0.5 })
  const jeans = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.7 })
  const haar = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 })
  const schoenGroen = new THREE.MeshStandardMaterial({ color: 0x2d6b3f, roughness: 0.6 })
  const wit = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 })

  // Hoofd
  const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), huid)
  hoofd.position.y = 1.35; hoofd.castShadow = true; g.add(hoofd)

  // Haar
  const haarMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), haar)
  haarMesh.position.y = 1.42; g.add(haarMesh)

  // Boze ogen (rood!)
  const bozeMat = new THREE.MeshStandardMaterial({ color: 0xff2200 })
  for (const s of [-0.08, 0.08]) {
    const oog = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), bozeMat)
    oog.position.set(s, 1.38, -0.18); g.add(oog)
  }

  // Boze mond
  const mond = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x220000 }))
  mond.position.set(0, 1.26, -0.2); mond.rotation.z = 0.15; g.add(mond)

  // Groene hoodie
  const hoodie = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.5, 12), groen)
  hoodie.position.y = 0.85; hoodie.castShadow = true; g.add(hoodie)

  // Capuchon
  const capuchon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), groenDonker)
  capuchon.position.set(0, 1.15, 0.12); g.add(capuchon)

  // Rechterarm omhoog (knuppel vasthouden)
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 8), groen)
  armR.position.set(0.28, 0.95, -0.1)
  armR.rotation.z = -0.8
  armR.rotation.x = -0.3
  g.add(armR)
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), huid)
  handR.position.set(0.42, 1.1, -0.15); g.add(handR)

  // Linkerarm normaal
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 8), groen)
  armL.position.set(-0.28, 0.78, -0.05)
  armL.rotation.z = 0.2; armL.rotation.x = -0.3; g.add(armL)
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), huid)
  handL.position.set(-0.3, 0.58, -0.15); g.add(handL)

  // KNUPPEL (houten knots)
  const knuppelGroep = new THREE.Group()
  knuppelGroep.name = 'knuppel'
  const houtMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 })
  const stok = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 8), houtMat)
  knuppelGroep.add(stok)
  // Dik uiteinde
  const kop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b3010, roughness: 0.6 }))
  kop.position.y = 0.4; knuppelGroep.add(kop)
  // Spijkers (details)
  const spijkerMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 })
  for (let i = 0; i < 4; i++) {
    const hoek = (i / 4) * Math.PI * 2
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), spijkerMat)
    sp.position.set(Math.cos(hoek) * 0.07, 0.4, Math.sin(hoek) * 0.07)
    knuppelGroep.add(sp)
  }
  knuppelGroep.position.set(0.45, 1.3, -0.15)
  knuppelGroep.rotation.z = -0.5
  g.add(knuppelGroep)

  // Broek
  const broek = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.3, 12), jeans)
  broek.position.y = 0.45; g.add(broek)

  // Benen + schoenen
  for (const s of [-0.09, 0.09]) {
    const been = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.25, 8), jeans)
    been.position.set(s, 0.18, 0)
    been.name = s < 0 ? 'lBeen' : 'rBeen'; g.add(been)
    const schoen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), schoenGroen)
    schoen.scale.set(0.7, 0.4, 1.2); schoen.position.set(s, 0.03, -0.03); g.add(schoen)
  }

  g.position.set(sx * TEGEL, 0.2, sy * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// Sander's huisje (waar hij uitkomt)
function maakSanderHuisje(hx, hy) {
  const g = new THREE.Group()
  const huisMat = new THREE.MeshStandardMaterial({ color: 0x2d6b3f, roughness: 0.85 })
  const muur = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.5), huisMat)
  muur.position.y = 0.9; muur.castShadow = true; g.add(muur)
  // Dak (donkerrood)
  const dak = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4),
    new THREE.MeshStandardMaterial({ color: 0x4a1010, roughness: 0.7 }))
  dak.position.y = 2.0; dak.rotation.y = Math.PI / 4; dak.castShadow = true; g.add(dak)
  // Deur (donker, open)
  const deur = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a0a00 }))
  deur.position.set(0, 0.6, 0.76); g.add(deur)
  // Bord "SANDER" boven de deur
  const bordCanvas = document.createElement('canvas')
  bordCanvas.width = 128; bordCanvas.height = 32
  const bctx = bordCanvas.getContext('2d')
  bctx.fillStyle = '#2d6b3f'
  bctx.fillRect(0, 0, 128, 32)
  bctx.fillStyle = '#fff'
  bctx.font = 'bold 16px monospace'
  bctx.textAlign = 'center'
  bctx.fillText('SANDER', 64, 22)
  const bordTex = new THREE.CanvasTexture(bordCanvas)
  const bord = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2),
    new THREE.MeshBasicMaterial({ map: bordTex }))
  bord.position.set(0, 1.3, 0.77); g.add(bord)

  g.position.set(hx * TEGEL, 0.2, hy * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// Rode knop op de grond
function maakKnop(kx, ky) {
  const g = new THREE.Group()
  // Platform
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 }))
  platform.position.y = 0.25; g.add(platform)
  // Rode knop
  const knop = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16),
    new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3, emissive: 0x440000 }))
  knop.position.y = 0.38; knop.name = 'knopBol'; g.add(knop)
  // S letter bovenop
  const sCanvas = document.createElement('canvas')
  sCanvas.width = 64; sCanvas.height = 64
  const sctx = sCanvas.getContext('2d')
  sctx.fillStyle = '#cc0000'
  sctx.fillRect(0, 0, 64, 64)
  sctx.fillStyle = '#fff'
  sctx.font = 'bold 40px monospace'
  sctx.textAlign = 'center'
  sctx.textBaseline = 'middle'
  sctx.fillText('S', 32, 32)
  const sTex = new THREE.CanvasTexture(sCanvas)
  const sLabel = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16),
    new THREE.MeshBasicMaterial({ map: sTex }))
  sLabel.rotation.x = -Math.PI / 2
  sLabel.position.y = 0.46; g.add(sLabel)
  // Licht
  const licht = new THREE.PointLight(0xff0000, 0.5, 4)
  licht.position.y = 0.5; g.add(licht)

  g.position.set(kx * TEGEL, 0.2, ky * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// === FINISH (vlagpaal + huisje) ===
function maakFinishPaal(fx, fy) {
  const g = new THREE.Group()

  // Fallback paal + vlag
  // Mast (3 meter)
  const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 }))
  paal.position.y = 1.7; paal.castShadow = true; g.add(paal)

  // Gouden bol bovenop
  const bol = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 }))
  bol.position.y = 3.3; g.add(bol)

  // Vlag
  const vlag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x44bb44, side: THREE.DoubleSide }))
  vlag.position.set(0.4, 2.8, 0)
  vlag.name = 'vlag'
  g.add(vlag)

  // Licht
  const licht = new THREE.PointLight(0xffd700, 1, 5)
  licht.position.y = 3.3; g.add(licht)


  const paalLicht = new THREE.PointLight(0xffd700, 1, 5)
  paalLicht.position.set(0, 2, 0); g.add(paalLicht)

  g.position.set(fx * TEGEL, 0.2, fy * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  finishPaal = g

  // Huisje (2 tiles voorbij de paal in Z richting)
  const huis = new THREE.Group()
  const huisMat = new THREE.MeshStandardMaterial({ color: 0xcc6633, roughness: 0.85 })
  const huisMuur = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.5), huisMat)
  huisMuur.position.set(0, 0.8, 0); huisMuur.castShadow = true; huis.add(huisMuur)
  // Dak
  const dak = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.7 }))
  dak.position.y = 1.8; dak.rotation.y = Math.PI / 4; dak.castShadow = true; huis.add(dak)
  // Deur (open, donker)
  const deur = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a0a00 }))
  deur.position.set(0, 0.55, 0.76); huis.add(deur)
  // Ramen
  const raamMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, emissive: 0x335577 })
  const raam1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), raamMat)
  raam1.position.set(0.55, 0.9, 0.76); huis.add(raam1)
  const raam2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), raamMat)
  raam2.position.set(-0.55, 0.9, 0.76); huis.add(raam2)

  huis.position.set(fx * TEGEL, 0.2, (fy - 2) * TEGEL)
  scene.add(huis)
  wereldObjecten.push(huis)
  finishHuis = { x: fx, y: fy - 2, mesh: huis }

  return g
}

// === PORTAAL ===
function maakPortaal(px, py, label, isOpen, levelIdx) {
  const g = new THREE.Group()

  if (isOpen) {
    const licht = new THREE.PointLight(0xffd700, 0.4, 3)
    licht.position.y = 0.7; g.add(licht)
  }

  // Bordje met level-naam en thema
  const bordGroep = new THREE.Group()
  bordGroep.name = 'bordGroep'

  // Bord plank
  const bord = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.06), new THREE.MeshStandardMaterial({ color: 0xdda54a, roughness: 0.8 }))
  bordGroep.add(bord)

  // Rand
  const randMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
  const randBoven = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.08), randMat)
  randBoven.position.set(0, 0.425, 0); bordGroep.add(randBoven)
  const randOnder = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.08), randMat)
  randOnder.position.set(0, -0.425, 0); bordGroep.add(randOnder)

  // Tekst op het bord via canvas texture (hoge resolutie)
  const tekstCanvas = document.createElement('canvas')
  tekstCanvas.width = 512; tekstCanvas.height = 256
  const tctx = tekstCanvas.getContext('2d')
  // Achtergrond
  tctx.fillStyle = '#dda54a'
  tctx.fillRect(0, 0, 512, 256)
  // Donkere rand
  tctx.strokeStyle = '#8B4513'
  tctx.lineWidth = 8
  tctx.strokeRect(4, 4, 504, 248)
  // Level nummer — groot en duidelijk
  tctx.fillStyle = '#ffffff'
  tctx.font = 'bold 80px monospace'
  tctx.textAlign = 'center'
  tctx.textBaseline = 'middle'
  // Schaduw voor leesbaarheid
  tctx.shadowColor = '#442200'
  tctx.shadowBlur = 6
  tctx.shadowOffsetX = 3
  tctx.shadowOffsetY = 3
  tctx.fillText('Level ' + label, 256, 95)
  // Thema naam
  if (levelIdx < levels.length) {
    const themaLabels = ['Strand', 'Bos', 'Regen', 'Zomer', 'Bloemen', "Mario's", 'Dorp', 'Spookjes', 'Boerderij', 'Finale', 'Achtervolging']
    tctx.font = 'bold 52px monospace'
    tctx.fillStyle = '#3a1800'
    tctx.shadowColor = 'rgba(255,255,255,0.3)'
    tctx.shadowBlur = 0
    tctx.shadowOffsetX = 1
    tctx.shadowOffsetY = 1
    tctx.fillText(themaLabels[levelIdx] || '', 256, 185)
  }
  const tekstTexture = new THREE.CanvasTexture(tekstCanvas)
  tekstTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const tekstMat = new THREE.MeshBasicMaterial({ map: tekstTexture })
  const tekstMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), tekstMat)
  // Voorkant
  tekstMesh.position.z = 0.04
  bordGroep.add(tekstMesh)
  // Achterkant
  const tekstMeshAchter = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), tekstMat)
  tekstMeshAchter.position.z = -0.04
  tekstMeshAchter.rotation.y = Math.PI
  bordGroep.add(tekstMeshAchter)

  // Paal
  const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x6b4226 }))
  paal.position.y = -0.9; bordGroep.add(paal)

  bordGroep.position.set(0, 1.8, 0)
  // Bord schuin naar de camera kantelen zodat je het van bovenaf kunt lezen
  bordGroep.rotation.x = -0.5
  g.add(bordGroep)

  // Slotje zit nu op de buis, niet op het bordje

  g.position.set(px * TEGEL, 0.2, py * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// === LEVEL LADEN ===
function parseKaart(kaart) {
  let start = null, finish = null, knop = null, huis = null
  const pads = [], ports = [], sanders = []
  for (let rij = 0; rij < kaart.length; rij++) {
    for (let kolom = 0; kolom < kaart[rij].length; kolom++) {
      const cel = kaart[rij][kolom]
      if (cel === 'S') start = { x: kolom + 0.5, y: rij + 0.5 }
      if (cel === 'F') finish = { x: kolom + 0.5, y: rij + 0.5 }
      if (cel === 'P') pads.push({ x: kolom + 0.5, y: rij + 0.5 })
      if (cel === 'M') sanders.push({ x: kolom + 0.5, y: rij + 0.5 })
      if (cel === 'K') knop = { x: kolom + 0.5, y: rij + 0.5 }
      if (cel === 'H') huis = { x: kolom + 0.5, y: rij + 0.5 }
      if (cel >= '0' && cel <= '9') {
        ports.push({
          x: kolom + 0.5, y: rij + 0.5,
          level: cel === '0' ? 9 : parseInt(cel) - 1,
          label: cel === '0' ? '10' : cel,
        })
      }
      if (cel === 'A') {
        ports.push({ x: kolom + 0.5, y: rij + 0.5, level: 10, label: '11' })
      }
    }
  }
  return { start, finish, paddestoelen: pads, portalen: ports, sanders, knop, huis }
}

// Startscherm kaart
const startKaart = [
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~.....1.....2.....3.....4.....5.....~',
  '~..S................................~',
  '~...................................~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...~',
  '~....A.....0.....9.....8.....7..6...~',
  '~...................................~',
  '~...................................~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]

function laadStart() {
  // Ruim Bowser op
  if (bowserActief) {
    const bf = scene.getObjectByName('bowserFiguur'); if (bf) scene.remove(bf)
    const bvs = scene.getObjectByName('bowserVliegSchip'); if (bvs) scene.remove(bvs)
    if (mario && mario.parent !== scene) { mario.parent.remove(mario); scene.add(mario) }
    bowserActief = false
  }
  clearWereld()
  scherm = 'start'
  inputUit = false
  actieveKaart = [...startKaart]

  bouwKaart(startKaart)
  mario = maakMario()

  const parsed = parseKaart(startKaart)
  spelerX = parsed.start.x
  spelerY = parsed.start.y
  spelerHoogte = 0; spelerVY = 0; opGrond = true
  spelerRichting = -Math.PI / 2 // kijk naar rechts bij start

  portalenData = []
  for (const p of parsed.portalen) {
    const isOpen = ontgrendeld[p.level]
    const mesh = maakPortaal(p.x, p.y, p.label, isOpen, p.level)
    portalenData.push({ mesh, ...p, open: isOpen })
    // Buis naast elk bordje
    const buisKolom = Math.floor(p.x + 1), buisRij = Math.floor(p.y)
    // Markeer als buis-collision (B) — rendert geen blok maar blokkeert wel
    if (actieveKaart[buisRij]) {
      actieveKaart[buisRij] = actieveKaart[buisRij].substring(0, buisKolom) + 'B' + actieveKaart[buisRij].substring(buisKolom + 1)
    }
    laadModel('pipe').then(pijp => {
      if (pijp) {
        pijp.scale.set(2, 2, 2)
        pijp.position.set((p.x + 1) * TEGEL, 0.2, p.y * TEGEL)
        scene.add(pijp)
        wereldObjecten.push(pijp)
      }
    })
    // Slotje op de buis als level locked is
    if (!isOpen) {
      laadModel('lock').then(slot => {
        if (slot) {
          slot.scale.set(2, 2, 2)
          slot.position.set((p.x + 1) * TEGEL, 1.8, p.y * TEGEL)
          scene.add(slot)
          wereldObjecten.push(slot)
        }
      })
    }
  }

  // Als auto-walk actief: input blokkeren (niet voor intro walk dummy)
  if (autoWalkNaar !== null && autoWalkNaar >= 0) {
    inputUit = true
  }

  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)

  // Toon de 3 speelbare karakters naast het bordje van level 1
  const level1 = portalenData.find(p => p.level === 0)
  if (level1) {
    const tmpKar = gekozenKarakter
    const bx = 1.5 // helemaal links in de hoek
    const karakters = ['mario', 'luigi', 'kenney']
    for (let i = 0; i < karakters.length; i++) {
      gekozenKarakter = karakters[i]
      const pop = maakMario()
      pop.position.set((bx + i * 1.2) * TEGEL, 0.2, level1.y * TEGEL)
      pop.rotation.y = Math.PI
      wereldObjecten.push(pop)
      if (karakters[i] === 'mario') {
        marioShowPos = { x: bx + i * 1.2, y: level1.y }
        const mk = Math.floor(marioShowPos.x), mr = Math.floor(marioShowPos.y)
        if (actieveKaart[mr]) {
          actieveKaart[mr] = actieveKaart[mr].substring(0, mk) + 'B' + actieveKaart[mr].substring(mk + 1)
        }
      }
      if (karakters[i] === 'luigi') {
        luigiPos = { x: bx + i * 1.2, y: level1.y }
        const lk = Math.floor(luigiPos.x), lr = Math.floor(luigiPos.y)
        if (actieveKaart[lr]) {
          actieveKaart[lr] = actieveKaart[lr].substring(0, lk) + 'B' + actieveKaart[lr].substring(lk + 1)
        }
      }
      if (karakters[i] === 'kenney') {
        kenneyPos = { x: bx + i * 1.2, y: level1.y }
        // Markeer Kenney als muur zodat je erop kunt springen
        const kk = Math.floor(kenneyPos.x), kr = Math.floor(kenneyPos.y)
        if (actieveKaart[kr]) {
          actieveKaart[kr] = actieveKaart[kr].substring(0, kk) + 'B' + actieveKaart[kr].substring(kk + 1)
        }
      }
    }
    gekozenKarakter = tmpKar
  }

  // Kanon aan het einde van het pad (linksonder)
  const kanonGroep = new THREE.Group()
  const kanonBasis = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 }))
  kanonBasis.position.y = 0.4; kanonGroep.add(kanonBasis)
  const kanonLoop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }))
  kanonLoop.position.set(0, 1.5, 0); kanonLoop.rotation.x = -0.6; kanonGroep.add(kanonLoop)
  const kanonRand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }))
  kanonRand.position.set(0, 2.5, -0.7); kanonRand.rotation.x = Math.PI / 2 - 0.6; kanonGroep.add(kanonRand)
  kanonGroep.position.set(1.5 * TEGEL, 0.2, 9.5 * TEGEL)
  scene.add(kanonGroep)
  wereldObjecten.push(kanonGroep)
  kanonMesh = kanonGroep

  // Mario-sfeer decoraties op het startscherm (Switch-stijl)
  const startDeco = [
    // Pijpen (veel, zoals in Mario)
    // Schatkisten
    { naam: 'chest', x: 5, y: 3, s: 1.3 },
    { naam: 'chest', x: 25, y: 3, s: 1.3 },
    { naam: 'chest', x: 15, y: 9, s: 1.3 },
    { naam: 'chest', x: 32, y: 9, s: 1.3 },
    // Paddenstoelen
    { naam: 'mushrooms', x: 10, y: 3, s: 1.2 },
    { naam: 'mushrooms', x: 22, y: 9, s: 1.2 },
    // Hekken langs het pad
    // Bloemen (laag, als bodembedekking)
    { naam: 'flowers', x: 17, y: 3, s: 0.8 },
    { naam: 'flowers', x: 23, y: 3, s: 0.8 },
    { naam: 'flowers', x: 6, y: 9, s: 0.8 },
    { naam: 'flowers', x: 12, y: 9, s: 0.8 },
    // Stenen
    { naam: 'rocks', x: 34, y: 3, s: 1.0 },
    { naam: 'rocks', x: 2, y: 9, s: 1.0 },
  ]
  for (const d of startDeco) {
    laadModel(d.naam).then(model => {
      if (model) {
        model.scale.set(d.s, d.s, d.s)
        model.position.set((d.x + 0.5) * TEGEL, 0.2, (d.y + 0.5) * TEGEL)
        model.rotation.y = Math.random() * Math.PI * 2
        scene.add(model)
        wereldObjecten.push(model)
      }
    })
  }

  // Intro-walk: 3 vakjes naar rechts bij het opstarten
  if (autoWalkNaar === null && !autoWalkNaarKanon) {
    // Loop een paar vakjes vooruit bij het opstarten
    introWalk = { doelX: spelerX + 4, doelY: spelerY }
  }
  spelerRichting = -Math.PI / 2 // kijk naar rechts

  zetCamera()
  hudNaam.textContent = "Mr. J's Game"
  hudBericht.style.display = 'none'
  // Verberg level-specifieke HUD knoppen op het startscherm (visibility zodat layout niet verspringt)
  for (const id of ['home-knop','pauze-hint','gezondheid','help-knop','inzoom-knop']) {
    const el = document.getElementById(id)
    if (el) el.style.visibility = 'hidden'
  }
  updateHUD()
}

function laadLevel(nummer) {
  // Ruim Bowser op als die actief is
  if (bowserActief) {
    const bf = scene.getObjectByName('bowserFiguur'); if (bf) scene.remove(bf)
    const bvs = scene.getObjectByName('bowserVliegSchip'); if (bvs) scene.remove(bvs)
    // Mario terug in scene als die in een schip zat
    if (mario && mario.parent !== scene) {
      mario.parent.remove(mario)
      scene.add(mario)
    }
    bowserActief = false
  }
  clearWereld()
  scherm = 'level'
  levelNummer = nummer
  inputUit = false

  const level = levels[nummer]
  actieveKaart = [...level.kaart] // kopie zodat we tiles kunnen aanpassen voor decoratie-collision

  // Thema kleuren
  const thema = themas[level.thema]
  if (thema) {
    if (thema.gras) { matGras.color.set(thema.gras[0]); matGras2.color.set(thema.gras[1]) }
    if (thema.water) matWater.color.set(`rgb(${thema.water.join(',')})`)
    if (thema.rand) matZand.color.set(thema.rand)
  } else {
    matGras.color.set(0x4caf50); matGras2.color.set(0x388e3c)
    matWater.color.set(0x2196f3); matZand.color.set(0xe8d68c)
  }

  // Sfeer
  if (level.thema === 'spookjes') {
    scene.fog = new THREE.Fog(0x1a1a2e, 20, 80)
  } else if (level.thema === 'regen') {
    scene.fog = new THREE.Fog(0x5a6a7a, 30, 80)
  } else if (level.thema === 'bos') {
    scene.fog = new THREE.Fog(0x4a6a4a, 25, 80)
  } else if (level.thema === 'achtervolging') {
    scene.fog = new THREE.Fog(0x1a1a1a, 20, 80)
  } else {
    scene.fog = new THREE.Fog(0x87ceeb, 40, 120)
  }
  // Reset camera naar normaal bij level laden
  if (cameraView === 'ingezoomd') {
    cameraView = 'normaal'
    fpKijkY = 0
    if (document.pointerLockElement) document.exitPointerLock()
    const knop = document.getElementById('inzoom-knop')
    if (knop) knop.textContent = '🔍 Inzoomen'
  }

  bouwKaart(level.kaart)

  const parsed = parseKaart(level.kaart)
  spelerX = parsed.start.x
  spelerY = parsed.start.y
  spelerHoogte = 0; spelerVY = 0; opGrond = true

  mario = maakMario()
  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
  gezondheid = 3; onkwetsbaarTot = 0; snelleSchoenen = false

  // Buis bij startpositie (waar je uit komt)
  laadModel('pipe').then(pijp => {
    if (pijp) {
      pijp.scale.set(2, 2, 2)
      pijp.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
      scene.add(pijp)
      wereldObjecten.push(pijp)
    }
  })

  finishPos = parsed.finish

  // Finish
  if (finishPos) maakFinishPaal(finishPos.x, finishPos.y)

  // Meester Sanders — nu met spring- en ren-vermogen
  sandersData = parsed.sanders.map(s => ({
    mesh: maakSander(s.x, s.y), x: s.x, y: s.y, gooimTimer: 0,
    vy: 0, hoogte: 0, opGrond: true,
  }))
  shawarmaData = []

  // Kenney decoratie-modellen per thema
  const themaModellen = {
    strand:       { groot: ['tree', 'tree'], klein: ['flowers', 'plant', 'rocks'] },
    bos:          { groot: ['tree-pine', 'tree-pine-small', 'tree'], klein: ['mushrooms', 'plant', 'flowers-tall'] },
    regen:        { groot: ['tree', 'tree-pine'], klein: ['mushrooms', 'rocks', 'stones'] },
    zomer:        { groot: ['tree', 'tree-pine-small'], klein: ['flowers', 'flowers-tall', 'plant'] },
    bloemen:      { groot: ['tree-pine-small'], klein: ['flowers', 'flowers-tall', 'plant', 'flowers'] },
    mario:        { groot: ['tree-pine-small'], klein: ['mushrooms', 'brick', 'coin-gold'] },
    huis:         { groot: ['tree-pine-small'], klein: ['fence-straight', 'flowers', 'plant'] },
    spookjes:     { groot: ['tree'], klein: ['rocks', 'stones', 'bomb'] },
    boerderij:    { groot: ['tree', 'tree-pine-small'], klein: ['fence-straight', 'barrel', 'crate'] },
    borden:       { groot: ['tree-pine', 'tree'], klein: ['sign', 'flowers', 'plant'] },
    achtervolging:{ groot: ['tree-pine'], klein: ['rocks', 'barrel', 'crate'] },
  }
  const decoConfig = themaModellen[level.thema] || themaModellen.bos
  // Verzamel lege tiles ver van start/finish/sanders
  const decoTiles = []
  for (let rij = 0; rij < level.kaart.length; rij++)
    for (let kolom = 0; kolom < level.kaart[rij].length; kolom++)
      if (level.kaart[rij][kolom] === '.') {
        const dS = Math.abs(rij + 0.5 - parsed.start.y) + Math.abs(kolom + 0.5 - parsed.start.x)
        const dF = parsed.finish ? Math.abs(rij + 0.5 - parsed.finish.y) + Math.abs(kolom + 0.5 - parsed.finish.x) : 99
        if (dS > 3 && dF > 2) decoTiles.push({ x: kolom + 0.5, y: rij + 0.5 })
      }
  for (let i = decoTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [decoTiles[i], decoTiles[j]] = [decoTiles[j], decoTiles[i]]
  }
  // Plaats ~8% grote modellen (blokkeren) en ~10% kleine (decoratie)
  const aantalGroot = Math.min(Math.floor(decoTiles.length * 0.08), 12)
  const aantalKlein = Math.min(Math.floor(decoTiles.length * 0.10), 15)
  for (let i = 0; i < aantalGroot + aantalKlein && i < decoTiles.length; i++) {
    const t = decoTiles[i]
    const isGroot = i < aantalGroot
    const lijst = isGroot ? decoConfig.groot : decoConfig.klein
    const naam = lijst[Math.floor(Math.random() * lijst.length)]
    const schaal = isGroot ? 1.2 + Math.random() * 0.5 : 0.8 + Math.random() * 0.4
    laadModel(naam).then(model => {
      if (model) {
        model.scale.set(schaal, schaal, schaal)
        model.position.set(t.x * TEGEL, 0.2, t.y * TEGEL)
        model.rotation.y = Math.random() * Math.PI * 2
        scene.add(model)
        wereldObjecten.push(model)
      }
    })
    // Grote modellen blokkeren: markeer tile als '#' maar alleen als het pad nog vrij blijft
    if (isGroot) {
      const rij = Math.floor(t.y), kolom = Math.floor(t.x)
      if (actieveKaart[rij]) {
        const backup = actieveKaart[rij]
        actieveKaart[rij] = actieveKaart[rij].substring(0, kolom) + '#' + actieveKaart[rij].substring(kolom + 1)
        // BFS check: kan speler nog bij finish?
        if (parsed.finish) {
          const sr = Math.floor(parsed.start.y), sc = Math.floor(parsed.start.x)
          const fr = Math.floor(parsed.finish.y), fc = Math.floor(parsed.finish.x)
          const vis = new Set(); vis.add(sr+','+sc)
          const q = [[sr,sc]]; let bereikt = false
          while (q.length) {
            const [r,c] = q.shift()
            if (r===fr && c===fc) { bereikt = true; break }
            for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
              const nr=r+dr, nc=c+dc, k=nr+','+nc
              if (!vis.has(k) && actieveKaart[nr]?.[nc] && actieveKaart[nr][nc]!=='~' && actieveKaart[nr][nc]!=='#') {
                vis.add(k); q.push([nr,nc])
              }
            }
          }
          if (!bereikt) actieveKaart[rij] = backup // revert als pad geblokkeerd
        }
      }
    }
  }

  // Muntjes en vraagtekens spawnen op lege tiles
  const legeTiles = []
  for (let rij = 0; rij < level.kaart.length; rij++)
    for (let kolom = 0; kolom < level.kaart[rij].length; kolom++)
      if (level.kaart[rij][kolom] === '.') {
        const dS = Math.abs(rij + 0.5 - parsed.start.y) + Math.abs(kolom + 0.5 - parsed.start.x)
        if (dS > 2) legeTiles.push({ x: kolom + 0.5, y: rij + 0.5 })
      }
  for (let i = legeTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [legeTiles[i], legeTiles[j]] = [legeTiles[j], legeTiles[i]]
  }
  const aantalMunten = Math.min(Math.floor(legeTiles.length * 0.18), 30)
  muntenData = []
  for (let i = 0; i < aantalMunten && i < legeTiles.length; i++) {
    const t = legeTiles[i]
    muntenData.push({ mesh: maakMunt(t.x, t.y), x: t.x, y: t.y, gepakt: false })
  }
  muntenTotaal = muntenData.length
  muntenGepakt = 0
  const aantalVraag = 3 + Math.floor(Math.random() * 3)
  vraagBlokken = []
  for (let i = 0; i < aantalVraag; i++) {
    const idx = aantalMunten + i
    if (idx < legeTiles.length) {
      const t = legeTiles[idx]
      vraagBlokken.push({ mesh: maakVraagBlok(t.x, t.y), x: t.x, y: t.y, geopend: false })
    }
  }

  // Achtervolging: knop en huisje
  if (parsed.knop) {
    knopPos = parsed.knop
    knopMesh = maakKnop(knopPos.x, knopPos.y)
    knopGedrukt = false
  }
  if (parsed.huis) {
    huisPos = parsed.huis
    sanderHuisMesh = maakSanderHuisje(huisPos.x, huisPos.y)
  }

  zetCamera()
  hudNaam.textContent = level.naam
  // Toon level-specifieke HUD knoppen
  for (const id of ['home-knop','pauze-hint','gezondheid','help-knop','inzoom-knop']) {
    const el = document.getElementById(id)
    if (el) el.style.visibility = ''
  }
  updateHUD()

  hudBericht.style.display = 'none'
}

function zetCamera() {
  const cx = spelerX * TEGEL, cz = spelerY * TEGEL
  if (cameraView === 'topdown') {
    camera.position.set(cx, 25, cz)
    camera.rotation.set(-Math.PI / 2, 0, 0)
  } else if (cameraView === 'ingezoomd') {
    const oogH = 0.2 + 1.4
    camera.position.set(cx, oogH, cz)
    camera.lookAt(cx - Math.sin(spelerRichting) * 5, oogH - 0.5, cz - Math.cos(spelerRichting) * 5)
  } else {
    camera.position.set(cx, 12, cz + 14)
    camera.lookAt(cx, 1, cz - 3)
  }
}

function updateHUD() {
  hudLevens.textContent = '❤️'.repeat(levens)
  hudScore.textContent = 'Score: ' + score + (muntenTotaal > 0 ? '  🪙 ' + muntenGepakt + '/' + muntenTotaal : '')
  localStorage.setItem('mrj-score', score)
  const hpEl = document.getElementById('gezondheid')
  if (hpEl) {
    let html = 'HP '
    for (let i = 0; i < 3; i++) {
      const kleur = i < gezondheid ? '#44dd44' : '#442222'
      html += `<div class="hp-blok" style="background:${kleur}"></div>`
    }
    if (snelleSchoenen || snelleSchoenenAltijd) html += ' 👟'
    hpEl.innerHTML = html
  }
  // Shop score updaten
  const shopScore = document.getElementById('shop-score')
  if (shopScore) shopScore.textContent = 'Je hebt ' + score + ' punten'
  // Shop items updaten
  const shop1 = document.getElementById('shop-1level')
  const shopA = document.getElementById('shop-altijd')
  if (shop1) shop1.className = snelleSchoenen ? 'shop-item gekocht' : 'shop-item'
  if (shopA) shopA.className = snelleSchoenenAltijd ? 'shop-item gekocht' : 'shop-item'
}

// Shop koop functies (global zodat HTML onclick werkt)
window.koopSchoenen = function(type) {
  const status = document.getElementById('shop-status')
  if (type === '1level') {
    if (snelleSchoenen) { status.textContent = 'Je hebt al snelle schoenen voor dit level!'; return }
    if (score < 150) { status.textContent = 'Niet genoeg punten! Je hebt ' + score + ', je hebt 150 nodig.'; return }
    score -= 150
    snelleSchoenen = true
    status.textContent = '👟 Snelle schoenen gekocht! Geldig voor 1 level.'
    status.style.color = '#44dd44'
  } else {
    if (snelleSchoenenAltijd) { status.textContent = 'Je hebt al forever schoenen!'; return }
    if (score < 1000) { status.textContent = 'Niet genoeg punten! Je hebt ' + score + ', je hebt 1000 nodig.'; return }
    score -= 1000
    snelleSchoenenAltijd = true
    localStorage.setItem('mrj-snelle-schoenen', 'true')
    status.textContent = '👟✨ Forever schoenen gekocht! Je bent nu altijd snel!'
    status.style.color = '#ffd700'
  }
  updateHUD()
}

window.koopTerugLopen = function() {
  const status = document.getElementById('shop-status')
  if (terugLopenGekocht) { status.textContent = 'Je hebt dit al!'; return }
  if (score < 1000) { status.textContent = 'Niet genoeg punten! Je hebt ' + score + ', je hebt 1000 nodig.'; return }
  score -= 1000
  terugLopenGekocht = true
  kanTerugLopen = true
  localStorage.setItem('mrj-terug-lopen', 'true')
  status.textContent = '🔙 Terug lopen gekocht!'
  status.style.color = '#44dd44'
  updateHUD()
}

let schoenenAan = true // of de schoenen aangetrokken zijn
let kanTerugLopen = false // of je terug mag lopen op het startscherm
let terugLopenGekocht = JSON.parse(localStorage.getItem('mrj-terug-lopen') || 'false')
let gekozenKarakter = 'mario' // altijd Mario bij start
let fotoTexture = null // voor eigen foto gezicht
let menuPauze = false // of het spel gepauzeerd is door een menu
let cameraView = 'normaal' // 'normaal', 'topdown' of 'ingezoomd'

// Menu openen → pauzeert het spel
window.openMenu = function(id) {
  if (id === 'opslag-scherm') window.openOpslag()
  if (id === 'karakter-scherm') updateKarakterScherm()
  if (id === 'instellingen-scherm') updateInstellingenLabels()
  document.getElementById(id).style.display = 'flex'
  if (scherm === 'level') {
    menuPauze = true
  }
}

// Menu sluiten → hervat het spel
window.sluitMenu = function(id) {
  document.getElementById(id).style.display = 'none'
  menuPauze = false
}

// Escape sluit elk open menu/modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modals = ['shop-scherm','karakter-scherm','opslag-scherm','instellingen-scherm','webcam-scherm']
    for (const id of modals) {
      const el = document.getElementById(id)
      if (el && el.style.display !== 'none' && el.style.display !== '') {
        window.sluitMenu(id)
        return
      }
    }
    // Help sluiten
    if (hudBericht.style.display !== 'none') {
      window.sluitHelp()
    }
  }
})

// Home: terug naar startscherm
window.gaNaarHome = function() {
  menuPauze = false
  autoWalkNaar = null
  autoWalkPunten = null
  autoWalkNaarKanon = false
  autoWalkKanonFase = null
  introWalk = null
  document.getElementById('pauze-scherm').style.display = 'none'
  document.getElementById('shop-scherm').style.display = 'none'
  document.getElementById('karakter-scherm').style.display = 'none'
  document.getElementById('opslag-scherm').style.display = 'none'
  scherm = 'start'
  laadStart()
}

// Reset: wis alle opgeslagen data en herstart
window.resetSpel = function() {
  if (!confirm('Weet je het zeker? Alle voortgang wordt gewist!')) return
  localStorage.removeItem('mrj-score')
  localStorage.removeItem('mrj-ontgrendeld')
  localStorage.removeItem('mrj-snelle-schoenen')
  localStorage.removeItem('mrj-karakter')
  localStorage.removeItem('mrj-foto')
  localStorage.removeItem('mrj-geluid')
  localStorage.removeItem('mrj-moeilijkheid')
  score = 0
  levens = 3
  ontgrendeld = [true, false, false, false, false, false, false, false, false, false, false]
  snelleSchoenen = false
  snelleSchoenenAltijd = false
  schoenenAan = true
  gekozenKarakter = 'mario'
  fotoTexture = null
  geluidAan = true
  moeilijkheid = 'normaal'
  menuPauze = false
  document.getElementById('pauze-scherm').style.display = 'none'
  document.getElementById('instellingen-scherm').style.display = 'none'
  laadStart()
}

// Geluid aan/uit
let geluidAan = localStorage.getItem('mrj-geluid') !== 'uit'

window.toggleGeluid = function() {
  geluidAan = !geluidAan
  localStorage.setItem('mrj-geluid', geluidAan ? 'aan' : 'uit')
  document.getElementById('geluid-label').textContent = geluidAan ? '🔊 Geluid: AAN' : '🔇 Geluid: UIT'
  if (geluidAan) startMuziek(); else stopMuziek()
}

// Moeilijkheid
let moeilijkheid = localStorage.getItem('mrj-moeilijkheid') || 'normaal'

window.toggleMoeilijkheid = function() {
  const opties = ['makkelijk', 'normaal', 'moeilijk']
  const idx = (opties.indexOf(moeilijkheid) + 1) % opties.length
  moeilijkheid = opties[idx]
  localStorage.setItem('mrj-moeilijkheid', moeilijkheid)
  const labels = { makkelijk: '😊 Moeilijkheid: Makkelijk', normaal: '⚔️ Moeilijkheid: Normaal', moeilijk: '💀 Moeilijkheid: Moeilijk' }
  document.getElementById('moeilijkheid-label').textContent = labels[moeilijkheid]
}

// Labels bijwerken bij openen
function updateInstellingenLabels() {
  document.getElementById('geluid-label').textContent = geluidAan ? '🔊 Geluid: AAN' : '🔇 Geluid: UIT'
  const labels = { makkelijk: '😊 Moeilijkheid: Makkelijk', normaal: '⚔️ Moeilijkheid: Normaal', moeilijk: '💀 Moeilijkheid: Moeilijk' }
  document.getElementById('moeilijkheid-label').textContent = labels[moeilijkheid]
}

// Code invoer voor level 11
window.checkCode = function() {
  const inp = document.getElementById('code-input')
  if (inp && inp.value === '333') {
    hudBericht.style.display = 'none'
    inputUit = false
    // Eenmalig level 11 openen
    ontgrendeld[10] = true
    laadStart() // herlaad zodat de buis verschijnt
  } else {
    const fout = document.getElementById('code-fout')
    if (fout) fout.textContent = 'Verkeerde code!'
  }
}

window.sluitCode = function() {
  hudBericht.style.display = 'none'
  inputUit = false
}

// Inzoomen toggle
window.toggleInzoom = function() {
  cameraView = cameraView === 'ingezoomd' ? 'normaal' : 'ingezoomd'
  fpKijkY = 0
  if (cameraView !== 'ingezoomd' && document.pointerLockElement) document.exitPointerLock()
  const knop = document.getElementById('inzoom-knop')
  if (knop) knop.textContent = cameraView === 'ingezoomd' ? '🔍 Uitzoomen' : '🔍 Inzoomen'
}

// Help: toon uitleg voor het huidige level
window.toonHelp = function() {
  if (scherm === 'level') menuPauze = true
  const isAchtervolging = scherm === 'level' && levels[levelNummer]?.thema === 'achtervolging'
  hudBericht.style.display = 'block'
  hudBericht.innerHTML = '<div style="background:rgba(0,0,0,0.8);padding:20px;border-radius:12px;font-size:18px;pointer-events:auto">' +
    '<span style="font-size:24px;color:#ffd700">Hoe speel je?</span><br><br>' +
    '⬆️⬇️⬅️➡️ Lopen<br>' +
    '⎵ Spatie = Springen<br><br>' +
    (isAchtervolging
      ? '🔴 Zoek de rode S-knop!<br>⚠️ Sander komt achter je aan met een KNUPPEL!<br>🚩 REN naar de vlag!<br><br>'
      : '🥙 Ontwijkt de shawarma\'s van Sander!<br>🚩 Loop naar de vlag!<br>' +
        '🪙 Pak alle muntjes!<br>❓ Loop tegen vraagtekens voor beloningen!<br><br>') +
    '<span style="font-size:14px;color:#aaa">Sneltoetsen:<br>' +
    'P=Pauze &nbsp; H=Home &nbsp; /=Help<br>' +
    'S=Shop &nbsp; K=Karakter &nbsp; O=Opslag &nbsp; .=Instellingen<br>' +
    'T=Wissel camera &nbsp; I=Inzoomen</span><br>' +
    '<div style="cursor:pointer;color:#ffd700;font-size:16px;margin-top:10px" onclick="window.sluitHelp()">OK, begrepen!</div>' +
    '</div>'
}

window.sluitHelp = function() {
  hudBericht.style.display = 'none'
  menuPauze = false
}

window.openOpslag = function() {
  const items = document.getElementById('opslag-items')
  const leeg = document.getElementById('opslag-leeg')
  const heeftIets = snelleSchoenen || snelleSchoenenAltijd

  if (!heeftIets) {
    items.innerHTML = ''
    leeg.style.display = 'block'
  } else {
    leeg.style.display = 'none'
    const type = snelleSchoenenAltijd ? 'Forever Schoenen' : 'Snelle Schoenen (1 level)'
    items.innerHTML = '<div class="shop-item" onclick="window.toggleSchoenen()" style="pointer-events:auto;cursor:pointer">' +
      '<div>👟 ' + type + '</div>' +
      '<div style="font-size:14px;margin-top:8px;color:' + (schoenenAan ? '#44dd44' : '#ff6644') + '">' +
      (schoenenAan ? '✅ Aangetrokken — klik om uit te trekken' : '❌ Uitgetrokken — klik om aan te trekken') +
      '</div></div>'
  }
  document.getElementById('opslag-scherm').style.display = 'flex'
}

window.toggleSchoenen = function() {
  schoenenAan = !schoenenAan
  window.openOpslag() // Herlaad opslag scherm
  updateHUD()
}

// Karakter kiezen
window.kiesKarakter = function(type) {
  gekozenKarakter = type
  localStorage.setItem('mrj-karakter', type)
  updateKarakterScherm()
  // Herbouw Mario met nieuwe kleuren
  if (mario) { scene.remove(mario) }
  mario = maakMario()
  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
}

function updateKarakterScherm() {
  // Markeer actieve selectie
  for (const id of ['kar-mario', 'kar-luigi', 'kar-kenney', 'kar-foto']) {
    const el = document.getElementById(id)
    if (!el) continue
    const isActief = (id === 'kar-mario' && gekozenKarakter === 'mario') ||
                     (id === 'kar-luigi' && gekozenKarakter === 'luigi') ||
                     (id === 'kar-kenney' && gekozenKarakter === 'kenney') ||
                     (id === 'kar-foto' && gekozenKarakter === 'foto')
    el.style.borderColor = isActief ? '#44dd44' : '#555'
    el.style.background = isActief ? 'rgba(68,221,68,0.15)' : 'rgba(255,255,255,0.1)'
  }
  // Status tekst
  const status = document.getElementById('karakter-status')
  if (gekozenKarakter === 'mario') status.textContent = '✅ Mario gekozen'
  else if (gekozenKarakter === 'luigi') status.textContent = '✅ Luigi gekozen'
  else if (gekozenKarakter === 'kenney') status.textContent = '✅ Kenney gekozen'
  else status.textContent = '✅ Eigen foto gekozen'
  // Toon opgeslagen foto als die er is
  const savedFoto = localStorage.getItem('mrj-foto')
  const fotoPreview = document.getElementById('kar-foto-preview')
  const fotoIcon = document.getElementById('kar-foto-icon')
  if (savedFoto) {
    document.getElementById('kar-foto-img').src = savedFoto
    fotoPreview.style.display = 'block'
    fotoIcon.style.display = 'none'
  } else {
    fotoPreview.style.display = 'none'
    fotoIcon.style.display = 'block'
  }
}

let webcamStream = null
let previewRenderer = null
let previewScene = null
let previewCamera = null
let previewMario = null
let previewAnimId = null
let previewFotoCanvas = null

window.openWebcam = function() {
  document.getElementById('webcam-scherm').style.display = 'flex'
  const video = document.getElementById('webcam-video')
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 240, height: 240 } })
    .then(stream => {
      webcamStream = stream
      video.srcObject = stream
      startPreview3D()
      // Bestaande foto? Toon die direct als "genomen" foto
      const savedFoto = localStorage.getItem('mrj-foto')
      if (savedFoto) {
        const img = new Image()
        img.onload = function() {
          const canvas = document.getElementById('webcam-canvas')
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, 256, 256)
          // Toon in het rondje
          const preview = document.getElementById('foto-preview')
          preview.getContext('2d').drawImage(canvas, 0, 0)
          preview.style.display = 'block'
          fotoBevroren = true
          document.getElementById('webcam-knoppen-live').style.display = 'none'
          document.getElementById('webcam-knoppen-foto').style.display = 'flex'
        }
        img.src = savedFoto
      }
    })
    .catch(() => { document.getElementById('karakter-status').textContent = '❌ Geen webcam gevonden!' })
}

function startPreview3D() {
  const canvas3d = document.getElementById('preview-3d')
  // Eigen losse Three.js renderer, volledig apart van de game
  previewRenderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true })
  previewRenderer.setSize(canvas3d.width, canvas3d.height, false)
  previewRenderer.setPixelRatio(window.devicePixelRatio)
  previewScene = new THREE.Scene()
  previewScene.background = null // Transparant
  previewScene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const licht = new THREE.DirectionalLight(0xffffff, 1.2)
  licht.position.set(1, 3, 4)
  previewScene.add(licht)
  previewCamera = new THREE.PerspectiveCamera(30, 450 / 630, 0.1, 50)
  previewCamera.position.set(0, 0.7, 3.2)
  previewCamera.lookAt(0, 0.65, 0)

  // Maak een foto-canvas voor de live texture
  previewFotoCanvas = document.createElement('canvas')
  previewFotoCanvas.width = 256
  previewFotoCanvas.height = 256

  // Bouw preview Mario met foto-texture
  bouwPreviewMario()

  // Live update loop
  function previewLoop() {
    previewAnimId = requestAnimationFrame(previewLoop)
    const video = document.getElementById('webcam-video')
    if (video.readyState >= 2 && !fotoBevroren) {
      // Live webcam → texture
      const ctx = previewFotoCanvas.getContext('2d')
      ctx.save()
      ctx.translate(256, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, 256, 256)
      ctx.restore()
    }
    if (fotoBevroren) {
      // Toon de genomen foto (uit webcam-canvas)
      const fotoCanvas = document.getElementById('webcam-canvas')
      previewFotoCanvas.getContext('2d').drawImage(fotoCanvas, 0, 0, 256, 256)
    }
    if (previewMario && previewMario.userData.fotoTex) {
      previewMario.userData.fotoTex.needsUpdate = true
    }
    // Poppetje draait langzaam
    if (previewMario) previewMario.rotation.y = Math.sin(Date.now() / 2000) * 0.5
    previewRenderer.render(previewScene, previewCamera)
  }
  previewLoop()
}

function bouwPreviewMario() {
  if (previewMario) previewScene.remove(previewMario)
  const g = new THREE.Group()
  const rood = new THREE.MeshStandardMaterial({ color: 0xe52521, roughness: 0.5 })
  const blauw = new THREE.MeshStandardMaterial({ color: 0x2b3caa, roughness: 0.5 })
  const wit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  const bruin = new THREE.MeshStandardMaterial({ color: 0x7a3f10, roughness: 0.7 })

  // Hoofd met live webcam foto rondom de hele bol
  const fotoTex = new THREE.CanvasTexture(previewFotoCanvas)
  fotoTex.wrapS = THREE.RepeatWrapping
  fotoTex.wrapT = THREE.RepeatWrapping
  const fotoMat = new THREE.MeshBasicMaterial({ map: fotoTex })
  const hoofd = new THREE.Mesh(maakFotoHoofdGeo(), fotoMat)
  hoofd.position.y = 1.2; g.add(hoofd)
  g.userData.fotoTex = fotoTex

  // Geen pet — gezicht moet zichtbaar zijn

  // Lichaam
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.35, 12), rood)
  shirt.position.y = 0.75; g.add(shirt)
  const overall = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.35, 12), blauw)
  overall.position.y = 0.42; g.add(overall)

  // Armen
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 8), rood)
    arm.position.set(s * 0.28, 0.72, 0); arm.rotation.z = s * 0.25; g.add(arm)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), wit)
    hand.position.set(s * 0.33, 0.55, 0); g.add(hand)
  }

  // Benen
  for (const s of [-0.1, 0.1]) {
    const been = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 8), blauw)
    been.position.set(s, 0.14, 0); g.add(been)
    const schoen = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bruin)
    schoen.scale.set(0.7, 0.4, 1.2); schoen.position.set(s, 0.02, -0.04); g.add(schoen)
  }

  previewScene.add(g)
  previewMario = g
}

window.sluitWebcam = function() {
  if (webcamStream) { webcamStream.getTracks().forEach(t => t.stop()); webcamStream = null }
  if (previewAnimId) { cancelAnimationFrame(previewAnimId); previewAnimId = null }
  if (previewRenderer) { previewRenderer.dispose(); previewRenderer = null }
  previewScene = null; previewMario = null
  fotoBevroren = false
  document.getElementById('webcam-scherm').style.display = 'none'
  document.getElementById('foto-preview').style.display = 'none'
  document.getElementById('webcam-knoppen-live').style.display = 'flex'
  document.getElementById('webcam-knoppen-foto').style.display = 'none'
}

let fotoBevroren = false // of de webcam gepauzeerd is na foto nemen

// Stap 1: neem foto (freeze webcam, toon bevestigknoppen)
window.neemFoto = function() {
  const video = document.getElementById('webcam-video')
  const canvas = document.getElementById('webcam-canvas')
  const ctx = canvas.getContext('2d')

  ctx.save()
  ctx.translate(256, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, 256, 256)
  ctx.restore()

  // Toon de genomen foto over de webcam
  const preview = document.getElementById('foto-preview')
  preview.getContext('2d').drawImage(canvas, 0, 0)
  preview.style.display = 'block'

  fotoBevroren = true
  document.getElementById('webcam-knoppen-live').style.display = 'none'
  document.getElementById('webcam-knoppen-foto').style.display = 'flex'
}

// Stap 2: gebruik de genomen foto
window.gebruikFoto = function() {
  const canvas = document.getElementById('webcam-canvas')

  fotoTexture = new THREE.CanvasTexture(canvas)
  setupFotoTexture(fotoTexture)
  localStorage.setItem('mrj-foto', canvas.toDataURL())
  gekozenKarakter = 'foto'
  localStorage.setItem('mrj-karakter', 'foto')

  window.sluitWebcam()
  updateKarakterScherm()

  if (mario) { scene.remove(mario) }
  mario = maakMario()
  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
}

window.opnieuwFoto = function() {
  fotoBevroren = false
  document.getElementById('foto-preview').style.display = 'none'
  document.getElementById('webcam-knoppen-live').style.display = 'flex'
  document.getElementById('webcam-knoppen-foto').style.display = 'none'
}

// Laad opgeslagen foto bij opstarten
try {
  const savedFoto = localStorage.getItem('mrj-foto')
  if (savedFoto && gekozenKarakter === 'foto') {
    const img = new Image()
    img.onload = function() {
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 256
      canvas.getContext('2d').drawImage(img, 0, 0, 256, 256)
      fotoTexture = new THREE.CanvasTexture(canvas)
      setupFotoTexture(fotoTexture)
      // Herbouw Mario met de geladen foto
      if (mario) {
        scene.remove(mario)
        mario = maakMario()
        mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
      }
    }
    img.src = savedFoto
  }
} catch (e) {}

function raakSchade() {
  // Onkwetsbaar na een hit
  if (tijd < onkwetsbaarTot) return
  onkwetsbaarTot = tijd + 1.5 // 1.5 sec onkwetsbaar

  gezondheid--
  updateHUD()

  // Mario knippert (visueel)
  if (mario) {
    mario.visible = false
    setTimeout(() => { if (mario) mario.visible = true }, 100)
    setTimeout(() => { if (mario) mario.visible = false }, 200)
    setTimeout(() => { if (mario) mario.visible = true }, 300)
    setTimeout(() => { if (mario) mario.visible = false }, 400)
    setTimeout(() => { if (mario) mario.visible = true }, 500)
  }

  if (gezondheid <= 0) {
    verliesLeven()
  }
}

function verliesLeven() {
  levens--
  speelDoodGeluid()
  stopMuziek()
  updateHUD()
  if (levens <= 0) {
    scherm = 'gameover'
    hudBericht.style.display = 'block'
    hudBericht.innerHTML = '<span style="color:#ff4444;font-size:48px">GAME OVER!</span><br>Geen levens meer!<br><br><span style="font-size:16px">Druk op SPATIE</span>'
  } else {
    hudBericht.style.display = 'block'
    hudBericht.innerHTML = '<span style="color:#ff8844;font-size:32px">Oeps!</span><br>❤️ ' + levens + ' levens over'
    inputUit = true
    gezondheid = 3
    setTimeout(() => { hudBericht.style.display = 'none'; laadLevel(levelNummer) }, 1500)
  }
}

function startFinishSequentie() {
  inputUit = true
  finishFase = 'spring'
  finishTimer = tijd

  // Hoe hoger je springt tegen de paal, hoe meer levens
  // Max springhoogte is ~0.6 (bij max snelheid 0.14)
  // De paal is 4 eenheden hoog
  const hoogteProcent = Math.min(spelerHoogte / 0.5, 1) // 0-1
  let bonusLevens = hoogteProcent > 0.6 ? 2 : 1
  const bonusPunten = Math.round(hoogteProcent * 5000)

  levens += bonusLevens
  score += bonusPunten + 500

  hudBericht.style.display = 'block'
  hudBericht.innerHTML = `<span style="color:#44ff44;font-size:28px">+${bonusLevens} ${bonusLevens > 1 ? 'levens' : 'leven'}!</span><br><span style="color:#ffd700;font-size:18px">+${bonusPunten + 500} punten</span>`

  // Sla de hoogte op voor de glijanimatie
  finishPaal.userData.grijpHoogte = Math.max(spelerHoogte * 5, 0.5)

  // Ontgrendel volgend level
  if (levelNummer + 1 < levels.length) {
    ontgrendeld[levelNummer + 1] = true
    localStorage.setItem('mrj-ontgrendeld', JSON.stringify(ontgrendeld))
  }
  updateHUD()
}

function updateFinishSequentie() {
  if (!finishFase || !mario || !finishPaal) return
  const dt = tijd - finishTimer
  const paalX = finishPos.x * TEGEL
  const paalZ = finishPos.y * TEGEL

  if (finishFase === 'spring') {
    const grijpH = finishPaal.userData.grijpHoogte || 1.5
    // Mario grijpt de paal op de hoogte waar hij sprong, glijdt dan omlaag
    if (dt < 0.3) {
      // Naar paal toe bewegen
      mario.position.x += (paalX - mario.position.x) * 0.15
      mario.position.z += (paalZ - mario.position.z) * 0.15
      mario.position.y = 0.2 + grijpH
      mario.rotation.y = Math.PI / 2
    } else if (dt < 1.8) {
      // Glijd omlaag
      const glijT = (dt - 0.3) / 1.5
      mario.position.x = paalX + 0.15
      mario.position.z = paalZ
      mario.position.y = 0.2 + grijpH * (1 - glijT)
      mario.rotation.y = Math.PI / 2

      // Vlag glijdt mee
      const vlag = finishPaal.getObjectByName('vlag')
      if (vlag) vlag.position.y = 3.8 - glijT * 2.5
    } else {
      // Aan de andere kant van de paal eraf springen
      finishFase = 'lopen'
      finishTimer = tijd
      mario.position.x = paalX - 0.3
      mario.position.y = 0.2
      hudBericht.style.display = 'none'
    }
  }

  if (finishFase === 'lopen' && finishHuis) {
    // Mario loopt naar het huisje
    const huisX = finishHuis.x * TEGEL
    const huisZ = finishHuis.y * TEGEL
    const loopDt = tijd - finishTimer

    mario.position.x += (huisX - mario.position.x) * 0.05
    mario.position.z += (huisZ - mario.position.z) * 0.05
    mario.position.y = 0.2
    mario.rotation.y = Math.atan2(huisX - mario.position.x, -(huisZ - mario.position.z))

    // Loopanimatie
    const swing = Math.sin(tijd * 8) * 0.12
    for (const [bn, sn, hn, r] of [['linkerBeen','linkerSchoen','linkerHand',1],['rechterBeen','rechterSchoen','rechterHand',-1]]) {
      const b = mario.getObjectByName(bn)
      const s = mario.getObjectByName(sn)
      const h = mario.getObjectByName(hn)
      if (b) b.position.z = swing * r
      if (s) s.position.z = swing * r
      if (h) h.position.z = -swing * r
    }

    // Dicht genoeg bij huisje?
    const afstHuis = Math.sqrt((mario.position.x - huisX) ** 2 + (mario.position.z - huisZ) ** 2)
    if (afstHuis < 0.5 || loopDt > 3) {
      finishFase = 'huisje'
      finishTimer = tijd
      // Mario verdwijnt in het huisje
      mario.visible = false
      hudBericht.style.display = 'block'
      hudBericht.innerHTML = '<span style="color:#44ff44;font-size:32px">Level gehaald! 🎉</span>'
    }
  }

  if (finishFase === 'huisje') {
    // Wacht 2 seconden, dan door naar volgend level
    if (tijd - finishTimer > 2) {
      hudBericht.style.display = 'none'
      if (levelNummer + 1 < levels.length) {
        // Terug naar startscherm, start bij het gehaalde level, loop naar het volgende
        const gehaald = levelNummer
        const volgend = levelNummer + 1
        laadStart()
        // Zet Mario bij het portaal van het gehaalde level
        const gehaaldPortaal = portalenData.find(p => p.level === gehaald)
        if (gehaaldPortaal) {
          spelerX = gehaaldPortaal.x
          spelerY = gehaaldPortaal.y
          mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
        }
        introWalk = null // niet ook nog intro walk doen
        autoWalkNaar = volgend
      } else {
        // Laatste level gehaald → terug naar start, auto-walk naar kanon
        autoWalkNaarKanon = true
        autoWalkKanonFase = 'lopen'
        laadStart()
        introWalk = null
        // Zet Mario bij het portaal van level 11 (na laadStart zodat mario nieuw is)
        const level11 = portalenData.find(p => p.level === 10)
        if (level11) { spelerX = level11.x; spelerY = level11.y }
        if (mario) mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
        inputUit = true
      }
    }
  }
}

// === GAME LOOP ===
laadStart()

let vorigeTijd = performance.now() / 1000
function loop() {
  const nu = performance.now() / 1000
  const dt = Math.min(nu - vorigeTijd, 0.05) // max 50ms per frame (voorkomt glitches)
  vorigeTijd = nu
  tijd += dt

  // Pauze met P toets
  // Sneltoetsen
  if (!inputUit) {
    if (keys['h']) { keys['h'] = false; window.gaNaarHome() }
    if (keys['/']) { keys['/'] = false; window.toonHelp() }
    if (keys['.']) { keys['.'] = false; window.openMenu('instellingen-scherm') }
    if (keys['s']) { keys['s'] = false; window.openMenu('shop-scherm') }
    if (keys['k']) { keys['k'] = false; window.openMenu('karakter-scherm') }
    if (keys['o']) { keys['o'] = false; window.openMenu('opslag-scherm') }
    if (keys['t']) { keys['t'] = false; cameraView = cameraView === 'topdown' ? 'normaal' : 'topdown' }
    if (keys['i']) { keys['i'] = false; cameraView = cameraView === 'ingezoomd' ? 'normaal' : 'ingezoomd' }
  }

  if (scherm === 'level' && keys['p'] && !inputUit) {
    scherm = 'pauze'
    keys['p'] = false
    document.getElementById('pauze-scherm').style.display = 'flex'
  }
  if (scherm === 'pauze') {
    if (keys['p']) {
      scherm = 'level'; keys['p'] = false
      document.getElementById('pauze-scherm').style.display = 'none'
    }
    requestAnimationFrame(loop)
    return
  }

  // Menu open → pauzeer
  // Menu open of window geen focus → pauzeer
  if (menuPauze || !windowFocus) {
    renderer.render(scene, camera)
    requestAnimationFrame(loop)
    return
  }

  if (scherm === 'gameover') {
    if (keys[' ']) { levens = 3; laadStart() }
    renderer.render(scene, camera)
    requestAnimationFrame(loop)
    return
  }

  if (!inputUit && !(window._bowserData && window._bowserData.inSchip)) {
    // Beweging
    const heeftSchoenenNu = scherm === 'level' && schoenenAan && (snelleSchoenen || snelleSchoenenAltijd)
    const schaal = dt * 60 // schaal naar 60fps-equivalent
    const snelheid = (heeftSchoenenNu ? 0.105 : 0.07) * schaal
    let dx = 0, dy = 0
    if (cameraView === 'ingezoomd') {
      // First-person: links/rechts = draaien, omhoog/omlaag = vooruit/achteruit
      if (keys['ArrowLeft']) spelerRichting += 2.5 * dt
      if (keys['ArrowRight']) spelerRichting -= 2.5 * dt
      const vooruit = (keys['ArrowUp'] ? 1 : 0) - (keys['ArrowDown'] ? 1 : 0)
      dx = -Math.sin(spelerRichting) * snelheid * vooruit
      dy = -Math.cos(spelerRichting) * snelheid * vooruit
    } else {
      if (keys['ArrowUp']) dy -= snelheid
      if (keys['ArrowDown']) dy += snelheid
      if (keys['ArrowLeft']) dx -= snelheid
      if (keys['ArrowRight']) dx += snelheid
      // Op startscherm: niet verder dan laatste open buis (tenzij geheime brug open)
      if (scherm === 'start' && portalenData.length > 0 && !geheimeBrug && !bowserActief) {
        let laatsteOpen = -1
        for (const p of portalenData) { if (p.open && p.level > laatsteOpen) laatsteOpen = p.level }
        const laatsteP = portalenData.find(p => p.level === laatsteOpen)
        if (laatsteP) {
          if (spelerY < 5 && spelerX + dx > laatsteP.x + 2) dx = 0
          if (spelerY >= 5 && spelerX + dx < laatsteP.x - 1) dx = 0
        }
        // Niet terug lopen zonder shop-item (alleen op bovenpad)
        if (!kanTerugLopen && !terugLopenGekocht && spelerY < 5) {
          if (dx < 0) dx = 0
        }
      }
    }

    loopt = dx !== 0 || dy !== 0
    if (loopt) loopTeller += 0.08 * schaal; else loopTeller = 0

    // Springen
    if (keys[' '] && opGrond) { spelerVY = 0.09; opGrond = false; speelSpringGeluid() }
    spelerVY -= 0.006 * schaal
    spelerHoogte += spelerVY * schaal
    // Land op de grond of op een muur
    const celOnder = actieveKaart && actieveKaart[Math.floor(spelerY)]?.[Math.floor(spelerX)]
    const opMuur = celOnder === '#' || celOnder === 'B'
    const grondHoogte = opMuur ? 0.3 : 0
    // Van muur afgelopen? Begin met vallen (niet snappen)
    if (opGrond && !opMuur && spelerHoogte > 0) { opGrond = false }
    if (spelerHoogte <= grondHoogte) {
      spelerHoogte = grondHoogte; spelerVY = 0; opGrond = true
      if (springGeluidActief) { springGeluidActief = false; if (!nijntjeSpeelt && geluidAan) startMuziek() }
    }

    // Collision — per as apart, in kleine stappen
    const kaart = actieveKaart
    if (kaart) {
      // X-as
      if (dx !== 0) {
        const stap = Math.sign(dx) * Math.min(Math.abs(dx), 0.05)
        let rest = dx
        while (Math.abs(rest) > 0.001) {
          const s = Math.abs(rest) < Math.abs(stap) ? rest : stap
          if (isVrij(kaart, spelerX + s, spelerY, spelerHoogte)) { spelerX += s; rest -= s }
          else break
        }
      }
      // Y-as
      if (dy !== 0) {
        const stap = Math.sign(dy) * Math.min(Math.abs(dy), 0.05)
        let rest = dy
        while (Math.abs(rest) > 0.001) {
          const s = Math.abs(rest) < Math.abs(stap) ? rest : stap
          if (isVrij(kaart, spelerX, spelerY + s, spelerHoogte)) { spelerY += s; rest -= s }
          else break
        }
      }
    }

    // Richting
    if (cameraView !== 'ingezoomd' && (dx !== 0 || dy !== 0)) spelerRichting = Math.atan2(-dx, -dy)

    // Mario update (niet als hij op het schip zit)
    if (mario && !(window._bowserData && window._bowserData.inSchip)) {
      mario.visible = cameraView !== 'ingezoomd'
      mario.position.set(spelerX * TEGEL, 0.2 + spelerHoogte * 5, spelerY * TEGEL)
      mario.rotation.y = spelerRichting

      const swing = loopt && opGrond ? Math.sin(loopTeller * 5) * 0.1 : 0
      for (const [bn, sn, hn, r] of [['linkerBeen','linkerSchoen','linkerHand',1],['rechterBeen','rechterSchoen','rechterHand',-1]]) {
        const b = mario.getObjectByName(bn)
        const s = mario.getObjectByName(sn)
        const h = mario.getObjectByName(hn)
        if (b) b.position.z = swing * r
        if (s) s.position.z = swing * r
        if (h) h.position.z = -swing * r
      }
    }

    // === START LOGICA ===
    if (scherm === 'start') {
      // Veiligheidscheck: als er geen walk/animatie actief is, zorg dat input werkt
      if (inputUit && !introWalk && !autoWalkNaar && !autoWalkPunten && !bowserActief && !buisAnimatie) {
        inputUit = false
      }
      // Auto-walk naar volgend level via de middelste strook
      if (autoWalkNaar !== null && !autoWalkPunten) {
        const doel = portalenData.find(p => p.level === autoWalkNaar)
        if (doel) {
          // Bouw waypoints: via middenpad, niet recht door bordjes
          const punten = []
          const midBoven = 2.5  // midden van bovenste pad
          const midOnder = 8.5  // midden van onderste pad
          const bochtX = 35.5   // rechter bocht

          const startBoven = spelerY < 5
          const doelBoven = doel.y < 5

          if (startBoven) {
            punten.push({ x: spelerX, y: midBoven })
            if (doelBoven) {
              punten.push({ x: doel.x - 2, y: midBoven }) // stop 2 tiles voor doel
            } else {
              punten.push({ x: bochtX, y: midBoven })
              punten.push({ x: bochtX, y: midOnder })
              punten.push({ x: doel.x + 2, y: midOnder }) // onderpad: doel is links, stop 2 rechts
            }
          } else {
            punten.push({ x: spelerX, y: midOnder })
            if (!doelBoven) {
              punten.push({ x: doel.x + 2, y: midOnder })
            } else {
              punten.push({ x: bochtX, y: midOnder })
              punten.push({ x: bochtX, y: midBoven })
              punten.push({ x: doel.x - 2, y: midBoven })
            }
          }
          autoWalkPunten = punten
          autoWalkStap = 0
        }
      }

      if (autoWalkNaar !== null && autoWalkPunten) {
        const wp = autoWalkPunten[autoWalkStap]
        if (wp) {
          const awdx = wp.x - spelerX, awdy = wp.y - spelerY
          const awAfst = Math.sqrt(awdx * awdx + awdy * awdy)
          if (awAfst < 0.2) {
            // Waypoint bereikt, naar volgende
            autoWalkStap++
            if (autoWalkStap >= autoWalkPunten.length) {
              // Alle waypoints bereikt — stop vlak voor het portaal
              autoWalkNaar = null
              autoWalkPunten = null
              inputUit = false
              loopt = false
            }
          } else {
            const awSnelheid = 0.07 * schaal
            const nx = spelerX + (awdx / awAfst) * awSnelheid
            const ny = spelerY + (awdy / awAfst) * awSnelheid
            // Alleen bewegen als het pad vrij is
            if (isVrij(actieveKaart, nx, ny, 0)) { spelerX = nx; spelerY = ny }
            else { spelerX = nx; spelerY = ny } // forceer toch (waypoints moeten kloppen)
            spelerRichting = Math.atan2(-awdx, -awdy)
            loopt = true
            loopTeller += 0.08 * schaal
          }
        }
      }

      // Geheime brug toggle
      function toggleBrug(open) {
        geheimeBrug = open
        kanTerugLopen = open
        hudBericht.style.display = 'block'
        hudBericht.innerHTML = open
          ? '<span style="color:#ffd700;font-size:24px">Geheime brug geopend! 🌉</span>'
          : '<span style="color:#ff8844;font-size:24px">Geheime brug gesloten! 🚫</span>'
        setTimeout(() => hudBericht.style.display = 'none', 2000)
        for (let r = 3; r <= 6; r++) {
          if (actieveKaart[r]) {
            if (open) {
              actieveKaart[r] = actieveKaart[r].substring(0, 2) + '...' + actieveKaart[r].substring(5)
            } else {
              actieveKaart[r] = actieveKaart[r].substring(0, 2) + '~~~' + actieveKaart[r].substring(5)
            }
          }
        }
        // Verwijder oude brug-meshes
        for (let i = wereldObjecten.length - 1; i >= 0; i--) {
          const obj = wereldObjecten[i]
          if (obj.userData && obj.userData.geheimeBrug) {
            scene.remove(obj); wereldObjecten.splice(i, 1)
          }
        }
        // Bouw brug-meshes als open
        if (open) {
          for (let r = 3; r <= 6; r++) {
            for (let c = 2; c <= 4; c++) {
              const dekGeo = new THREE.BoxGeometry(TEGEL, 0.12, TEGEL * 0.75)
              const dek = new THREE.Mesh(dekGeo, matBrug)
              dek.position.set((c + 0.5) * TEGEL, 0.1, (r + 0.5) * TEGEL)
              dek.receiveShadow = true
              dek.userData.geheimeBrug = true
              scene.add(dek)
              wereldObjecten.push(dek)
            }
          }
        }
      }

      // Spring op Mario-poppetje → Bowser komt!
      if (marioShowPos && spelerHoogte >= 0.05 && !bowserActief) {
        const mxd = spelerX - marioShowPos.x, myd = spelerY - marioShowPos.y
        const mAfst = Math.sqrt(mxd * mxd + myd * myd)
        const lAfst = luigiPos ? Math.sqrt((spelerX - luigiPos.x) ** 2 + (spelerY - luigiPos.y) ** 2) : 999
        if (mAfst < 1.0 && mAfst < lAfst) {
          bowserActief = true
          stopMuziek(); stopNijntjeMuziek()
          spelerHoogte = 0; opGrond = true; spelerX += 2
          window._bowserData = { fase: 'rennen', startTijd: tijd, inSchip: false }

          // Bowser figuur op de grond
          const bowser = new THREE.Group()
          const bLijf = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), new THREE.MeshStandardMaterial({ color: 0x3a8a2a }))
          bLijf.position.y = 1.0; bLijf.scale.set(1, 1.2, 0.9); bowser.add(bLijf)
          const bHoofd = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), new THREE.MeshStandardMaterial({ color: 0x3a8a2a }))
          bHoofd.position.set(0, 2.0, -0.3); bowser.add(bHoofd)
          for (const s of [-0.25, 0.25]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xeecc44 })); h.position.set(s, 2.5, -0.2); bowser.add(h) }
          for (const s of [-0.15, 0.15]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff0000 })); o.position.set(s, 2.1, -0.7); bowser.add(o) }
          bowser.position.set(marioShowPos.x * TEGEL, 0.2, marioShowPos.y * TEGEL)
          bowser.name = 'bowserFiguur'; scene.add(bowser)

          // Jouw schip
          const ms = new THREE.Group()
          ms.add(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x2266cc })))
          const mv = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff }))
          mv.position.set(0, 1.2, 0); ms.add(mv)
          ms.position.set(spelerX * TEGEL + 4, 1.5, spelerY * TEGEL)
          ms.name = 'mijnSchip'; scene.add(ms)
          if (mario) mario.visible = true
          hudBericht.style.display = 'block'
          hudBericht.innerHTML = '<span style="color:#ffcc00;font-size:28px">REN WEG! Of spring op je schip met SPATIE!</span>'
        }
      }

      // Spring op Luigi → circus muziek (mario muziek stopt)
      if (luigiPos) {
        const lxd = spelerX - luigiPos.x, lyd = spelerY - luigiPos.y
        const opLuigi = Math.sqrt(lxd * lxd + lyd * lyd) < 0.8 && spelerHoogte >= 0.15
        if (opLuigi && !nijntjeSpeelt) {
          startNijntjeMuziek()
        } else if (!opLuigi && nijntjeSpeelt) {
          stopNijntjeMuziek()
          if (geluidAan) startMuziek()
        }
      }

      // Spring op Kenney (bovenpad) → open brug, (onderpad) → sluit brug
      if (kenneyPos && spelerHoogte >= 0.15 && tijd - (window._brugCooldown || 0) > 1) {
        const kxd = spelerX - kenneyPos.x, kyd = spelerY - kenneyPos.y
        if (Math.sqrt(kxd * kxd + kyd * kyd) < 0.8) {
          if (!geheimeBrug && spelerY < 5) { toggleBrug(true); window._brugCooldown = tijd }
          else if (geheimeBrug && spelerY >= 5) { toggleBrug(false); window._brugCooldown = tijd }
        }
      }

      // Loop tegen kanon → toggle brug (altijd omschakelen)
      if (kanonMesh && tijd - (window._brugCooldown || 0) > 1) {
        const kanonX = 1.5, kanonY = 9.5
        const kxd = spelerX - kanonX, kyd = spelerY - kanonY
        if (Math.sqrt(kxd * kxd + kyd * kyd) < 1.0) {
          toggleBrug(!geheimeBrug)
          window._brugCooldown = tijd
        }
      }

      // Handmatig portaal betreden (niet tijdens intro walk)
      if (autoWalkNaar === null && !introWalk) {
        for (const p of portalenData) {
          // Check afstand tot bordje OF buis ernaast
          const pdx = spelerX - p.x, pdy = spelerY - p.y
          const bdx = spelerX - (p.x + 1), bdy = spelerY - p.y
          const afstBord = Math.sqrt(pdx * pdx + pdy * pdy)
          const afstBuis = Math.sqrt(bdx * bdx + bdy * bdy)
          if ((afstBord < 1.2 || afstBuis < 1.2) && !opGrond && spelerHoogte > 0.05) {
            if (p.open) {
              // Spring op de buis → start level
              inputUit = true
              buisAnimatie = { fase: 'in', timer: tijd, level: p.level, x: p.x + 1, y: p.y }
              break
            }
            else {
              if (p.level === 10) {
                // Level 11: vraag code
                inputUit = true
                hudBericht.style.display = 'block'
                hudBericht.innerHTML = '<div style="background:rgba(0,0,0,0.8);padding:20px;border-radius:12px;pointer-events:auto">' +
                  '<div style="font-size:20px;color:#ffd700;margin-bottom:10px">🔒 Voer de code in voor Level 11</div>' +
                  '<input id="code-input" type="password" maxlength="4" style="font-size:28px;width:120px;text-align:center;padding:8px;border-radius:8px;border:2px solid #ffd700;background:#222;color:#fff;font-family:monospace" autofocus>' +
                  '<div style="display:flex;gap:10px;margin-top:12px;justify-content:center">' +
                  '<div onclick="window.checkCode()" style="cursor:pointer;background:#44dd44;color:#000;padding:8px 20px;border-radius:8px;font-weight:bold">OK</div>' +
                  '<div onclick="window.sluitCode()" style="cursor:pointer;background:#555;color:#fff;padding:8px 20px;border-radius:8px">Annuleer</div>' +
                  '</div>' +
                  '<div id="code-fout" style="color:#ff4444;margin-top:8px;font-size:14px"></div>' +
                  '</div>'
                setTimeout(() => {
                  const inp = document.getElementById('code-input')
                  if (inp) { inp.focus(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.checkCode() }) }
                }, 100)
              } else {
                hudBericht.style.display = 'block'
                hudBericht.textContent = '🔒 Haal eerst het vorige level!'
                setTimeout(() => hudBericht.style.display = 'none', 1500)
              }
              spelerX -= dx
              spelerY -= dy
            }
            break
          }
        }
      }
    }

    // === LEVEL LOGICA ===
    if (scherm === 'level' && !finishFase) {
      // Meester Sanders — rennen naar Mario, springen, gooien shawarma's
      for (const s of sandersData) {
        const dx = spelerX - s.x
        const dy = spelerY - s.y
        const afst = Math.sqrt(dx * dx + dy * dy)

        // Kijk naar Mario
        s.mesh.rotation.y = Math.atan2(dx, -dy)

        // Rennen naar Mario (snelheid stijgt per level)
        const moeilijkheidFactor = moeilijkheid === 'makkelijk' ? 0.5 : moeilijkheid === 'moeilijk' ? 1.8 : 1
        const sanderSnelheid = (0.03 + levelNummer * 0.005) * schaal * moeilijkheidFactor
        if (afst < 8 && afst > 0.5) {
          const nx = s.x + (dx / afst) * sanderSnelheid
          const ny = s.y + (dy / afst) * sanderSnelheid
          if (isVrij(actieveKaart, nx, ny, 0)) { s.x = nx; s.y = ny }
          else if (isVrij(actieveKaart, nx, s.y, 0)) { s.x = nx }
          else if (isVrij(actieveKaart, s.x, ny, 0)) { s.y = ny }
        }

        // Springen (random, vaker als dichtbij)
        if (s.opGrond && Math.random() < (afst < 3 ? 0.02 : 0.005)) {
          s.vy = 0.1; s.opGrond = false
        }
        s.vy -= 0.006 * schaal
        s.hoogte += s.vy * schaal
        if (s.hoogte <= 0) { s.hoogte = 0; s.vy = 0; s.opGrond = true }

        // Update mesh positie
        s.mesh.position.set(s.x * TEGEL, 0.2 + s.hoogte * 5, s.y * TEGEL)

        // Loopanimatie (sneller als hij rent)
        const lb = s.mesh.getObjectByName('lBeen')
        const rb = s.mesh.getObjectByName('rBeen')
        const loopSnelheid = afst < 8 ? 8 : 2
        if (lb && rb) {
          lb.position.z = Math.sin(tijd * loopSnelheid) * 0.06
          rb.position.z = -Math.sin(tijd * loopSnelheid) * 0.06
        }

        // Gooi shawarma (sneller in hogere levels)
        const gooimInterval = Math.max(2, 5 - levelNummer * 0.3) * (moeilijkheid === 'makkelijk' ? 2 : moeilijkheid === 'moeilijk' ? 0.6 : 1)
        s.gooimTimer += dt
        if (s.gooimTimer > gooimInterval) {
          s.gooimTimer = 0
          speelBoer()
          if (afst < 12 && afst > 0.5) {
            const mesh = maakVliegendeShawarma()
            mesh.position.set(s.x * TEGEL, 1.0, s.y * TEGEL)
            shawarmaData.push({
              mesh,
              x: s.x, y: s.y, z: 1.0,
              dx: (dx / afst) * 0.08,
              dy: (dy / afst) * 0.08,
              leeftijd: 0,
            })
          }
        }

        // Collision met Sander zelf
        if (afst < 0.5 && spelerHoogte < 0.3 && s.hoogte < 0.3) {
          raakSchade(); break
        }
      }

      // Vliegende shawarma's updaten
      for (let i = shawarmaData.length - 1; i >= 0; i--) {
        const sh = shawarmaData[i]
        sh.x += sh.dx
        sh.y += sh.dy
        sh.leeftijd += dt
        sh.mesh.position.set(sh.x * TEGEL, 0.8 + Math.sin(sh.leeftijd * 8) * 0.15, sh.y * TEGEL)
        sh.mesh.rotation.y = sh.leeftijd * 6 // Draait rond

        // Raakt Mario?
        const hdx = spelerX - sh.x, hdy = spelerY - sh.y
        if (Math.sqrt(hdx * hdx + hdy * hdy) < 0.4 && spelerHoogte < 0.5) {
          scene.remove(sh.mesh)
          shawarmaData.splice(i, 1)
          hudBericht.style.display = 'block'
          hudBericht.innerHTML = '<span style="color:#ff8844;font-size:24px">Shawarma! 🥙</span>'
          setTimeout(() => hudBericht.style.display = 'none', 800)
          raakSchade()
          break
        }

        // Tegen muur/water? Verwijderen
        const shCel = actieveKaart?.[Math.floor(sh.y)]?.[Math.floor(sh.x)]
        if (!tegelVrij(shCel, 0) || sh.leeftijd > 4) {
          scene.remove(sh.mesh)
          shawarmaData.splice(i, 1)
        }
      }

      // === MUNTJES OPPAKKEN ===
      for (const m of muntenData) {
        if (m.gepakt) continue
        const mdx = spelerX - m.x, mdy = spelerY - m.y
        if (Math.sqrt(mdx * mdx + mdy * mdy) < 0.5) {
          m.gepakt = true
          scene.remove(m.mesh)
          muntenGepakt++
          score += 10
          updateHUD()
          hudBericht.style.display = 'block'
          hudBericht.innerHTML = '<span style="color:#ffd700;font-size:20px">+10 🪙</span>'
          setTimeout(() => hudBericht.style.display = 'none', 400)
          if (muntenGepakt === muntenTotaal) {
            score += 200
            hudBericht.style.display = 'block'
            hudBericht.innerHTML = '<span style="color:#ffd700;font-size:28px">ALLE MUNTEN! +200 🪙</span>'
            setTimeout(() => hudBericht.style.display = 'none', 1500)
            updateHUD()
          }
        }
      }

      // === VRAAGTEKEN BLOKKEN ===
      for (const v of vraagBlokken) {
        if (v.geopend) continue
        const vdx = spelerX - v.x, vdy = spelerY - v.y
        if (Math.sqrt(vdx * vdx + vdy * vdy) < 0.6) {
          v.geopend = true
          // Blok wordt grijs
          const blok = v.mesh.getObjectByName('blok')
          if (blok) blok.material = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 })
          // Blok springt omhoog
          v.mesh.position.y += 0.3
          setTimeout(() => { if (v.mesh) v.mesh.position.y -= 0.3 }, 200)
          // Random beloning
          const rol = Math.random()
          if (rol < 0.4) {
            // Munten
            const bonus = 50 + Math.floor(Math.random() * 100)
            score += bonus
            hudBericht.style.display = 'block'
            hudBericht.innerHTML = '<span style="color:#ffd700;font-size:24px">+' + bonus + ' punten! 🪙</span>'
          } else if (rol < 0.7) {
            // Gezondheid
            gezondheid = 3
            hudBericht.style.display = 'block'
            hudBericht.innerHTML = '<span style="color:#44dd44;font-size:24px">HP hersteld! 💚</span>'
          } else if (rol < 0.9) {
            // Extra leven
            levens++
            hudBericht.style.display = 'block'
            hudBericht.innerHTML = '<span style="color:#ff44ff;font-size:24px">+1 Leven! ❤️</span>'
          } else {
            // Snelle schoenen (tijdelijk)
            snelleSchoenen = true
            hudBericht.style.display = 'block'
            hudBericht.innerHTML = '<span style="color:#44ddff;font-size:24px">Snelle schoenen! 👟</span>'
          }
          setTimeout(() => hudBericht.style.display = 'none', 1200)
          updateHUD()
        }
      }

      // === ACHTERVOLGING LOGICA ===
      // Knop check: speler bij de knop → druk op spatie
      if (knopPos && !knopGedrukt) {
        const kx = spelerX - knopPos.x, ky = spelerY - knopPos.y
        const kAfst = Math.sqrt(kx * kx + ky * ky)
        if (kAfst < 0.8) {
            knopGedrukt = true
            // Knop indrukken animatie
            if (knopMesh) {
              const bol = knopMesh.getObjectByName('knopBol')
              if (bol) bol.position.y = 0.28
            }
            // Sander komt uit het huisje!
            if (huisPos) {
              achtervolger = {
                mesh: maakKnuppelSander(huisPos.x, huisPos.y),
                x: huisPos.x,
                y: huisPos.y,
                knuppelHoek: 0,
              }
              hudBericht.style.display = 'block'
              hudBericht.innerHTML = '<span style="color:#ff0000;font-size:36px">RENNEN!!!</span><br><span style="font-size:18px">Sander komt achter je aan!</span>'
              setTimeout(() => hudBericht.style.display = 'none', 2000)
            }
            keys[' '] = false
          }
      }

      // Achtervolger: Sander rent achter je aan
      if (achtervolger && knopGedrukt) {
        const adx = spelerX - achtervolger.x
        const ady = spelerY - achtervolger.y
        const aAfst = Math.sqrt(adx * adx + ady * ady)

        if (aAfst > 0.3) {
          const aSnelheid = 0.055 * schaal
          const nx = achtervolger.x + (adx / aAfst) * aSnelheid
          const ny = achtervolger.y + (ady / aAfst) * aSnelheid
          const kaart = actieveKaart
          if (isVrij(kaart, nx, ny, 0)) {
            achtervolger.x = nx; achtervolger.y = ny
          } else if (isVrij(kaart, nx, achtervolger.y, 0)) {
            achtervolger.x = nx
          } else if (isVrij(kaart, achtervolger.x, ny, 0)) {
            achtervolger.y = ny
          }
        }

        // Update mesh positie en richting
        achtervolger.mesh.position.set(achtervolger.x * TEGEL, 0.2, achtervolger.y * TEGEL)
        achtervolger.mesh.rotation.y = Math.atan2(adx, -ady)

        // Loopanimatie
        const lb = achtervolger.mesh.getObjectByName('lBeen')
        const rb = achtervolger.mesh.getObjectByName('rBeen')
        if (lb && rb) {
          lb.position.z = Math.sin(tijd * 10) * 0.08
          rb.position.z = -Math.sin(tijd * 10) * 0.08
        }

        // Knuppel zwaai-animatie
        const knuppel = achtervolger.mesh.getObjectByName('knuppel')
        if (knuppel) {
          if (aAfst < 1.5) {
            // Dichtbij: wild zwaaien!
            achtervolger.knuppelHoek += 0.3
            knuppel.rotation.z = Math.sin(achtervolger.knuppelHoek) * 1.2 - 0.5
          } else {
            knuppel.rotation.z = Math.sin(tijd * 3) * 0.2 - 0.5
          }
        }

        // Collision: Sander raakt Mario
        if (aAfst < 0.5 && spelerHoogte < 0.3) {
          hudBericht.style.display = 'block'
          hudBericht.innerHTML = '<span style="color:#ff4444;font-size:24px">BONK! 🏏</span>'
          setTimeout(() => hudBericht.style.display = 'none', 800)
          raakSchade()
        }
      }

      // Finish — je moet springen en de paal raken (niet gewoon lopen)
      if (finishPos && !finishFase) {
        const fdx = spelerX - finishPos.x, fdy = spelerY - finishPos.y
        if (Math.sqrt(fdx * fdx + fdy * fdy) < 0.8 && !opGrond && spelerHoogte > 0.05) {
          startFinishSequentie()
        }
      }
    }
  }

  // Kanon-animatie na alle levels gehaald
  if (autoWalkNaarKanon && mario && kanonMesh) {
    const kx = 1.5, ky = 9.5 // kanon positie in tile coords
    if (autoWalkKanonFase === 'lopen') {
      // Auto-walk naar het kanon
      const kdx = kx - spelerX, kdy = ky - spelerY
      const kAfst = Math.sqrt(kdx * kdx + kdy * kdy)
      if (kAfst < 0.5) {
        autoWalkKanonFase = 'in'
        kanonTimer = tijd
        mario.visible = false
        hudBericht.style.display = 'block'
        hudBericht.innerHTML = '<span style="color:#ff4400;font-size:42px">3...</span>'
      } else {
        const awSnelheid = 0.05 * dt * 60
        spelerX += (kdx / kAfst) * awSnelheid
        spelerY += (kdy / kAfst) * awSnelheid
        spelerRichting = Math.atan2(-kdx, -kdy)
        mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
        mario.rotation.y = spelerRichting
        loopt = true; loopTeller += 0.08 * dt * 60
      }
    } else if (autoWalkKanonFase === 'in') {
      const kdt = tijd - kanonTimer
      if (kdt < 1) hudBericht.innerHTML = '<span style="color:#ff4400;font-size:42px">3...</span>'
      else if (kdt < 2) hudBericht.innerHTML = '<span style="color:#ff6600;font-size:48px">2...</span>'
      else if (kdt < 3) hudBericht.innerHTML = '<span style="color:#ff8800;font-size:54px">1...</span>'
      else {
        hudBericht.innerHTML = '<span style="color:#ffcc00;font-size:64px">BOEM! 💥</span>'
        autoWalkKanonFase = 'vuur'
        kanonTimer = tijd
        mario.visible = true
        mario.position.set(kx * TEGEL, 3, ky * TEGEL)
      }
    } else if (autoWalkKanonFase === 'vuur') {
      const kdt = tijd - kanonTimer
      mario.position.y = 3 + kdt * 10 - kdt * kdt * 1.8
      mario.position.x += kdt * 4
      mario.position.z -= kdt * 2
      mario.rotation.z = kdt * 5
      mario.rotation.x = kdt * 3
      camera.position.lerp(
        new THREE.Vector3(mario.position.x + 2, mario.position.y + 2, mario.position.z + 5), 0.08)
      camera.lookAt(mario.position)
      if (kdt > 2.5) {
        hudBericht.style.display = 'block'
        hudBericht.innerHTML = '<span style="color:#ffd700;font-size:36px">🎉 GEWONNEN! 🎉</span>'
      }
      if (kdt > 4.5) {
        hudBericht.style.display = 'none'
        mario.rotation.z = 0; mario.rotation.x = 0
        autoWalkNaarKanon = false
        autoWalkKanonFase = null
        inputUit = false
        laadLevel(0) // schiet naar level 1!
      }
    }
  }

  // Buis-animatie (in/uit)
  if (buisAnimatie) {
    const bdt = tijd - buisAnimatie.timer
    if (buisAnimatie.fase === 'in') {
      // Mario loopt naar de buis en zakt erin
      if (mario) {
        const buisWX = buisAnimatie.x * TEGEL
        const buisWZ = buisAnimatie.y * TEGEL
        // Eerst naar de buis lopen
        mario.position.x += (buisWX - mario.position.x) * 0.15
        mario.position.z += (buisWZ - mario.position.z) * 0.15
        if (bdt > 0.3) {
          // Sta precies op de buis
          mario.position.x = buisWX
          mario.position.z = buisWZ
        }
        if (bdt > 0.5) {
          // Langzaam zakken (clip de onderkant met een vlak)
          mario.position.y = 0.2 - (bdt - 0.5) * 2
        }
        if (bdt > 1.3) {
          // Laad het level
          const lvl = buisAnimatie.level
          buisAnimatie = null
          laadLevel(lvl)
          // Start de uit-buis animatie
          buisAnimatie = { fase: 'uit', timer: tijd }
          if (mario) mario.position.y = -3
        }
      }
    } else if (buisAnimatie.fase === 'uit') {
      // Mario komt uit de buis omhoog en blijft erop staan
      if (mario) {
        const buisTop = 0.2 + 1.5 // buis hoogte in 3D
        if (bdt < 1.0) {
          mario.position.y = -2 + bdt * (buisTop + 2)
        } else {
          mario.position.y = buisTop
          spelerHoogte = 0.3 // muur-hoogte in tile coords
          opGrond = true
          buisAnimatie = null
          inputUit = false
        }
      }
    }
  }

  // Bowser update (in de game loop, niet apart)
  if (bowserActief && window._bowserData) {
    const bd = window._bowserData
    const btt = tijd - bd.startTijd
    const ms = scene.getObjectByName('mijnSchip')
    const bf = scene.getObjectByName('bowserFiguur')
    const bvs = scene.getObjectByName('bowserVliegSchip')

    if (!bd.inSchip && ms) {
      // Bowser loopt achter je aan (super sloom)
      if (bf) {
        const bdx = spelerX * TEGEL - bf.position.x, bdz = spelerY * TEGEL - bf.position.z
        const bAfst = Math.sqrt(bdx * bdx + bdz * bdz)
        if (bAfst > 0.5) { bf.position.x += (bdx / bAfst) * 0.01; bf.position.z += (bdz / bAfst) * 0.01; bf.rotation.y = Math.atan2(-bdx, -bdz) }
        // Bowser raakt je op de grond
        if (bAfst < 1.5) { bd.fase = 'dood' }
      }
      // Spring op schip met SPATIE
      const sdx = spelerX * TEGEL - ms.position.x, sdz = spelerY * TEGEL - ms.position.z
      if (Math.sqrt(sdx * sdx + sdz * sdz) < 5 && keys[' ']) {
        bd.inSchip = true; bd.startTijd = tijd; keys[' '] = false
        if (mario) { scene.remove(mario); mario.position.set(0.8, 1, -0.3); mario.rotation.y = 0; ms.add(mario); mario.visible = true }
        hudBericht.innerHTML = '<span style="color:#44ff44;font-size:24px">IN HET SCHIP! Vlieg weg!</span>'
        // Bowser krijgt ook een schip
        const bns = new THREE.Group()
        bns.add(new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 1.8), new THREE.MeshStandardMaterial({ color: 0x4a2a0a })))
        const bv = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.1), new THREE.MeshStandardMaterial({ color: 0xcc2222 }))
        bv.position.set(0, 1.5, 0); bns.add(bv)
        if (bf) { bns.position.copy(bf.position); bns.position.y = 2; scene.remove(bf) }
        bns.name = 'bowserVliegSchip'; scene.add(bns)
      }
    }

    if (bd.inSchip && ms) {
      const s = dt * 60
      // Bestuur schip
      if (keys['ArrowUp']) ms.position.z -= 0.3 * s
      if (keys['ArrowDown']) ms.position.z += 0.3 * s
      if (keys['ArrowLeft']) ms.position.x -= 0.3 * s
      if (keys['ArrowRight']) ms.position.x += 0.3 * s
      if (keys[' ']) ms.position.y += 0.15 * s
      ms.position.y = Math.max(2, ms.position.y - 0.02 * s)
      ms.rotation.z = Math.sin(btt * 2) * 0.08
      // Camera achter en boven het schip
      camera.position.set(ms.position.x, ms.position.y + 8, ms.position.z + 12)
      camera.lookAt(ms.position)
      if (skybox) skybox.position.set(ms.position.x, 10, ms.position.z)
      // Bowser's schip achtervolgt
      const bvs2 = scene.getObjectByName('bowserVliegSchip')
      if (bvs2) {
        const bvdx = ms.position.x - bvs2.position.x, bvdz = ms.position.z - bvs2.position.z
        const bvAfst = Math.sqrt(bvdx * bvdx + bvdz * bvdz)
        if (bvAfst > 1) { bvs2.position.x += (bvdx / bvAfst) * 0.12; bvs2.position.z += (bvdz / bvAfst) * 0.12 }
        bvs2.position.y = ms.position.y + Math.sin(btt * 3) * 0.4
        // Bowser raakt je in de lucht
        if (bvAfst < 2) bd.fase = 'dood'
      }
      // Ontsnapt na 40 sec vliegen
      if (btt > 40) {
        scene.remove(ms)
        const bvsr = scene.getObjectByName('bowserVliegSchip'); if (bvsr) scene.remove(bvsr)
        if (mario) { ms.remove(mario); mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL); mario.rotation.set(0,0,0); mario.visible = true; scene.add(mario) }
        bowserActief = false; window._bowserData = null
        hudBericht.style.display = 'block'
        hudBericht.innerHTML = '<span style="color:#44ff44;font-size:36px">ONTSNAPT! 🎉</span>'
        setTimeout(() => hudBericht.style.display = 'none', 2000)
      }
    }

    if (bd.fase === 'dood') {
      const ms2 = scene.getObjectByName('mijnSchip'); if (ms2) { if (mario && mario.parent === ms2) { ms2.remove(mario); scene.add(mario) }; scene.remove(ms2) }
      const bf2 = scene.getObjectByName('bowserFiguur'); if (bf2) scene.remove(bf2)
      const bvs3 = scene.getObjectByName('bowserVliegSchip'); if (bvs3) scene.remove(bvs3)
      if (mario) { mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL); mario.rotation.set(0,0,0); mario.visible = true }
      hudBericht.style.display = 'block'
      hudBericht.innerHTML = '<div style="font-size:200px">💀</div><div style="font-size:80px;color:#ff0000;font-weight:bold;text-shadow:0 0 30px #ff0000">DOOD</div>'
      speelDoodGeluid()
      bowserActief = false; window._bowserData = null
      setTimeout(() => { hudBericht.style.display = 'none'; levens--; if (levens <= 0) levens = 3; updateHUD(); laadStart() }, 5000)
    }
  }

  // Intro walk (buiten inputUit blok)
  if (introWalk && mario) {
    const iwdx = introWalk.doelX - spelerX
    const iwdy = introWalk.doelY - spelerY
    const iwAfst = Math.sqrt(iwdx * iwdx + iwdy * iwdy)
    if (iwAfst < 0.2) {
      introWalk = null
      inputUit = false
      loopt = false
    } else {
      const iwSnelheid = 0.04 * dt * 60
      spelerX += (iwdx / iwAfst) * iwSnelheid
      spelerY += (iwdy / iwAfst) * iwSnelheid
      spelerRichting = Math.atan2(-iwdx, -iwdy)
      mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
      mario.rotation.y = spelerRichting
      loopt = true; loopTeller += 0.08 * dt * 60
      // Loopanimatie
      const swing = Math.sin(loopTeller * 5) * 0.1
      for (const [bn, sn, hn, r] of [['linkerBeen','linkerSchoen','linkerHand',1],['rechterBeen','rechterSchoen','rechterHand',-1]]) {
        const b = mario.getObjectByName(bn)
        const s = mario.getObjectByName(sn)
        const h = mario.getObjectByName(hn)
        if (b) b.position.z = swing * r
        if (s) s.position.z = swing * r
        if (h) h.position.z = -swing * r
      }
    }
  }

  // Finish animatie (ook als inputUit)
  if (finishFase) {
    updateFinishSequentie()
  }

  // Animaties
  for (const w of waterTiles) {
    w.mesh.position.y = -0.1 + Math.sin(tijd * 2 + w.kolom * 0.5 + w.rij * 0.3) * 0.03
  }

  // Portaal ringen draaien + bordjes naar camera
  for (const p of portalenData) {
    const bordGroep = p.mesh.getObjectByName('bordGroep')
    if (bordGroep) {
      // Bord kijkt naar de camera (vast, niet naar speler)
      bordGroep.rotation.y = 0
    }
  }

  // Muntjes draaien
  for (const m of muntenData) {
    if (!m.gepakt) {
      m.mesh.rotation.y = tijd * 3
      m.mesh.position.y = 0.7 + Math.sin(tijd * 2 + m.x * 3) * 0.08
    }
  }

  // Vraagteken blokken bobben
  for (const v of vraagBlokken) {
    if (!v.geopend) {
      v.mesh.position.y = 0.7 + Math.sin(tijd * 2 + v.x * 5) * 0.05
    }
  }

  // Knop pulseren (als nog niet gedrukt)
  if (knopMesh && !knopGedrukt) {
    const bol = knopMesh.getObjectByName('knopBol')
    if (bol) bol.position.y = 0.38 + Math.sin(tijd * 4) * 0.05
  }

  // Finish vlag wapperen
  if (finishPos) {
    scene.traverse(obj => {
      if (obj.name === 'vlag') obj.rotation.y = Math.sin(tijd * 4) * 0.2
    })
  }

  // Camera (niet als we in het vliegend schip zitten)
  const cx = spelerX * TEGEL, cz = spelerY * TEGEL
  if (window._bowserData && window._bowserData.inSchip) {
    // Camera wordt al gezet in bowser-update
  } else if (cameraView === 'topdown') {
    camera.position.lerp(new THREE.Vector3(cx, 25, cz), 0.05)
    camera.rotation.set(-Math.PI / 2, 0, 0)
  } else if (cameraView === 'ingezoomd') {
    // First-person: door Mario's ogen + muisbesturing
    const oogHoogte = 0.2 + spelerHoogte * 5 + 1.4
    const kijkX = cx - Math.sin(spelerRichting) * 5
    const kijkZ = cz - Math.cos(spelerRichting) * 5
    const kijkY = oogHoogte + fpKijkY * 5
    camera.position.lerp(new THREE.Vector3(cx, oogHoogte, cz), 0.15)
    camera.lookAt(kijkX, kijkY, kijkZ)
  } else {
    camera.position.lerp(new THREE.Vector3(cx, 12, cz + 14), 0.05)
    camera.lookAt(cx, 1, cz - 3)
  }

  // Zon meebewegen
  zon.position.set(cx + 10, 15, cz - 5)
  zon.target.position.set(cx, 0, cz)

  // Skybox meebeweegen met camera (gecentreerd op camerahoogte)
  if (skybox) {
    skybox.position.set(cx, 10, cz)
  }

  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}

loop()
