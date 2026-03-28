import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { levels } from './levels.js'
import { themas } from './themas.js'

// === MODEL LOADER ===
const glbPad = '/src/models/kenney_platformer-kit/Models/GLB format/'
const loader = new GLTFLoader()
const modelCache = {}

function laadModel(naam) {
  if (modelCache[naam]) return Promise.resolve(modelCache[naam].clone())
  return new Promise((resolve) => {
    loader.load(glbPad + naam + '.glb', (gltf) => {
      modelCache[naam] = gltf.scene
      resolve(gltf.scene.clone())
    }, undefined, () => resolve(null))
  })
}

const TEGEL = 2

// Geluiden
const boerAudio = new Audio('/src/geluid/boer.m4a')
const bahSanderAudio = new Audio('/src/geluid/bah-sander.m4a')
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
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.Fog(0x87ceeb, 30, 60)

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
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x1565c0, transparent: true, opacity: 0.6 })
)
zee.rotation.x = -Math.PI / 2
zee.position.y = -0.3
scene.add(zee)

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

const keys = {}
window.addEventListener('keydown', (e) => { keys[e.key] = true; e.preventDefault() })
window.addEventListener('keyup', (e) => { keys[e.key] = false })

const hudNaam = document.getElementById('level-naam')
const hudBericht = document.getElementById('bericht')
const hudLevens = document.getElementById('levens')
const hudScore = document.getElementById('score')

// === HELPERS ===
function blokkert(cel) { return !cel || cel === '#' || cel === '~' }

function isVrij(kaart, px, py) {
  const m = 0.18
  // Check centrum eerst
  const centrum = kaart[Math.floor(py)]?.[Math.floor(px)]
  if (blokkert(centrum)) return false

  // Op een brug? Dan alleen de 2 relevante zijden checken (niet diagonaal)
  if (centrum === '=') return true

  // Check of een buur-tile een brug is — dan ook soepeler
  const buurLinks = kaart[Math.floor(py)]?.[Math.floor(px - m)]
  const buurRechts = kaart[Math.floor(py)]?.[Math.floor(px + m)]
  const buurBoven = kaart[Math.floor(py - m)]?.[Math.floor(px)]
  const buurOnder = kaart[Math.floor(py + m)]?.[Math.floor(px)]

  // Als een directe buur een brug is, check alleen de as-richting (niet diagonaal)
  if (buurLinks === '=' || buurRechts === '=' || buurBoven === '=' || buurOnder === '=') {
    return !blokkert(buurLinks) && !blokkert(buurRechts) && !blokkert(buurBoven) && !blokkert(buurOnder)
  }

  // Normaal: check 4 hoeken
  return (
    !blokkert(kaart[Math.floor(py - m)]?.[Math.floor(px - m)]) &&
    !blokkert(kaart[Math.floor(py - m)]?.[Math.floor(px + m)]) &&
    !blokkert(kaart[Math.floor(py + m)]?.[Math.floor(px - m)]) &&
    !blokkert(kaart[Math.floor(py + m)]?.[Math.floor(px + m)])
  )
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
      const x = kolom * TEGEL
      const z = rij * TEGEL

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
function maakMario() {
  const g = new THREE.Group()

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
    // Foto op de voorkant van het hoofd (bol-texture)
    const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), huid)
    hoofd.position.y = 1.2; hoofd.castShadow = true; g.add(hoofd)
    const gezichtGeo = new THREE.SphereGeometry(0.251, 20, 16, Math.PI * 1.25, Math.PI * 0.5, Math.PI * 0.2, Math.PI * 0.6)
    const fotoMat = new THREE.MeshBasicMaterial({ map: fotoTexture })
    const gezicht = new THREE.Mesh(gezichtGeo, fotoMat)
    gezicht.position.y = 1.2
    g.add(gezicht)
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
  }

  // Pet
  const pet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), petMat)
  pet.position.y = 1.35; g.add(pet)
  const klep = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.18), petMat)
  klep.position.set(0, 1.33, -0.22); g.add(klep)

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
  const g = new THREE.Group()
  const goud = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.2 })
  const munt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), goud)
  munt.rotation.x = Math.PI / 2
  munt.castShadow = true
  g.add(munt)
  // Rand
  const rand = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 16), goud)
  rand.rotation.x = Math.PI / 2
  g.add(rand)
  g.position.set(mx * TEGEL, 0.7, my * TEGEL)
  scene.add(g)
  wereldObjecten.push(g)
  return g
}

