# 2026-10-01 dehumidifier stability fix

Invalid or missing target humidity keeps the last valid reading, falling back to the device minimum. HomeKit receives the value before characteristic range validation. Reading a target never writes a physical setting. Setters validate range and step, await the device and propagate write failures.

Run `node --test stability-tests/dehumidifier.test.cjs`. This file is also the exact runtime override tested with homebridge-miot 2.0.0 on the Pi. The private homebridge-recovery manifest pins that base version and this override; the fork retains its original package version. No credentials are stored here.
