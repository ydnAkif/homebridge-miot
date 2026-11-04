# 2026-10-01 dehumidifier stability fix

Invalid or missing target humidity keeps the last valid reading, falling back to the device minimum. HomeKit receives the value before characteristic range validation. Reading a target never writes a physical setting. Setters validate range and step, await the device and propagate write failures.

Run `node --test stability-tests/dehumidifier.test.cjs`. This file is also the exact runtime override tested with homebridge-miot 2.0.0 on the Pi. The private homebridge-recovery manifest pins that base version and this override; the fork retains its original package version. No credentials are stored here.

## 2026-11-04 update

Merged official 2.1.0 source (2186f61f2081ec1a51c0388e3072b79741aebb0a), preserving range/step validation and awaited humidity writes. New compressor telemetry and synchronization guards remain enabled. Getter retains last valid target without writing physical settings. Version: 2.1.1-ydnakif.1.