// === VRAAGTEKEN BLOK (geeft beloning) ===
function maakVraagBlok(vx, vy) {
  const g = new THREE.Group()
  // Gouden blok
  const blokMat = new THREE.MeshStandardMaterial({ color: 0xdda020, roughness: 0.4 })
  const blok = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), blokMat)
  blok.castShadow = true
  blok.name = 'blok'
  g.add(blok)
  // Rand
  const randMat = new THREE.MeshStandardMaterial({ color: 0xaa7010, roughness: 0.5 })
  const randGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  const randMesh = new THREE.Mesh(new THREE.EdgesGeometry(randGeo),
    new THREE.LineBasicMaterial({ color: 0xaa7010, linewidth: 2 }))
  g.add(randMesh)
  // Vraagteken tekst op 4 zijden
  const qCanvas = document.createElement('canvas')
  qCanvas.width = 64; qCanvas.height = 64
  const qctx = qCanvas.getContext('2d')
  qctx.fillStyle = '#dda020'
  qctx.fillRect(0, 0, 64, 64)
  qctx.fillStyle = '#fff'
  qctx.font = 'bold 48px monospace'
  qctx.textAlign = 'center'
  qctx.textBaseline = 'middle'
  qctx.fillText('?', 32, 32)
  const qTex = new THREE.CanvasTexture(qCanvas)
  for (const [px,py,pz,ry] of [[0,0,0.41,0],[0,0,-0.41,Math.PI],[0.41,0,0,Math.PI/2],[-0.41,0,0,-Math.PI/2]]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: qTex, transparent: true }))
    face.position.set(px, py, pz)
    face.rotation.y = ry
    g.add(face)
  }
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
  const goud = new THREE.MeshStandardMaterial({ color: isOpen ? 0xffd700 : 0x666666, metalness: 0.6 })

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 12, 24), goud)
  ring.position.y = 0.7; ring.rotation.x = Math.PI / 2
  ring.name = 'ring'; g.add(ring)

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

  if (!isOpen) {
    // Fallback slot
    const slotGroep = new THREE.Group()
    slotGroep.name = 'slotFallback'
    const slotBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 }))
    slotGroep.add(slotBody)
    slotGroep.position.y = 0.3
    g.add(slotGroep)

    // Laad Kenney lock op achtergrond
    laadModel('lock').then((lockModel) => {
      if (lockModel && g.parent) {
        const fb = g.getObjectByName('slotFallback')
        if (fb) g.remove(fb)
        lockModel.scale.set(1.5, 1.5, 1.5)
        lockModel.position.y = 0.3
        g.add(lockModel)
      }
    })
  }

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
  '##############################',
  '#............................#',
  '#.S.1..2..3..4..5............#',
  '#............................#',
  '#...6..7..8..9..0..A.........#',
  '#............................#',
  '#............................#',
  '#............................#',
  '##############################',
]

function laadStart() {
  clearWereld()
  scherm = 'start'
  inputUit = false
  actieveKaart = startKaart

  bouwKaart(startKaart)
  mario = maakMario()

  const parsed = parseKaart(startKaart)
  spelerX = parsed.start.x
  spelerY = parsed.start.y
  spelerHoogte = 0; spelerVY = 0; opGrond = true

  portalenData = []
  for (const p of parsed.portalen) {
    const isOpen = ontgrendeld[p.level]
    const mesh = maakPortaal(p.x, p.y, p.label, isOpen, p.level)
    portalenData.push({ mesh, ...p, open: isOpen })
  }

  zetCamera()
  hudNaam.textContent = "Mr. J's Game"
  hudBericht.style.display = 'none'
  // Verberg level-specifieke HUD knoppen op het startscherm (visibility zodat layout niet verspringt)
  for (const id of ['home-knop','pauze-hint','gezondheid','help-knop']) {
    const el = document.getElementById(id)
    if (el) el.style.visibility = 'hidden'
  }
  updateHUD()
}

