import json,base64,hashlib,sys
from pathlib import Path
b=Path(sys.argv[1] if len(sys.argv)>1 else 'research/game2.bin').read_bytes()
if len(b) != 65536:
 raise ValueError('Expected an unpacked 64 KiB memory image')
ranges=[(0x0800,0x1e78),(0x1e78,0x2000),(0x2000,0x4000),(0x4000,0x7e80),(0x800c,0x8154),(0x8214,0x8e30),(0xa000,0xbf40),(0xc000,0xc4b0),(0xc9a9,0xc9b2),(0xc9c0,0xc9ca)]
segments=[{'address':a,'bytes':base64.b64encode(b[a:z]).decode()} for a,z in ranges]
Path('public/data/original.json').write_text(json.dumps({'source':'China Miner (1984), Ian Gray / Interceptor Software. Original game data and routines; third-party rights retained.','segments':segments},separators=(',',':')))
levels=[]
for i in range(30):
 m=b[0x1000+i*120:0x1000+(i+1)*120];a=int.from_bytes(m[108:110],'little');name=''.join(chr(c+64) if 1<=c<=26 else chr(c) if 32<=c<=126 else '' for c in b[0xc000+i*40:0xc000+(i+1)*40]).strip()
 levels.append({'number':i+1,'name':name.title().replace("'S","'s").replace("'T","'t"),'address':a,'map':list(b[a:a+800]),'metadata':list(m),'sha256':hashlib.sha256(b[a:a+800]).hexdigest()})
Path('public/data/levels.json').write_text(json.dumps(levels,separators=(',',':')))
from py65.devices.mpu6502 import MPU
Path('src/opcodes.js').write_text('// Legal NMOS 6502 opcode metadata.\nexport const OPCODES = '+json.dumps(MPU.disassemble)+';\nexport const CYCLES = '+json.dumps(MPU.cycletime)+';\nexport const EXTRA = '+json.dumps(MPU.extracycles)+';\n')
