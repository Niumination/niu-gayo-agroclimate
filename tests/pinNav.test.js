import test from 'node:test'
import assert from 'node:assert/strict'
import { arrowToDirection, nextPin, PIN_DIRECTIONS } from '../src/lib/pinNav.js'

const pins = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 10, y: 2 },
  { id: 'c', x: 30, y: 1 },
  { id: 'd', x: 5, y: 20 },
]

test('panah → arah peta', () => {
  assert.deepEqual(PIN_DIRECTIONS, ['left', 'right', 'up', 'down'])
  assert.equal(arrowToDirection('ArrowLeft'), 'left')
  assert.equal(arrowToDirection('ArrowRight'), 'right')
  assert.equal(arrowToDirection('ArrowUp'), 'up')
  assert.equal(arrowToDirection('ArrowDown'), 'down')
  assert.equal(arrowToDirection('Enter'), null)
  assert.equal(arrowToDirection('Home'), null)
})

test('nextPin memilih pin terdekat pada arah, bukan yang paling jauh', () => {
  assert.equal(nextPin(pins, 'a', 'right'), 'b')
  assert.equal(nextPin(pins, 'a', 'down'), 'd')
  assert.equal(nextPin(pins, 'b', 'right'), 'c')
  assert.equal(nextPin(pins, 'c', 'left'), 'b')
})

test('nextPin tidak membungkus dan aman untuk input aneh', () => {
  assert.equal(nextPin(pins, 'a', 'up'), 'a', 'tidak ada pin di atas → tetap')
  assert.equal(nextPin(pins, 'a', 'left'), 'a')
  assert.equal(nextPin(pins, 'tidak-ada', 'right'), 'a', 'current tak dikenal → pin pertama')
  assert.equal(nextPin([], 'a', 'right'), null)
  assert.equal(nextPin([{ id: 'solo', x: 1, y: 1 }], 'solo', 'right'), 'solo')
})
