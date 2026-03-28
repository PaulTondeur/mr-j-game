import * as THREE from 'three'
import { levels } from './levels.js'
import { themas } from './themas.js'

const TEGEL = 2

// === RENDERER ===
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.domElement.style.position = 'fixed'
renderer.domElement.style.top = '0'
renderer.domElement.style.left = '0'
renderer.domElement.style.width = '100%'
renderer.domElement.style.height = '100%'
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.Fog(0x87ceeb, 30, 60)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200)

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
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
let score = 0
let finishFase = null // null, 'spring', 'glijden', 'lopen', 'huisje'
let finishTimer = 0
let finishHuis = null
let finishPaal = null
let sandersData = []
let shawarmaData = []
let gezondheid = 3 // 3 hits per leven
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

  // Materialen — kleuren exact van de afbeelding
  const huid = new THREE.MeshStandardMaterial({ color: 0xfec29a, roughness: 0.65 })
  const rood = new THREE.MeshStandardMaterial({ color: 0xe52521, roughness: 0.45 })
  const blauw = new THREE.MeshStandardMaterial({ color: 0x2b3caa, roughness: 0.45 })
  const bruin = new THREE.MeshStandardMaterial({ color: 0x7a3f10, roughness: 0.65 })
  const snorKleur = new THREE.MeshStandardMaterial({ color: 0x1a0800, roughness: 0.7 })
  const witMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  const zwartMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
  const geelKnoop = new THREE.MeshStandardMaterial({ color: 0xf5d623, metalness: 0.4, roughness: 0.3 })

  // === HOOFD (groot, rond — kenmerkend voor Mario) ===
  const hoofd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), huid)
  hoofd.position.y = 1.28
  hoofd.scale.set(1, 0.95, 0.95)
  hoofd.castShadow = true
  g.add(hoofd)

  // Oren (aan de zijkanten, half achter de pet)
  for (const s of [-1, 1]) {
    const oor = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), huid)
    oor.position.set(s * 0.27, 1.2, 0.02)
    g.add(oor)
  }

  // === OGEN (groot, rond, blauw — kenmerkend) ===
  for (const s of [-0.1, 0.1]) {
    // Oogkas (zwarte rand)
    const oogRand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), zwartMat)
    oogRand.position.set(s, 1.3, -0.22)
    g.add(oogRand)
    // Wit
    const oogWit = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), witMat)
    oogWit.position.set(s, 1.3, -0.23)
    g.add(oogWit)
    // Iris (helder blauw)
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3d7aed, roughness: 0.3 }))
    iris.position.set(s, 1.3, -0.27)
    g.add(iris)
    // Pupil
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), zwartMat)
    pupil.position.set(s, 1.3, -0.3)
    g.add(pupil)
    // Lichtpuntje
    const lp = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), witMat)
    lp.position.set(s + 0.018, 1.32, -0.31)
    g.add(lp)
  }

  // Wenkbrauwen (dik, zwart, licht gebogen)
  for (const s of [-0.1, 0.1]) {
    const wb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.03), zwartMat)
    wb.position.set(s, 1.38, -0.24)
    wb.rotation.z = s * -0.15
    g.add(wb)
  }

  // === NEUS (groot, bol, prominent — het kenmerk van Mario) ===
  const neus = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), huid)
  neus.position.set(0, 1.18, -0.32)
  neus.scale.set(1, 0.85, 1)
  g.add(neus)

  // === SNOR (dik, breed, zwart — waaiert uit naar de zijkanten) ===
  // Hoofdlichaam van de snor
  const snorMidden = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), snorKleur)
  snorMidden.position.set(0, 1.08, -0.28)
  snorMidden.scale.set(1.5, 0.6, 0.8)
  g.add(snorMidden)
  // Twee grote krullen naar de zijkanten
  for (const s of [-1, 1]) {
    const krul = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), snorKleur)
    krul.position.set(s * 0.12, 1.07, -0.26)
    krul.scale.set(1.3, 0.55, 0.7)
    g.add(krul)
    // Uiteinde krult licht omlaag
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), snorKleur)
    tip.position.set(s * 0.2, 1.04, -0.22)
    tip.scale.set(1, 0.5, 0.6)
    g.add(tip)
  }

  // === PET (rood, met witte cirkel en M) ===
  // Petbol (halve bol)
  const petBol = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), rood)
  petBol.position.y = 1.42
  g.add(petBol)
  // Petrand
  const petRand = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.035, 18), rood)
  petRand.position.y = 1.42
  g.add(petRand)
  // Klep (breed, naar voren)
  const klep = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.2), rood)
  klep.position.set(0, 1.41, -0.26)
  g.add(klep)
  // Klep afronding
  const klepRond = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 12, 1, false, 0, Math.PI), rood)
  klepRond.rotation.x = Math.PI / 2
  klepRond.position.set(0, 1.41, -0.36)
  g.add(klepRond)
  // Witte cirkel op de pet
  const logoCircle = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), witMat)
  logoCircle.position.set(0, 1.55, -0.22)
  logoCircle.rotation.x = -0.5
  g.add(logoCircle)
  // Rode M op de witte cirkel (via een kleiner rood rondje als basis)
  const logoM = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), rood)
  logoM.position.set(0, 1.551, -0.219)
  logoM.rotation.x = -0.5
  g.add(logoM)

  // === LICHAAM ===
  // Rood shirt (bovenste deel)
  const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 14), rood)
  shirt.position.y = 0.78
  shirt.castShadow = true
  g.add(shirt)

  // Blauwe overall (hoog, tot aan borst — kenmerkend)
  const overall = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.42, 14), blauw)
  overall.position.y = 0.42
  overall.castShadow = true
  g.add(overall)

  // Overallbovenstuk (borststuk, iets smaller)
  const borstStuk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.15), blauw)
  borstStuk.position.set(0, 0.7, -0.08)
  g.add(borstStuk)

  // Gele knopen (rond, groot, aan de zijkanten van het borststuk)
  for (const s of [-0.16, 0.16]) {
    const knoop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), geelKnoop)
    knoop.position.set(s, 0.68, -0.17)
    g.add(knoop)
  }

  // === ARMEN (rood shirt, witte handschoenen) ===
  for (const s of [-1, 1]) {
    // Bovenarm
    const bovenarm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.2, 10), rood)
    bovenarm.position.set(s * 0.3, 0.78, 0)
    bovenarm.rotation.z = s * 0.25
    g.add(bovenarm)
    // Onderarm
    const onderarm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.15, 10), rood)
    onderarm.position.set(s * 0.34, 0.62, 0)
    onderarm.rotation.z = s * 0.1
    g.add(onderarm)
    // Handschoen (groot, bol, wit)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), witMat)
    hand.position.set(s * 0.36, 0.5, 0)
    hand.name = s < 0 ? 'linkerHand' : 'rechterHand'
    hand.castShadow = true
    g.add(hand)
  }

  // === BENEN (blauw + bruine schoenen) ===
  for (const s of [-0.11, 0.11]) {
    // Been (blauw, overall-stof)
    const been = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 10), blauw)
    been.position.set(s, 0.15, 0)
    been.name = s < 0 ? 'linkerBeen' : 'rechterBeen'
    g.add(been)

    // Schoen (groot, afgerond, bruin)
    const schoen = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), bruin)
    schoen.scale.set(0.75, 0.45, 1.3)
    schoen.position.set(s, 0.02, -0.05)
    schoen.name = s < 0 ? 'linkerSchoen' : 'rechterSchoen'
    schoen.castShadow = true
    g.add(schoen)
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

  // Paal
  const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 8), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 }))
  paal.position.y = 2.2; paal.castShadow = true; g.add(paal)

  // Gouden bol bovenop
  const bol = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.2 }))
  bol.position.y = 4.2; g.add(bol)

  // Vlag (begint bovenaan)
  const vlagGeo = new THREE.PlaneGeometry(0.8, 0.5)
  const vlagMat = new THREE.MeshStandardMaterial({ color: 0x44bb44, side: THREE.DoubleSide })
  const vlag = new THREE.Mesh(vlagGeo, vlagMat)
  vlag.position.set(0.4, 3.8, 0)
  vlag.name = 'vlag'
  g.add(vlag)

  // Licht
  const paalLicht = new THREE.PointLight(0xffd700, 1, 5)
  paalLicht.position.set(0, 4.2, 0); g.add(paalLicht)

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
    // Slot — boven de ring, niet erop
    const slotGroep = new THREE.Group()
    const slotBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5, roughness: 0.3 }))
    slotGroep.add(slotBody)
    const beugel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6 }))
    beugel.position.y = 0.15
    slotGroep.add(beugel)
    // Sleutelgat
    const gat = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }))
    gat.rotation.x = Math.PI / 2
    gat.position.z = -0.06
    slotGroep.add(gat)
    slotGroep.position.y = 1.4
    g.add(slotGroep)
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
  gezondheid = 3; onkwetsbaarTot = 0
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
  hudBericht.style.display = 'none'
  updateHUD()
}

function zetCamera() {
  camera.position.set(spelerX * TEGEL, 10, spelerY * TEGEL + 12)
  camera.lookAt(spelerX * TEGEL, 0, spelerY * TEGEL)
}

function updateHUD() {
  hudLevens.textContent = '❤️'.repeat(levens)
  hudScore.textContent = 'Score: ' + score
  const hpEl = document.getElementById('gezondheid')
  if (hpEl) {
    let html = 'HP '
    for (let i = 0; i < 3; i++) {
      const kleur = i < gezondheid ? '#44dd44' : '#442222'
      html += `<div class="hp-blok" style="background:${kleur}"></div>`
    }
    hpEl.innerHTML = html
  }
}

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

  if (scherm === 'gameover') {
    if (keys[' ']) { levens = 3; laadStart() }
    renderer.render(scene, camera)
    requestAnimationFrame(loop)
    return
  }

  if (!inputUit) {
    // Beweging
    const snelheid = 0.07
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
        if (s.gooimTimer > 3) {
          s.gooimTimer = 0
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
