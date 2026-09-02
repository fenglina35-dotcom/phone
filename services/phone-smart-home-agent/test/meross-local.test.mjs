import assert from 'node:assert/strict';
import test from 'node:test';
import { MerossLocalController } from '../src/meross-local.mjs';

function response(payload, method = 'GET') {
  return { ok: true, async json() { return { header: { method: `${method}ACK` }, payload }; } };
}

test('rejects non-local addresses', () => {
  assert.throws(() => new MerossLocalController({ host: '8.8.8.8' }), /局域网/);
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
