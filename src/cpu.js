import { OPCODES, CYCLES, EXTRA } from "./opcodes.js";

// A small NMOS 6502 interpreter. No ROM, OS, network, or host-code execution.
export class CPU {
  constructor(memory = new Uint8Array(65536)) {
    this.m = memory;
    this.a = this.x = this.y = 0;
    this.sp = 255;
    this.p = 0x20;
    this.pc = 0;
    this.cycles = 0;
    this.readHook = null;
  }
  read(a) {
    return this.readHook?.(a & 65535) ?? this.m[a & 65535];
  }
  byte() {
    const v = this.read(this.pc);
    this.pc = (this.pc + 1) & 65535;
    return v;
  }
  word() {
    const lo = this.byte();
    return lo | (this.byte() << 8);
  }
  nz(v) {
    v &= 255;
    this.p = (this.p & ~130) | (v ? 0 : 2) | (v & 128);
    return v;
  }
  flag(f, yes) {
    this.p = yes ? this.p | f : this.p & ~f;
  }
  push(v) {
    this.m[256 + this.sp] = v;
    this.sp = (this.sp - 1) & 255;
  }
  pop() {
    this.sp = (this.sp + 1) & 255;
    return this.m[256 + this.sp];
  }
  rts() {
    this.pc = ((this.pop() | (this.pop() << 8)) + 1) & 65535;
  }
  step() {
    const op = this.byte(),
      [name, mode] = OPCODES[op];
    let addr = 0,
      base = 0,
      v = 0,
      crossed = false;
    switch (mode) {
      case "imm":
        addr = this.pc;
        this.pc = (this.pc + 1) & 65535;
        break;
      case "zpg":
        addr = this.byte();
        break;
      case "zpx":
        addr = (this.byte() + this.x) & 255;
        break;
      case "zpy":
        addr = (this.byte() + this.y) & 255;
        break;
      case "abs":
        addr = this.word();
        break;
      case "abx":
        base = this.word();
        addr = (base + this.x) & 65535;
        crossed = (base & 0xff00) !== (addr & 0xff00);
        break;
      case "aby":
        base = this.word();
        addr = (base + this.y) & 65535;
        crossed = (base & 0xff00) !== (addr & 0xff00);
        break;
      case "inx":
        base = (this.byte() + this.x) & 255;
        addr = this.read(base) | (this.read((base + 1) & 255) << 8);
        break;
      case "iny":
        v = this.byte();
        base = this.read(v) | (this.read((v + 1) & 255) << 8);
        addr = (base + this.y) & 65535;
        crossed = (base & 0xff00) !== (addr & 0xff00);
        break;
      case "ind":
        base = this.word();
        addr =
          this.read(base) |
          (this.read((base & 0xff00) | ((base + 1) & 255)) << 8);
        break;
      case "rel":
        v = this.byte();
        addr = (this.pc + (v < 128 ? v : v - 256)) & 65535;
        break;
    }
    // py65's opcode metadata has a known typo for DEC absolute: NMOS takes six cycles.
    this.cycles += (op === 0xce ? 6 : CYCLES[op]) + (crossed ? EXTRA[op] : 0);
    const read = () => (mode === "acc" ? this.a : this.read(addr));
    const write = (value) => {
      value &= 255;
      if (mode === "acc") this.a = value;
      else this.m[addr] = value;
    };
    const branch = (yes) => {
      if (yes) {
        this.cycles += 1 + ((addr & 0xff00) !== (this.pc & 0xff00) ? 1 : 0);
        this.pc = addr;
      }
    };
    const compare = (r) => {
      v = r - read();
      this.flag(1, v >= 0);
      this.nz(v);
    };
    switch (name) {
      case "LDA":
        this.a = this.nz(read());
        break;
      case "LDX":
        this.x = this.nz(read());
        break;
      case "LDY":
        this.y = this.nz(read());
        break;
      case "STA":
        write(this.a);
        break;
      case "STX":
        write(this.x);
        break;
      case "STY":
        write(this.y);
        break;
      case "TAX":
        this.x = this.nz(this.a);
        break;
      case "TAY":
        this.y = this.nz(this.a);
        break;
      case "TXA":
        this.a = this.nz(this.x);
        break;
      case "TYA":
        this.a = this.nz(this.y);
        break;
      case "TSX":
        this.x = this.nz(this.sp);
        break;
      case "TXS":
        this.sp = this.x;
        break;
      case "PHA":
        this.push(this.a);
        break;
      case "PHP":
        this.push(this.p | 48);
        break;
      case "PLA":
        this.a = this.nz(this.pop());
        break;
      case "PLP":
        this.p = this.pop() | 32;
        break;
      case "AND":
        this.a = this.nz(this.a & read());
        break;
      case "ORA":
        this.a = this.nz(this.a | read());
        break;
      case "EOR":
        this.a = this.nz(this.a ^ read());
        break;
      case "BIT":
        v = read();
        this.p = (this.p & ~194) | (v & 192) | (v & this.a ? 0 : 2);
        break;
      case "ADC": {
        const b = read(),
          sum = this.a + b + (this.p & 1);
        this.flag(64, (~(this.a ^ b) & (this.a ^ sum) & 128) !== 0);
        // The game uses binary arithmetic; decimal support is kept for CPU tests.
        if (this.p & 8) {
          let lo = (this.a & 15) + (b & 15) + (this.p & 1);
          if (lo > 9) lo += 6;
          let hi = (this.a >> 4) + (b >> 4) + (lo > 15 ? 1 : 0);
          this.nz(sum);
          if (hi > 9) hi += 6;
          this.flag(1, hi > 15);
          this.a = ((hi << 4) | (lo & 15)) & 255;
        } else {
          this.flag(1, sum > 255);
          this.a = this.nz(sum);
        }
        break;
      }
      case "SBC": {
        const b = read(),
          borrow = 1 - (this.p & 1),
          diff = this.a - b - borrow;
        this.flag(64, ((this.a ^ b) & (this.a ^ diff) & 128) !== 0);
        if (this.p & 8) {
          let lo = (this.a & 15) - (b & 15) - borrow;
          let hi = (this.a >> 4) - (b >> 4);
          if (lo < 0) {
            lo -= 6;
            hi--;
          }
          if (hi < 0) hi -= 6;
          this.nz(diff);
          this.a = ((hi << 4) | (lo & 15)) & 255;
        } else this.a = this.nz(diff);
        this.flag(1, diff >= 0);
        break;
      }
      case "CMP":
        compare(this.a);
        break;
      case "CPX":
        compare(this.x);
        break;
      case "CPY":
        compare(this.y);
        break;
      case "INC":
        write(this.nz(read() + 1));
        break;
      case "DEC":
        write(this.nz(read() - 1));
        break;
      case "INX":
        this.x = this.nz(this.x + 1);
        break;
      case "INY":
        this.y = this.nz(this.y + 1);
        break;
      case "DEX":
        this.x = this.nz(this.x - 1);
        break;
      case "DEY":
        this.y = this.nz(this.y - 1);
        break;
      case "ASL":
        v = read();
        this.flag(1, v & 128);
        write(this.nz(v << 1));
        break;
      case "LSR":
        v = read();
        this.flag(1, v & 1);
        write(this.nz(v >> 1));
        break;
      case "ROL":
        v = read();
        {
          const c = this.p & 1;
          this.flag(1, v & 128);
          write(this.nz((v << 1) | c));
        }
        break;
      case "ROR":
        v = read();
        {
          const c = (this.p & 1) << 7;
          this.flag(1, v & 1);
          write(this.nz((v >> 1) | c));
        }
        break;
      case "JMP":
        this.pc = addr;
        break;
      case "JSR":
        this.push((this.pc - 1) >> 8);
        this.push(this.pc - 1);
        this.pc = addr;
        break;
      case "RTS":
        this.rts();
        break;
      case "RTI":
        this.p = this.pop() | 32;
        this.pc = this.pop() | (this.pop() << 8);
        break;
      case "BCC":
        branch(!(this.p & 1));
        break;
      case "BCS":
        branch(this.p & 1);
        break;
      case "BEQ":
        branch(this.p & 2);
        break;
      case "BNE":
        branch(!(this.p & 2));
        break;
      case "BMI":
        branch(this.p & 128);
        break;
      case "BPL":
        branch(!(this.p & 128));
        break;
      case "BVC":
        branch(!(this.p & 64));
        break;
      case "BVS":
        branch(this.p & 64);
        break;
      case "CLC":
        this.p &= ~1;
        break;
      case "SEC":
        this.p |= 1;
        break;
      case "CLI":
        this.p &= ~4;
        break;
      case "SEI":
        this.p |= 4;
        break;
      case "CLD":
        this.p &= ~8;
        break;
      case "SED":
        this.p |= 8;
        break;
      case "CLV":
        this.p &= ~64;
        break;
      case "NOP":
        break;
      default:
        throw new Error(
          `Unsupported opcode ${op.toString(16)} at ${(this.pc - 1).toString(16)}`,
        );
    }
  }
}
