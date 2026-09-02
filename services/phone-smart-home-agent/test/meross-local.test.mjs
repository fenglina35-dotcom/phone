import assert from 'node:assert/strict';
import test from 'node:test';
import { lampFingerprint, MerossLocalController } from '../src/meross-local.mjs';

function response(payload, method = 'GET') {
  return { ok: true, async json() { return { header: { method: `${method}ACK` }, payload }; } };
}

test('rejects non-local addresses', () => {
  assert.throws(() => new MerossLocalController({ host: '8.8.8.8' }), /局域网/);
});

test('creates a stable non-reversible lamp fingerprint', () => {
  const value = lampFingerprint('AA:BB:CC:DD:EE:FF');
  assert.match(value, /^sha256:[0-9a-f]{64}$/);
  assert.equal(value, lampFingerprint('aa:bb:cc:dd:ee:ff'));
  assert.doesNotMatch(value, /aa:bb|AA:BB/);
  assert.throws(() => lampFingerprint(''), /唯一身份/);
});

test('executes an allow-listed color and verifies real readback', async () => {
  let state = { onoff: 1, luminance: 22, rgb: 0xff0000, temperature: 50, capacity: 5 };
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body), method = body.header.method;
    if (method === 'SET' && body.header.namespace === 'Appliance.Control.Light') {
      state = { ...state, ...body.payload.light };
      return response({}, 'SET');
    }
    return response({ all: { system: { hardware: { type: 'msl430' } }, digest: { light: { channel: 0, ...state }, togglex: [{ channel: 0, onoff: state.onoff }] } } });
  };
  const controller = new MerossLocalController({ host: '192.168.1.94', fetchImpl });
  const result = await controller.execute({ color: 'pink', brightness: 35 });
  assert.equal(result.verified, true);
  assert.equal(result.state.brightness, 35);
  assert.equal(result.state.hue, 335);
});

test('rejects unknown actions and unsafe combinations', async () => {
  const controller = new MerossLocalController({ host: '192.168.1.94', fetchImpl: async () => response({}) });
  await assert.rejects(controller.execute({ firmware: 'update' }), /白名单/);
  await assert.rejects(controller.execute({ power: 'off', brightness: 20 }), /关灯/);
});

test('physical identification blinks twice and restores the exact prior state', async () => {
  let state = { onoff: 0, luminance: 37, rgb: 0x663399, temperature: 41, capacity: 5 };
  const powerWrites = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body), method = body.header.method;
    if (method === 'SET' && body.header.namespace === 'Appliance.Control.ToggleX') {
      state.onoff = body.payload.togglex.onoff;
      powerWrites.push(state.onoff);
      return response({}, 'SET');
    }
    if (method === 'SET' && body.header.namespace === 'Appliance.Control.Light') {
      state = { ...state, ...body.payload.light };
      return response({}, 'SET');
    }
    return response({ all: { system: { hardware: { type: 'msl430' } }, digest: { light: { channel: 0, ...state }, togglex: [{ channel: 0, onoff: state.onoff }] } } });
  };
  const controller = new MerossLocalController({ host: '192.168.1.94', fetchImpl });
  const result = await controller.identify();
  assert.deepEqual(powerWrites, [1, 0, 1, 0, 0]);
  assert.equal(result.identified, true);
  assert.equal(result.restored, true);
  assert.equal(result.state.power, false);
  assert.equal(result.state.brightness, 37);
  assert.equal(result.state.rgb, 0x663399);
});
