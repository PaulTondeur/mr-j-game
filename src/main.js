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
    boerAudio.currentTime = 0
    boerAudio.play()
    setTimeout(() => {
      bahSanderAudio.currentTime = 0
      bahSanderAudio.play()
    }, 100)
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
let gezondheid = 3 // 3 hits per leven
let snelleSchoenen = false // tijdelijk (1 level)
let snelleSchoenenAltijd = JSON.parse(localStorage.getItem('mrj-snelle-schoenen') || 'false')
let onkwetsbaarTot = 0 // tijdstip tot wanneer je onkwetsbaar bent
let ontgrendeld = [true, false, false, false, false, false, false, false, false, false]

try {
  const saved = JSON.parse(localStorage.getItem('mrj-ontgrendeld'))
  if (saved && saved.length === 10) ontgrendeld = saved
} catch (e) {}

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
  const bord = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.06), new THREE.MeshStandardMaterial({ color: 0xdda54a, roughness: 0.8 }))
  bordGroep.add(bord)

  // Rand
  const randMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
  const randBoven = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.08), randMat)
  randBoven.position.set(0, 0.35, 0); bordGroep.add(randBoven)
  const randOnder = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.08), randMat)
  randOnder.position.set(0, -0.35, 0); bordGroep.add(randOnder)

  // Tekst op het bord via canvas texture
  const tekstCanvas = document.createElement('canvas')
  tekstCanvas.width = 256; tekstCanvas.height = 128
  const tctx = tekstCanvas.getContext('2d')
  tctx.fillStyle = '#dda54a'
  tctx.fillRect(0, 0, 256, 128)
  tctx.fillStyle = '#442200'
  tctx.font = 'bold 36px monospace'
  tctx.textAlign = 'center'
  tctx.fillText('Level ' + label, 128, 48)
  // Thema naam
  if (levelIdx < levels.length) {
    const themaLabels = ['Strand', 'Bos', 'Regen', 'Zomer', 'Bloemen', "Mario's", 'Dorp', 'Spookjes', 'Boerderij', 'Finale']
    tctx.font = '24px monospace'
    tctx.fillText(themaLabels[levelIdx] || '', 128, 90)
  }
  const tekstTexture = new THREE.CanvasTexture(tekstCanvas)
  const tekstMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.6),
    new THREE.MeshBasicMaterial({ map: tekstTexture, transparent: true })
  )
  tekstMesh.position.z = -0.035
  bordGroep.add(tekstMesh)

  // Paal
  const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x6b4226 }))
  paal.position.y = -0.9; bordGroep.add(paal)

  bordGroep.position.set(0, 1.8, 0)
  g.add(bordGroep)

  if (!isOpen) {
    // Fallback slot
    const slotGroep = new THREE.Group()
    slotGroep.name = 'slotFallback'
    const slotBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 }))
    slotGroep.add(slotBody)
    slotGroep.position.y = 1.4
    g.add(slotGroep)

    // Laad Kenney lock op achtergrond
    laadModel('lock').then((lockModel) => {
      if (lockModel && g.parent) {
        const fb = g.getObjectByName('slotFallback')
        if (fb) g.remove(fb)
        lockModel.scale.set(1.5, 1.5, 1.5)
        lockModel.position.y = 1.4
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
  let start = null, finish = null
  const pads = [], ports = [], sanders = []
  for (let rij = 0; rij < kaart.length; rij++) {
    for (let kolom = 0; kolom < kaart[rij].length; kolom++) {
      const cel = kaart[rij][kolom]
      if (cel === 'S') start = { x: kolom + 0.5, y: rij + 0.5 }
      if (cel === 'F') finish = { x: kolom + 0.5, y: rij + 0.5 }
      if (cel === 'P') pads.push({ x: kolom + 0.5, y: rij + 0.5 })
      if (cel === 'M') sanders.push({ x: kolom + 0.5, y: rij + 0.5 })
      if (cel >= '0' && cel <= '9') {
        ports.push({
          x: kolom + 0.5, y: rij + 0.5,
          level: cel === '0' ? 9 : parseInt(cel) - 1,
          label: cel === '0' ? '10' : cel,
        })
      }
    }
  }
  return { start, finish, paddestoelen: pads, portalen: ports, sanders }
}

// Startscherm kaart
const startKaart = [
  '##########################',
  '#........................#',
  '#.S.1..2..3..4..5........#',
  '#........................#',
  '#...6..7..8..9..0........#',
  '#........................#',
  '#........................#',
  '#........................#',
  '##########################',
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
  hudBericht.style.display = 'block'
  hudBericht.textContent = 'Loop naar een portaal!'
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
  } else {
    scene.background.set(0x87ceeb); scene.fog = new THREE.Fog(0x87ceeb, 30, 60)
  }

  bouwKaart(level.kaart)
  mario = maakMario()

  const parsed = parseKaart(level.kaart)
  spelerX = parsed.start.x
  spelerY = parsed.start.y
  spelerHoogte = 0; spelerVY = 0; opGrond = true
  gezondheid = 3; onkwetsbaarTot = 0; snelleSchoenen = false
  finishPos = parsed.finish

  // Finish
  if (finishPos) maakFinishPaal(finishPos.x, finishPos.y)

  // Meester Sanders
  sandersData = parsed.sanders.map(s => ({
    mesh: maakSander(s.x, s.y), x: s.x, y: s.y, gooimTimer: 0,
  }))
  shawarmaData = []

  zetCamera()
  hudNaam.textContent = level.naam
  updateHUD()

  // Uitleg tonen als je dit level nog niet hebt gehaald
  const gehaald = ontgrendeld[nummer + 1] || false
  if (!gehaald) {
    inputUit = true
    hudBericht.style.display = 'block'
    hudBericht.innerHTML = '<div style="background:rgba(0,0,0,0.7);padding:20px;border-radius:12px;font-size:18px">' +
      '<span style="font-size:24px;color:#ffd700">' + level.naam + '</span><br><br>' +
      '⬆️⬇️⬅️➡️ Lopen<br>' +
      '⎵ Spatie = Springen<br>' +
      'P = Pauze<br><br>' +
      '🥙 Ontwijkt de shawarma\'s van Sander!<br>' +
      '🚩 Loop naar de vlag!<br><br>' +
      '<span style="font-size:14px;color:#aaa">Druk op SPATIE om te starten</span>' +
      '</div>'
    const wachtOpStart = setInterval(() => {
      if (keys[' ']) {
        clearInterval(wachtOpStart)
        hudBericht.style.display = 'none'
        inputUit = false
        keys[' '] = false
      }
    }, 100)
  } else {
    hudBericht.style.display = 'none'
  }
}

function zetCamera() {
  camera.position.set(spelerX * TEGEL, 10, spelerY * TEGEL + 12)
  camera.lookAt(spelerX * TEGEL, 0, spelerY * TEGEL)
}

function updateHUD() {
  hudLevens.textContent = '❤️'.repeat(levens)
  hudScore.textContent = 'Score: ' + score
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
    // Wacht 2 seconden, dan terug
    if (tijd - finishTimer > 2) {
      hudBericht.style.display = 'none'
      laadStart()
    }
  }
}