function laadLevel(nummer) {
  clearWereld()
  scherm = 'level'
  levelNummer = nummer
  inputUit = false

  const level = levels[nummer]
  actieveKaart = level.kaart

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
    scene.background.set(0x1a1a2e); scene.fog = new THREE.Fog(0x1a1a2e, 10, 30)
  } else if (level.thema === 'regen') {
    scene.background.set(0x5a6a7a); scene.fog = new THREE.Fog(0x5a6a7a, 20, 45)
  } else if (level.thema === 'bos') {
    scene.background.set(0x4a6a4a); scene.fog = new THREE.Fog(0x4a6a4a, 15, 40)
  } else if (level.thema === 'achtervolging') {
    scene.background.set(0x1a1a1a); scene.fog = new THREE.Fog(0x1a1a1a, 15, 40)
  } else {
    scene.background.set(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 30, 60)
  }

  bouwKaart(level.kaart)

  const parsed = parseKaart(level.kaart)
  spelerX = parsed.start.x
  spelerY = parsed.start.y
  spelerHoogte = 0; spelerVY = 0; opGrond = true

  mario = maakMario()
  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
  gezondheid = 3; onkwetsbaarTot = 0; snelleSchoenen = false
  finishPos = parsed.finish

  // Finish
  if (finishPos) maakFinishPaal(finishPos.x, finishPos.y)

  // Meester Sanders — nu met spring- en ren-vermogen
  sandersData = parsed.sanders.map(s => ({
    mesh: maakSander(s.x, s.y), x: s.x, y: s.y, gooimTimer: 0,
    vy: 0, hoogte: 0, opGrond: true,
  }))
  shawarmaData = []

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
  for (const id of ['home-knop','pauze-hint','gezondheid','help-knop']) {
    const el = document.getElementById(id)
    if (el) el.style.visibility = ''
  }
  updateHUD()

  hudBericht.style.display = 'none'
}

