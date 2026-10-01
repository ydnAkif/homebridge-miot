let Service, Characteristic, Accessory, HapStatusError, HAPStatus;
const BaseAccessory = require('../../base/BaseAccessory.js');
const Constants = require('../../constants/Constants.js');
const DevTypes = require('../../constants/DevTypes.js');


class DehumidifierAccessory extends BaseAccessory {
  constructor(name, device, uuid, config, api, logger) {

    Service = api.hap.Service;
    Characteristic = api.hap.Characteristic;
    Accessory = api.platformAccessory;
    HapStatusError = api.hap.HapStatusError;
    HAPStatus = api.hap.HAPStatus;

    super(name, device, uuid, config, api, logger);
  }


  /*----------========== INIT ==========----------*/

  initAccessoryObject() {
    this.fanLevelControl = this.getConfigValue('fanLevelControl', false);

    super.initAccessoryObject();
  }


  /*----------========== ACCESSORY INFO ==========----------*/

  getAccessoryType() {
    return DevTypes.DEHUMIDIFIER;
  }


  /*----------========== INIT ACCESSORIES ==========----------*/

  initAccessories(name, uuid) {
    return [new Accessory(name, uuid, this.api.hap.Categories.AIR_DEHUMIDIFIER)];
  }


  /*----------========== SETUP SERVICES ==========----------*/

  setupMainAccessoryService() {
    this.dehumidifierService = new Service.HumidifierDehumidifier(this.getName(), 'dehumidifierService');

    this.dehumidifierService.getCharacteristic(Characteristic.Active)
      .onGet(this.getDehumidifierActiveState.bind(this))
      .onSet(this.setDehumidifierActiveState.bind(this));

    this.dehumidifierService
      .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
      .onGet(this.getCurrentHumidifierDehumidifierState.bind(this))
      .setProps({
        validValues: [
          Characteristic.CurrentHumidifierDehumidifierState.INACTIVE,
          Characteristic.CurrentHumidifierDehumidifierState.IDLE,
          Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING,
        ],
      });

    this.dehumidifierService
      .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
      .onGet(this.getTargetHumidifierDehumidifierState.bind(this))
      .onSet(this.setTargetHumidifierDehumidifierState.bind(this))
      .setProps({
        validValues: [
          Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER
        ],
      });

    this.dehumidifierService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));

    this.dehumidifierService
      .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
      .onGet(this.getRelativeHumidityHumidifierThreshold.bind(this))
      .onSet(this.setRelativeHumidityHumidifierThreshold.bind(this))
      .updateValue(this.getRelativeHumidityHumidifierThreshold())
      .setProps({
        minValue: this.getDevice().targetHumidityMinVal(),
        maxValue: this.getDevice().targetHumidityMaxVal(),
        minStep: this.getDevice().targetHumidityStepVal()
      });

    this.addLockPhysicalControlsCharacteristic(this.dehumidifierService);

    this.addAccessoryService(this.dehumidifierService);
  }

  setupAdditionalAccessoryServices() {
    if (this.fanLevelControl) this.prepareFanLevelControlServices();

    super.setupAdditionalAccessoryServices(); // make sure we call super
  }


  /*----------========== CREATE ADDITIONAL SERVICES ==========----------*/


  /*----------========== HOMEBRIDGE STATE SETTERS/GETTERS ==========----------*/

  getDehumidifierActiveState() {
    if (this.isMiotDeviceConnected()) {
      return this.getDevice().isOn() ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    }
    return Characteristic.Active.INACTIVE;
  }

  setDehumidifierActiveState(state) {
    if (this.isMiotDeviceConnected()) {
      let value = state === Characteristic.Active.ACTIVE;
      this.getDevice().setOn(value);
    } else {
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  getCurrentHumidifierDehumidifierState() {
    if (this.isMiotDeviceConnected()) {
      return this.getDevice().isDehumidifying() ? Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING : Characteristic.CurrentHumidifierDehumidifierState.IDLE;
    }
    return Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
  }


  getTargetHumidifierDehumidifierState() {
    return Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER;
  }

  setTargetHumidifierDehumidifierState(state) {
    if (this.isMiotDeviceConnected()) {
      this.getDevice().turnOnIfNecessary(); // start dehumidifying
    } else {
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  getRelativeHumidityHumidifierThreshold() {
    const device = this.getDevice();
    const min = device.targetHumidityMinVal();
    const max = device.targetHumidityMaxVal();
    if (this.isMiotDeviceConnected()) {
      const value = device.getTargetHumidity();
      if (Number.isFinite(value) && value >= min && value <= max) {
        this.lastValidTargetHumidity = value;
        return value;
      }
    }
    return Number.isFinite(this.lastValidTargetHumidity) && this.lastValidTargetHumidity >= min && this.lastValidTargetHumidity <= max
      ? this.lastValidTargetHumidity : min;
  }

  async setRelativeHumidityHumidifierThreshold(hum) {
    if (this.isMiotDeviceConnected()) {
      const device = this.getDevice();
      const min = device.targetHumidityMinVal(), max = device.targetHumidityMaxVal(), step = device.targetHumidityStepVal();
      if (!Number.isFinite(hum) || hum < min || hum > max ||
        (step > 0 && Math.abs((hum - min) / step - Math.round((hum - min) / step)) > 1e-6)) {
        throw new HapStatusError(HAPStatus.INVALID_VALUE_IN_REQUEST);
      }
      await device.setTargetHumidity(hum);
      this.lastValidTargetHumidity = hum;
    } else {
      throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }


  // ----- additional services


  /*----------========== STATUS ==========----------*/

  updateAccessoryStatus() {
    if (this.dehumidifierService) this.dehumidifierService.getCharacteristic(Characteristic.Active).updateValue(this.getDehumidifierActiveState());
    if (this.dehumidifierService) this.dehumidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.getCurrentHumidifierDehumidifierState());
    if (this.dehumidifierService) this.dehumidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState).updateValue(this.getTargetHumidifierDehumidifierState());
    if (this.dehumidifierService) this.dehumidifierService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.getCurrentRelativeHumidity());
    if (this.dehumidifierService) this.dehumidifierService.getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold).updateValue(this.getRelativeHumidityHumidifierThreshold());

    super.updateAccessoryStatus();
  }


  /*----------========== MULTI-SWITCH SERVICE HELPERS ==========----------*/


  /*----------========== GETTERS ==========----------*/


  /*----------========== PROPERTY WRAPPERS ==========----------*/


  /*----------========== PROPERTY HELPERS ==========----------*/


  /*----------========== HELPERS ==========----------*/


}


module.exports = DehumidifierAccessory;