// === GAME LOOP ===
laadStart()

function loop() {
  tijd += 1 / 60

  // Pauze met P toets
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

  if (scherm === 'gameover') {
    if (keys[' ']) { levens = 3; laadStart() }
    renderer.render(scene, camera)
    requestAnimationFrame(loop)
    return
  }

  if (!inputUit) {
    // Beweging
    const heeftSchoenenNu = scherm === 'level' && schoenenAan && (snelleSchoenen || snelleSchoenenAltijd)
    const snelheid = heeftSchoenenNu ? 0.17 : 0.07
    let dx = 0, dy = 0
    if (keys['ArrowUp']) dy -= snelheid
    if (keys['ArrowDown']) dy += snelheid
    if (keys['ArrowLeft']) dx -= snelheid
    if (keys['ArrowRight']) dx += snelheid

    loopt = dx !== 0 || dy !== 0
    if (loopt) loopTeller += 0.15; else loopTeller = 0

    // Springen
    if (keys[' '] && opGrond) { spelerVY = 0.14; opGrond = false }
    spelerVY -= 0.006
    spelerHoogte += spelerVY
    if (spelerHoogte <= 0) { spelerHoogte = 0; spelerVY = 0; opGrond = true }

    // Collision
    const kaart = actieveKaart
    if (kaart) {
      if (isVrij(kaart, spelerX + dx, spelerY + dy)) { spelerX += dx; spelerY += dy }
      else if (isVrij(kaart, spelerX + dx, spelerY)) { spelerX += dx }
      else if (isVrij(kaart, spelerX, spelerY + dy)) { spelerY += dy }
    }

    // Richting
    if (dx !== 0 || dy !== 0) spelerRichting = Math.atan2(dx, dy)

    // Mario update
    if (mario) {
      mario.position.set(spelerX * TEGEL, 0.2 + spelerHoogte * 5, spelerY * TEGEL)
      mario.rotation.y = spelerRichting

      const swing = loopt && opGrond ? Math.sin(loopTeller * 8) * 0.12 : 0
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
        if (Math.sqrt(pdx * pdx + pdy * pdy) < 0.7) {
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
      // Meester Sanders — staan stil, draaien naar Mario, gooien shawarma's
      for (const s of sandersData) {
        // Kijk naar Mario
        s.mesh.rotation.y = Math.atan2(spelerX - s.x, -(spelerY - s.y))

        // Loopanimatie (wiebelen)
        const lb = s.mesh.getObjectByName('lBeen')
        const rb = s.mesh.getObjectByName('rBeen')
        if (lb && rb) {
          lb.position.z = Math.sin(tijd * 2) * 0.02
          rb.position.z = -Math.sin(tijd * 2) * 0.02
        }

        // Gooi shawarma elke 3 seconden
        s.gooimTimer += 1 / 60
        if (s.gooimTimer > 5) {
          s.gooimTimer = 0
          speelBoer()
          const dx = spelerX - s.x
          const dy = spelerY - s.y
          const afst = Math.sqrt(dx * dx + dy * dy)
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
        const sdx = spelerX - s.x, sdy = spelerY - s.y
        if (Math.sqrt(sdx * sdx + sdy * sdy) < 0.5 && spelerHoogte < 0.3) {
          raakSchade(); break
        }
      }

      // Vliegende shawarma's updaten
      for (let i = shawarmaData.length - 1; i >= 0; i--) {
        const sh = shawarmaData[i]
        sh.x += sh.dx
        sh.y += sh.dy
        sh.leeftijd += 1 / 60
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
      // Bord kijkt naar de speler, niet de camera
      const bordWereld = new THREE.Vector3()
      bordGroep.getWorldPosition(bordWereld)
      bordGroep.lookAt(spelerX * TEGEL, bordWereld.y, spelerY * TEGEL)
    }
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