function zetCamera() {
  camera.position.set(spelerX * TEGEL, 10, spelerY * TEGEL + 12)
  camera.lookAt(spelerX * TEGEL, 0, spelerY * TEGEL)
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

let schoenenAan = true // of de schoenen aangetrokken zijn
let gekozenKarakter = localStorage.getItem('mrj-karakter') || 'mario' // mario, luigi, foto
let fotoTexture = null // voor eigen foto gezicht
let menuPauze = false // of het spel gepauzeerd is door een menu

// Menu openen → pauzeert het spel
window.openMenu = function(id) {
  if (id === 'opslag-scherm') window.openOpslag()
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
    'S=Shop &nbsp; K=Karakter &nbsp; O=Opslag &nbsp; .=Instellingen</span><br>' +
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
  document.getElementById('karakter-status').textContent =
    type === 'mario' ? '✅ Mario gekozen!' : type === 'luigi' ? '✅ Luigi gekozen!' : '✅ Eigen foto gekozen! Open 📸 om een foto te nemen.'
  // Herbouw Mario met nieuwe kleuren
  if (mario) { scene.remove(mario) }
  mario = maakMario()
  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
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
  previewCamera = new THREE.PerspectiveCamera(30, 60 / 80, 0.1, 50)
  previewCamera.position.set(0, 1.1, 2.0) // Recht van voren
  previewCamera.lookAt(0, 0.85, 0)

  // Maak een foto-canvas voor de live texture
  previewFotoCanvas = document.createElement('canvas')
  previewFotoCanvas.width = 128
  previewFotoCanvas.height = 128

  // Bouw preview Mario met foto-texture
  bouwPreviewMario()

  // Live update loop
  function previewLoop() {
    previewAnimId = requestAnimationFrame(previewLoop)
    // Update foto texture van webcam
    const video = document.getElementById('webcam-video')
    if (video.readyState >= 2) {
      const ctx = previewFotoCanvas.getContext('2d')
      ctx.save()
      ctx.translate(128, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, 128, 128)
      ctx.restore()
      // Circulair maken
      ctx.globalCompositeOperation = 'destination-in'
      ctx.beginPath()
      ctx.arc(64, 64, 64, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      // Update texture
      if (previewMario && previewMario.userData.fotoTex) {
        previewMario.userData.fotoTex.needsUpdate = true
      }
    }
    // Poppetje staat stil, recht naar camera
    if (previewMario) previewMario.rotation.y = 0
    previewRenderer.render(previewScene, previewCamera)
  }
  previewLoop()
}

function bouwPreviewMario() {
  if (previewMario) previewScene.remove(previewMario)
  const g = new THREE.Group()
  const rood = new THREE.MeshStandardMaterial({ color: 0xe52521, roughness: 0.5 })
  const blauw = new THREE.MeshStandardMaterial({ color: 0x2b3caa, roughness: 0.5 })
  const huid = new THREE.MeshStandardMaterial({ color: 0xfec29a, roughness: 0.7 })
  const wit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  const bruin = new THREE.MeshStandardMaterial({ color: 0x7a3f10, roughness: 0.7 })

  // Hoofd met foto op de voorkant van de bol
  const fotoTex = new THREE.CanvasTexture(previewFotoCanvas)
  const hoofdMat = [
    huid, huid, huid, huid,
    new THREE.MeshBasicMaterial({ map: fotoTex }), // voorkant
    huid, // achterkant
  ]
  // Gebruik een bol met de foto als texture op de voorkant
  const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), huid)
  hoofd.position.y = 1.2; g.add(hoofd)
  // Foto als halve bol op de voorkant geplakt
  const gezichtGeo = new THREE.SphereGeometry(0.251, 20, 16, Math.PI * 1.25, Math.PI * 0.5, Math.PI * 0.2, Math.PI * 0.6)
  const fotoMat = new THREE.MeshBasicMaterial({ map: fotoTex, transparent: false })
  const gezicht = new THREE.Mesh(gezichtGeo, fotoMat)
  gezicht.position.y = 1.2
  g.add(gezicht)
  g.userData.fotoTex = fotoTex

  // Pet
  const pet = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), rood)
  pet.position.y = 1.35; g.add(pet)
  const klep = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.18), rood)
  klep.position.set(0, 1.33, -0.22); g.add(klep)

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
  document.getElementById('webcam-scherm').style.display = 'none'
}

