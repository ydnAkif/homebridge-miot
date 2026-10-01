const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  let target = 0, writes = [], fail = false;
  const device = { targetHumidityMinVal: () => 40, targetHumidityMaxVal: () => 70, targetHumidityStepVal: () => 5,
    getTargetHumidity: () => target, setTargetHumidity: async x => { if (fail) throw Error('device rejected'); writes.push(x); } };
  class BaseAccessory { constructor() {} }
  class HapStatusError extends Error { constructor(code) { super(String(code)); this.hapStatus = code; } }
  const sandbox = { module: { exports: {} }, require: name => name.includes('BaseAccessory') ? BaseAccessory : {} };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../lib/modules/dehumidifier/DehumidifierAccessory.js', 'utf8'), sandbox);
  const accessory = new sandbox.module.exports('test', device, 'uuid', {}, { hap: { HapStatusError, HAPStatus: { INVALID_VALUE_IN_REQUEST: -70410, SERVICE_COMMUNICATION_FAILURE: -70402 } } }, {});
  accessory.getDevice = () => device;
  accessory.isMiotDeviceConnected = () => true;
  return { accessory, writes, setTarget: x => { target = x; }, failWrite: () => { fail = true; } };
}

test('invalid or unavailable target never becomes a HomeKit value outside the device range', () => {
  const f = fixture();
  assert.equal(f.accessory.getRelativeHumidityHumidifierThreshold(), 40);
  f.setTarget(55);
  assert.equal(f.accessory.getRelativeHumidityHumidifierThreshold(), 55);
  f.setTarget(NaN);
  assert.equal(f.accessory.getRelativeHumidityHumidifierThreshold(), 55);
  assert.deepEqual(f.writes, []);
});

test('writes reject invalid targets, await the device and propagate device errors', async () => {
  const f = fixture();
  for (const value of [0, 80, 42, NaN]) await assert.rejects(f.accessory.setRelativeHumidityHumidifierThreshold(value), e => e.hapStatus === -70410);
  assert.deepEqual(f.writes, []);
  await f.accessory.setRelativeHumidityHumidifierThreshold(55);
  assert.deepEqual(f.writes, [55]);
  f.failWrite();
  await assert.rejects(f.accessory.setRelativeHumidityHumidifierThreshold(60), /device rejected/);
});
