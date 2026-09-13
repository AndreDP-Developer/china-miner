import base64
import json
from pathlib import Path
from py65.devices.mpu6502 import MPU

# py65 currently lists DEC abs as 3 cycles; NMOS 6502 takes 6.
MPU.cycletime[0xce] = 6
ram = [0] * 65536
for segment in json.loads(Path('public/data/original.json').read_text())['segments']:
    block = base64.b64decode(segment['bytes'])
    ram[segment['address']:segment['address'] + len(block)] = block
cpu = MPU(memory=ram, pc=0x8248)
cpu.p = 0x20
cpu.sp = 255
for address, value in {0xc5:64, 0xd018:0x12, 0xd016:0xd8, 0xd022:1, 0xd023:8, 0x3df:5}.items():
    ram[address] = value

def run(initial=False):
    for instruction in range(2000000):
        if cpu.pc == 0x82c0 and (initial or instruction > 0):
            return
        cpu.step()
    raise RuntimeError(f'Unexpected loop at {cpu.pc:04x}')

run(True)
trace = []
for tick in range(100):
    controls = 4 if tick < 8 else 0
    ram[0xdc00] = 255 ^ controls
    ram[0xd01e] = 0
    run()
    trace.append({'input': controls, 'cpu': {key:getattr(cpu,key) for key in ['pc','a','x','y','p','sp']}, 'cycles':cpu.processorCycles, 'memory':base64.b64encode(bytes(ram[:2048])).decode()})
Path('tests/reference-trace.json').write_text(json.dumps(trace, separators=(',', ':')))
print('Generated 100 independent reference ticks.')
