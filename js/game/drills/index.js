// Drill registry: metadata, camera, controls, instructions.
import { PeaDrill } from './pea.js';
import { TriangleDrill } from './triangle.js';
import { CobraDrill } from './cobra.js';
import { CylinderDrill } from './cylinder.js';
import { SuturingDrill } from './suturing.js';

const K = (...c) => c;

// Single-instrument bindings. Right-hand default and the left-hand-mode variant (spec).
const SINGLE_RIGHT = { up: K('ArrowUp'), down: K('ArrowDown'), left: K('ArrowLeft'), right: K('ArrowRight'), in: K('KeyW'), out: K('KeyS'), ccw: K('KeyQ'), cw: K('KeyE'), grab: K('Space', 'Enter') };
const SINGLE_LEFT = { up: K('KeyW'), down: K('KeyS'), left: K('KeyA'), right: K('KeyD'), in: K('ArrowUp'), out: K('ArrowDown'), ccw: K('ArrowLeft'), cw: K('ArrowRight'), grab: K('Space', 'Enter') };

export const DRILLS = [
  {
    id: 'pea-drop', name: 'Pea Drop', thumb: 'assets/img/thumb-pea.png', cls: PeaDrill,
    desc: 'Pick ten peas from the ring and drop each one through the hole on top of the dome.',
    frame: { min: [-3.1, 0, -0.6], max: [3.1, 0.9, 4.4] },
    camera: { pos: [0, 4.5, 6.0], look: [0.1, 0, 1.9] },
    layout: 'single-grab', usesHand: true,
    keys: (left) => [left ? SINGLE_LEFT : SINGLE_RIGHT],
    instructions: (lv) => ({
      goal: 'Grasp each pea, carry it over the dome and release it into the hole. Peas that roll off land back in the ring and count as misses.',
      extra: lv === 'ADVANCED' ? 'Untouched peas hop to new spots every 3 seconds.' : lv === 'EXPERT' ? 'The ring is centred, untouched peas move every 3 seconds and the dome slides side to side.' : lv === 'INTERMEDIATE' ? 'Non-dominant hand: the instrument comes in from the other side.' : null,
      warn: 'Touching the cup is a bump (+5 s in real Top Gun). Drop the pea in — pushing it in ("putting") is a bump too.',
    }),
  },
  {
    id: 'triangle-transfer', name: 'Triangle Transfer', thumb: 'assets/img/thumb-triangle.png', cls: TriangleDrill,
    desc: 'Thread the hook through the loop, lift the triangle and set it down in the glowing target. Five times.',
    frame: { min: [-3.0, 0, -1.4], max: [3.0, 0.9, 4.0] },
    camera: { pos: [0, 4.6, 6.0], look: [0, 0, 1.7] },
    layout: 'single-rotate', usesHand: true,
    keys: (left) => [left ? SINGLE_LEFT : SINGLE_RIGHT],
    instructions: (lv) => ({
      goal: 'Pass the hook through the loop and lift: it catches automatically. Carry the swinging triangle to the target circle and lower it — or drop it from just above.',
      extra: lv === 'ADVANCED' ? 'The start position changes every rep.' : lv === 'EXPERT' ? 'Both the start and the target move every rep.' : lv === 'INTERMEDIATE' ? 'Non-dominant hand.' : null,
      warn: 'Lift it, never drag it. Shaking it off (an "earthquake"), bumping the board or landing outside the circle is a bump.',
    }),
  },
  {
    id: 'cobra-rope', name: 'Cobra Rope', thumb: 'assets/img/thumb-cobra.png', cls: CobraDrill,
    desc: 'Run the rope hand over hand with two graspers, gripping only the red regions, in order.',
    frame: { min: [-3.0, 0, 0.4], max: [3.4, 2.2, 3.0] },
    camera: { pos: [0.3, 4.2, 6.4], look: [0.3, 0.45, 1.6] },
    layout: 'dual-plane', usesHand: false, strikes: true,
    keys: () => [
      { up: K('KeyW'), down: K('KeyS'), left: K('KeyA'), right: K('KeyD'), ccw: K('KeyQ'), cw: K('KeyE'), grab: K('AltLeft', 'KeyF', 'KeyC') },
      { up: K('KeyO'), down: K('KeyL'), left: K('KeyK'), right: K('Semicolon'), ccw: K('KeyI'), cw: K('KeyP'), grab: K('AltRight', 'Enter', 'KeyH', 'Slash') },
    ],
    instructions: (lv) => ({
      goal: 'Left grasps R1 to start. Then alternate: the right grasper takes the next red region, the left catches up to the same region, and so on until both hold R11.',
      extra: lv === 'INTERMEDIATE' ? 'Only the red regions you have reached are shown.' : (lv === 'ADVANCED' || lv === 'EXPERT') ? 'The next red region only blinks briefly — remember where it is.' : null,
      warn: '3 strikes and you start again: skipping a red, using only one hand ("fireman’s pole"), or crossing over on Expert.',
    }),
  },
  {
    id: 'cylinder-transfer', name: 'Cylinder Transfer', thumb: 'assets/img/thumb-cylinder.png', cls: CylinderDrill,
    desc: 'Lift each winged cylinder, pass it across the midline to the other grasper and drop it on its peg.',
    frame: { min: [-3.45, 0, -1.15], max: [3.45, 1.0, 2.75] },
    camera: { pos: [0, 4.7, 5.2], look: [0, 0.1, 1.0] },
    layout: 'dual-active', usesHand: true,
    keys: () => [{ up: K('ArrowUp'), down: K('ArrowDown'), left: K('ArrowLeft'), right: K('ArrowRight'), in: K('KeyW'), out: K('KeyS'), ccw: K('KeyA'), cw: K('KeyD'), grab: K('Space', 'Enter') }],
    instructions: () => ({
      goal: 'Pick up the highlighted cylinder by a wing, carry it past the orange center line, grab it with the other grasper, then drop it over the cyan peg. Six forward, six back.',
      extra: 'Only one grasper is active at a time — it switches automatically.',
      warn: 'Grabbing the wrong cylinder, dropping it, missing the peg or touching the board is a bump.',
    }),
  },
  {
    id: 'suturing', name: 'Suturing', thumb: 'assets/img/thumb-suturing.jpg', cls: SuturingDrill,
    desc: 'Free practice on a deformable pad: load the needle, take bites across the incision, manage the suture.',
    frame: { min: [-2.1, 0, -1.2], max: [2.1, 0.6, 2.8] },
    camera: { pos: [0, 3.1, 3.7], look: [0, 0.28, 0.9] },
    layout: 'dual-sphere', usesHand: false, sandbox: true,
    keys: () => [
      { up: K('KeyW'), down: K('KeyS'), left: K('KeyA'), right: K('KeyD'), in: K('KeyZ'), out: K('KeyX', 'AltLeft'), ccw: K('KeyQ'), cw: K('KeyE'), grab: K('ShiftLeft', 'KeyF') },
      { up: K('KeyO'), down: K('KeyL'), left: K('KeyK'), right: K('Semicolon'), in: K('Period'), out: K('Comma', 'AltRight'), ccw: K('KeyI'), cw: K('KeyP'), grab: K('ShiftRight', 'KeyH') },
    ],
    instructions: () => ({
      goal: 'Grasp the needle, drive the tip into one side of the incision and out the other. Each crossing counts as a bite. Grab the suture or the tissue edge with the free grasper.',
      extra: 'Sandbox — no score, practise as long as you like.',
      warn: null,
    }),
  },
];
export const drillById = (id) => DRILLS.find((d) => d.id === id) || DRILLS[0];

