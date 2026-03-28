// Elk level heeft muren, paddestoelen en een finish
// Muren zijn rechthoeken: { x, y, breedte, hoogte }
// Paddestoelen: { x, y }
// Finish is een cirkel: { x, y }

const buitenmuren = [
  { x: 0, y: 0, breedte: 800, hoogte: 20 },
  { x: 0, y: 580, breedte: 800, hoogte: 20 },
  { x: 0, y: 0, breedte: 20, hoogte: 600 },
  { x: 780, y: 0, breedte: 20, hoogte: 600 },
]

export const levels = [
  // Level 1 — simpel zigzag
  {
    naam: 'Level 1',
    spelerStart: { x: 50, y: 300 },
    finish: { x: 750, y: 300 },
    muren: [
      ...buitenmuren,
      { x: 200, y: 0, breedte: 20, hoogte: 420 },
      { x: 500, y: 180, breedte: 20, hoogte: 420 },
    ],
    paddestoelen: [
      { x: 120, y: 200 },
      { x: 350, y: 400 },
    ],
  },
  // Level 2 — drie muren
  {
    naam: 'Level 2',
    spelerStart: { x: 50, y: 300 },
    finish: { x: 750, y: 300 },
    muren: [
      ...buitenmuren,
      { x: 150, y: 0, breedte: 20, hoogte: 400 },
      { x: 350, y: 200, breedte: 20, hoogte: 400 },
      { x: 550, y: 0, breedte: 20, hoogte: 400 },
    ],
    paddestoelen: [
      { x: 100, y: 150 },
      { x: 250, y: 450 },
      { x: 450, y: 150 },
    ],
  },
  // Level 3 — doolhof
  {
    naam: 'Level 3',
    spelerStart: { x: 50, y: 50 },
    finish: { x: 750, y: 550 },
    muren: [
      ...buitenmuren,
      { x: 150, y: 0, breedte: 20, hoogte: 400 },
      { x: 300, y: 200, breedte: 20, hoogte: 400 },
      { x: 450, y: 0, breedte: 20, hoogte: 400 },
      { x: 600, y: 200, breedte: 20, hoogte: 400 },
    ],
    paddestoelen: [
      { x: 100, y: 450 },
      { x: 230, y: 100 },
      { x: 370, y: 500 },
      { x: 520, y: 100 },
    ],
  },
  // Level 4 — smalle gangen
  {
    naam: 'Level 4',
    spelerStart: { x: 50, y: 300 },
    finish: { x: 750, y: 300 },
    muren: [
      ...buitenmuren,
      { x: 100, y: 200, breedte: 600, hoogte: 20 },
      { x: 100, y: 380, breedte: 600, hoogte: 20 },
      { x: 200, y: 0, breedte: 20, hoogte: 200 },
      { x: 200, y: 400, breedte: 20, hoogte: 200 },
    ],
    paddestoelen: [
      { x: 350, y: 290 },
      { x: 550, y: 290 },
      { x: 150, y: 100 },
    ],
  },
  // Level 5 — kruisvorm
  {
    naam: 'Level 5',
    spelerStart: { x: 50, y: 50 },
    finish: { x: 750, y: 550 },
    muren: [
      ...buitenmuren,
      { x: 350, y: 0, breedte: 20, hoogte: 250 },
      { x: 350, y: 350, breedte: 20, hoogte: 250 },
      { x: 0, y: 270, breedte: 350, hoogte: 20 },
      { x: 370, y: 270, breedte: 430, hoogte: 20 },
    ],
    paddestoelen: [
      { x: 200, y: 150 },
      { x: 600, y: 150 },
      { x: 200, y: 450 },
      { x: 600, y: 450 },
      { x: 400, y: 300 },
    ],
  },
  // Level 6 — slalom
  {
    naam: 'Level 6',
    spelerStart: { x: 50, y: 300 },
    finish: { x: 750, y: 300 },
    muren: [
      ...buitenmuren,
      { x: 130, y: 0, breedte: 20, hoogte: 350 },
      { x: 260, y: 250, breedte: 20, hoogte: 350 },
      { x: 390, y: 0, breedte: 20, hoogte: 350 },
      { x: 520, y: 250, breedte: 20, hoogte: 350 },
      { x: 650, y: 0, breedte: 20, hoogte: 350 },
    ],
    paddestoelen: [
      { x: 80, y: 450 },
      { x: 200, y: 100 },
      { x: 330, y: 500 },
      { x: 460, y: 100 },
      { x: 590, y: 500 },
      { x: 720, y: 150 },
    ],
  },
  // Level 7 — kamers
  {
    naam: 'Level 7',
    spelerStart: { x: 50, y: 50 },
    finish: { x: 750, y: 550 },
    muren: [
      ...buitenmuren,
      { x: 0, y: 200, breedte: 320, hoogte: 20 },
      { x: 400, y: 200, breedte: 400, hoogte: 20 },
      { x: 0, y: 400, breedte: 200, hoogte: 20 },
      { x: 280, y: 400, breedte: 520, hoogte: 20 },
      { x: 400, y: 0, breedte: 20, hoogte: 200 },
      { x: 400, y: 220, breedte: 20, hoogte: 180 },
    ],
    paddestoelen: [
      { x: 200, y: 100 },
      { x: 600, y: 100 },
      { x: 150, y: 300 },
      { x: 500, y: 300 },
      { x: 600, y: 500 },
    ],
  },
  // Level 8 — spiraal
  {
    naam: 'Level 8',
    spelerStart: { x: 50, y: 50 },
    finish: { x: 400, y: 300 },
    muren: [
      ...buitenmuren,
      { x: 100, y: 100, breedte: 680, hoogte: 20 },
      { x: 100, y: 100, breedte: 20, hoogte: 400 },
      { x: 100, y: 480, breedte: 600, hoogte: 20 },
      { x: 680, y: 120, breedte: 20, hoogte: 280 },
      { x: 200, y: 200, breedte: 480, hoogte: 20 },
      { x: 200, y: 220, breedte: 20, hoogte: 200 },
      { x: 200, y: 380, breedte: 400, hoogte: 20 },
    ],
    paddestoelen: [
      { x: 400, y: 60 },
      { x: 150, y: 300 },
      { x: 400, y: 450 },
      { x: 650, y: 250 },
      { x: 350, y: 280 },
      { x: 500, y: 280 },
    ],
  },
  // Level 9 — chaos
  {
    naam: 'Level 9',
    spelerStart: { x: 50, y: 550 },
    finish: { x: 750, y: 50 },
    muren: [
      ...buitenmuren,
      { x: 120, y: 100, breedte: 20, hoogte: 300 },
      { x: 240, y: 200, breedte: 20, hoogte: 400 },
      { x: 360, y: 0, breedte: 20, hoogte: 350 },
      { x: 480, y: 250, breedte: 20, hoogte: 350 },
      { x: 600, y: 0, breedte: 20, hoogte: 300 },
      { x: 360, y: 450, breedte: 200, hoogte: 20 },
    ],
    paddestoelen: [
      { x: 80, y: 200 },
      { x: 180, y: 500 },
      { x: 300, y: 150 },
      { x: 420, y: 400 },
      { x: 540, y: 150 },
      { x: 660, y: 400 },
      { x: 720, y: 200 },
    ],
  },
  // Level 10 — de finale
  {
    naam: 'Level 10',
    spelerStart: { x: 50, y: 300 },
    finish: { x: 750, y: 300 },
    muren: [
      ...buitenmuren,
      { x: 100, y: 0, breedte: 20, hoogte: 300 },
      { x: 100, y: 380, breedte: 20, hoogte: 220 },
      { x: 200, y: 200, breedte: 20, hoogte: 400 },
      { x: 300, y: 0, breedte: 20, hoogte: 400 },
      { x: 400, y: 200, breedte: 20, hoogte: 400 },
      { x: 500, y: 0, breedte: 20, hoogte: 400 },
      { x: 600, y: 200, breedte: 20, hoogte: 400 },
      { x: 700, y: 0, breedte: 20, hoogte: 300 },
      { x: 700, y: 380, breedte: 20, hoogte: 220 },
    ],
    paddestoelen: [
      { x: 60, y: 150 },
      { x: 60, y: 450 },
      { x: 160, y: 300 },
      { x: 260, y: 500 },
      { x: 360, y: 100 },
      { x: 460, y: 500 },
      { x: 560, y: 100 },
      { x: 660, y: 400 },
    ],
  },
]