window.neemEnBevestigFoto = function() {
  const video = document.getElementById('webcam-video')
  const canvas = document.getElementById('webcam-canvas')
  const ctx = canvas.getContext('2d')

  ctx.save()
  ctx.translate(128, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, 128, 128)
  ctx.restore()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ctx.arc(64, 64, 64, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'

  fotoTexture = new THREE.CanvasTexture(canvas)
  localStorage.setItem('mrj-foto', canvas.toDataURL())
  gekozenKarakter = 'foto'
  localStorage.setItem('mrj-karakter', 'foto')

  window.sluitWebcam()
  document.getElementById('karakter-status').textContent = '✅ Foto genomen! Jouw gezicht zit nu op Mario!'

  if (mario) { scene.remove(mario) }
  mario = maakMario()
  mario.position.set(spelerX * TEGEL, 0.2, spelerY * TEGEL)
}

window.opnieuwFoto = function() {
  // Webcam draait al, preview update zichzelf live — niks te doen
  // Gebruiker kan opnieuw positioneren en dan op OK klikken
}

// Laad opgeslagen foto bij opstarten
try {
  const savedFoto = localStorage.getItem('mrj-foto')
  if (savedFoto && gekozenKarakter === 'foto') {
    const img = new Image()
    img.onload = function() {
      const canvas = document.createElement('canvas')
      canvas.width = 128; canvas.height = 128
      canvas.getContext('2d').drawImage(img, 0, 0, 128, 128)
      fotoTexture = new THREE.CanvasTexture(canvas)
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
        // Automatisch door naar het volgende level
        laadLevel(levelNummer + 1)
      } else {
        // Laatste level gehaald → kanon-sequentie!
        finishFase = 'kanon_intro'
        finishTimer = tijd
        hudBericht.style.display = 'block'
        hudBericht.innerHTML = '<span style="color:#ffd700;font-size:32px">ALLE LEVELS GEHAALD!</span><br><span style="font-size:18px">Stap in het kanon... 💥</span>'
        // Bouw kanon
        if (finishHuis) {
          const kx = finishHuis.x * TEGEL
          const kz = finishHuis.y * TEGEL
          const kanon = new THREE.Group()
          kanon.name = 'kanon'
          const basis = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.4, 16),
            new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 }))
          basis.position.y = 0.4; kanon.add(basis)
          const loop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.5, 16),
            new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }))
          loop.position.set(0, 1.5, 0); loop.rotation.x = -0.6; kanon.add(loop)
          const rand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 16),
            new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }))
          rand.position.set(0, 2.5, -0.7); rand.rotation.x = Math.PI / 2 - 0.6; kanon.add(rand)
          const lont = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200 }))
          lont.position.set(0.5, 0.8, 0.3); lont.name = 'lont'; kanon.add(lont)
          kanon.add(new THREE.PointLight(0xff4400, 1, 3))
          kanon.position.set(kx, 0.2, kz)
          scene.add(kanon)
          wereldObjecten.push(kanon)
          finishHuis.kanon = kanon
        }
      }
    }
  }

  // Kanon intro: Mario loopt naar het kanon
  if (finishFase === 'kanon_intro' && mario && finishHuis) {
    const kx = finishHuis.x * TEGEL, kz = finishHuis.y * TEGEL
    mario.visible = true
    mario.position.x += (kx - mario.position.x) * 0.06
    mario.position.z += (kz - mario.position.z) * 0.06
    mario.rotation.y = Math.atan2(kx - mario.position.x, -(kz - mario.position.z))
    if (Math.sqrt((mario.position.x - kx) ** 2 + (mario.position.z - kz) ** 2) < 0.3 || tijd - finishTimer > 3) {
      finishFase = 'kanon_in'
      finishTimer = tijd
      mario.visible = false
      hudBericht.innerHTML = '<span style="color:#ff4400;font-size:42px">3...</span>'
    }
  }

  // Kanon countdown
  if (finishFase === 'kanon_in') {
    const dt = tijd - finishTimer
    if (dt < 1) hudBericht.innerHTML = '<span style="color:#ff4400;font-size:42px">3...</span>'
    else if (dt < 2) hudBericht.innerHTML = '<span style="color:#ff6600;font-size:48px">2...</span>'
    else if (dt < 3) hudBericht.innerHTML = '<span style="color:#ff8800;font-size:54px">1...</span>'
    else {
      hudBericht.innerHTML = '<span style="color:#ffcc00;font-size:64px">BOEM! 💥</span>'
      finishFase = 'kanon_vuur'
      finishTimer = tijd
      if (mario && finishHuis) {
        mario.visible = true
        mario.position.set(finishHuis.x * TEGEL, 3, finishHuis.y * TEGEL)
      }
    }
  }

  // Kanon vuur: Mario vliegt door de lucht!
  if (finishFase === 'kanon_vuur' && mario) {
    const dt = tijd - finishTimer
    // Mario vliegt in een grote boog
    mario.position.y = 3 + dt * 10 - dt * dt * 1.8
    mario.position.x -= dt * 4
    mario.position.z -= dt * 3
    mario.rotation.z = dt * 5
    mario.rotation.x = dt * 3
    // Camera volgt dichtbij, iets achter en boven Mario
    camera.position.lerp(
      new THREE.Vector3(mario.position.x + 2, mario.position.y + 2, mario.position.z + 5), 0.08)
    camera.lookAt(mario.position)
    if (dt > 3) {
      hudBericht.style.display = 'block'
      hudBericht.innerHTML = '<span style="color:#ffd700;font-size:36px">🎉 GEWONNEN! 🎉</span><br><span style="font-size:18px">Terug naar Level 1!</span>'
    }
    if (dt > 5) {
      hudBericht.style.display = 'none'
      mario.rotation.z = 0; mario.rotation.x = 0
      laadLevel(0)
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
  if (menuPauze) {
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

  if (!inputUit) {
    // Beweging
    const heeftSchoenenNu = scherm === 'level' && schoenenAan && (snelleSchoenen || snelleSchoenenAltijd)
    const schaal = dt * 60 // schaal naar 60fps-equivalent
    const snelheid = (heeftSchoenenNu ? 0.17 : 0.07) * schaal
    let dx = 0, dy = 0
    if (keys['ArrowUp']) dy -= snelheid
    if (keys['ArrowDown']) dy += snelheid
    if (keys['ArrowLeft']) dx -= snelheid
    if (keys['ArrowRight']) dx += snelheid

    loopt = dx !== 0 || dy !== 0
    if (loopt) loopTeller += 0.08 * schaal; else loopTeller = 0

    // Springen
    if (keys[' '] && opGrond) { spelerVY = 0.09; opGrond = false }
    spelerVY -= 0.006 * schaal
    spelerHoogte += spelerVY * schaal
    if (spelerHoogte <= 0) { spelerHoogte = 0; spelerVY = 0; opGrond = true }

    // Collision
    const kaart = actieveKaart
    if (kaart) {
      if (isVrij(kaart, spelerX + dx, spelerY + dy)) { spelerX += dx; spelerY += dy }
      else if (isVrij(kaart, spelerX + dx, spelerY)) { spelerX += dx }
      else if (isVrij(kaart, spelerX, spelerY + dy)) { spelerY += dy }
    }

    // Richting
    if (dx !== 0 || dy !== 0) spelerRichting = Math.atan2(-dx, -dy)

    // Mario update
    if (mario) {
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
      for (const p of portalenData) {
        const pdx = spelerX - p.x, pdy = spelerY - p.y
        if (Math.sqrt(pdx * pdx + pdy * pdy) < 0.4) {
          if (p.open) { laadLevel(p.level); break }
          else {
            hudBericht.style.display = 'block'
            hudBericht.textContent = '🔒 Haal eerst het vorige level!'
            setTimeout(() => hudBericht.style.display = 'none', 1500)
            // Gewoon de beweging terugdraaien zodat je ertegen botst
            spelerX -= dx
            spelerY -= dy
          }
          break
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
        const sanderSnelheid = (0.02 + levelNummer * 0.003) * schaal * moeilijkheidFactor
        if (afst < 8 && afst > 0.5) {
          const nx = s.x + (dx / afst) * sanderSnelheid
          const ny = s.y + (dy / afst) * sanderSnelheid
          if (isVrij(actieveKaart, nx, ny)) { s.x = nx; s.y = ny }
          else if (isVrij(actieveKaart, nx, s.y)) { s.x = nx }
          else if (isVrij(actieveKaart, s.x, ny)) { s.y = ny }
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

        // Te oud? Verwijderen
        if (sh.leeftijd > 4) {
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
          if (isVrij(kaart, nx, ny)) {
            achtervolger.x = nx; achtervolger.y = ny
          } else if (isVrij(kaart, nx, achtervolger.y)) {
            achtervolger.x = nx
          } else if (isVrij(kaart, achtervolger.x, ny)) {
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
    const ring = p.mesh.getObjectByName('ring')
    if (ring) ring.rotation.z = tijd * 1.5
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

  // Camera
  const cx = spelerX * TEGEL, cz = spelerY * TEGEL
  camera.position.lerp(new THREE.Vector3(cx, 10, cz + 12), 0.05)
  camera.lookAt(cx, 0, cz)

  // Zon meebewegen
  zon.position.set(cx + 10, 15, cz - 5)
  zon.target.position.set(cx, 0, cz)

  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}

loop()