export const KEY_LABEL = (code) => ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', AltLeft: 'L-Alt', AltRight: 'R-Alt', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', Semicolon: ';', Period: '.', Comma: ',', Slash: '/' }[code] || code.replace('Key', ''));

/** What each level changes, shown on level cards and in the briefing. */
const MODS = {
  'pea-drop': { BEGINNER: ['Dominant hand', 'Peas stay put'], INTERMEDIATE: ['Non-dominant hand'], ADVANCED: ['Non-dominant hand', 'Peas hop every 3 s'], EXPERT: ['Non-dominant hand', 'Peas hop', 'Dome slides', 'Centred ring'] },
  'triangle-transfer': { BEGINNER: ['Dominant hand', 'Fixed start and target'], INTERMEDIATE: ['Non-dominant hand'], ADVANCED: ['Non-dominant hand', 'Start moves each rep'], EXPERT: ['Non-dominant hand', 'Start and target move'] },
  'cobra-rope': { BEGINNER: ['All red regions shown'], INTERMEDIATE: ['Only reached regions shown'], ADVANCED: ['Next region only blinks'], EXPERT: ['Next region only blinks'] },
  'cylinder-transfer': { BEGINNER: ['Six forward, six back'], INTERMEDIATE: ['Six forward, six back'], ADVANCED: ['Six forward, six back'], EXPERT: ['Six forward, six back'] },
  suturing: { BEGINNER: ['Free practice'], INTERMEDIATE: ['Free practice'], ADVANCED: ['Free practice'], EXPERT: ['Free practice'] },
};
const AIDS = { BEGINNER: 'Autopilot height', INTERMEDIATE: 'Height magnet + grab helper', ADVANCED: 'Miss hints only', EXPERT: 'No helpers' };
export const modifiersFor = (id, level) => [...(MODS[id]?.[level] || []), ...(id === 'suturing' ? [] : [AIDS[level]])];
