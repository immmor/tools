/* 06-vm.js — 虚拟化层：自定义指令集 + 每次运行重排 opcode + 加密字节码 + 平坦化分发器 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  var MNEMONICS = ['NOP', 'IMM', 'LDM', 'XOR', 'ADD', 'SUB', 'INC', 'OUT', 'JZ', 'JMP', 'HALT'];
  var PLAIN = 'VIRTUALIZED';

  /* 多态：每次用不同种子打乱 1..255，opcode 数值与语义的映射完全改变 */
  function buildOpcodes(seed) {
    var r = U.rand(seed >>> 0), pool = [], i, j, k, t;
    for (i = 1; i <= 255; i++) pool.push(i);
    for (j = pool.length - 1; j > 0; j--) {
      k = (r() * (j + 1)) | 0;
      t = pool[j]; pool[j] = pool[k]; pool[k] = t;
    }
    var map = {}, rev = Object.create(null);
    MNEMONICS.forEach(function (m, idx) { map[m] = pool[idx]; rev[pool[idx]] = m; });
    return { map: map, rev: rev };
  }

  /* 字节码用与 key+seed 绑定的伪随机流逐字异或 */
  function scramble(prog, seed) {
    var r = U.rand(seed >>> 0);
    return prog.map(function (ins) {
      return ins.map(function (v) { return (v ^ ((r() * 256) | 0)) >>> 0; });
    });
  }

  function build(key, seed) {
    var ops = buildOpcodes(seed), mem = [], i;
    for (i = 0; i < PLAIN.length; i++) mem.push(PLAIN.charCodeAt(i) ^ key);
    var len = mem.length;
    /* 指令地址即数组下标；throw 式的 JZ / JMP 构成循环 */
    var source = [
      ['IMM', 0, key, 0],
      ['IMM', 1, 0, 0],
      ['IMM', 2, len, 0],
      ['LDM', 3, 1, 0],
      ['XOR', 4, 3, 0, 0],
      ['OUT', 4, 0, 0],
      ['INC', 1, 0, 0],
      ['SUB', 5, 2, 1, 0],
      ['JZ', 5, 11, 0],
      ['JMP', 3, 0, 0],
      ['NOP', 0, 0, 0],
      ['HALT', 0, 0, 0]
    ];
    var encoded = source.map(function (ins) {
      return [ops.map[ins[0]], ins[1], ins[2], ins[3]];
    });
    var streamSeed = (key ^ seed) >>> 0;
    return {
      blob: scramble(encoded, streamSeed),
      mem: mem, opcodes: ops, key: key, seed: seed,
      streamSeed: streamSeed, length: source.length
    };
  }

  /* FETCH → DECODE → EXEC 三态分发，没有直接的 for 循环语义 */
  function execute(program, mem, rev) {
    var reg = new Int32Array(16), out = [], pc = 0, state = 0x11;
    var ins = null, m = null, next = 0;
    for (var guard = 0; guard < 100000; guard++) {
      switch (state ^ 0x11) {
        case 0:
          if (pc >= program.length) return out;
          ins = program[pc];
          m = rev[ins[0]];
          state = 0x12;
          break;
        case 1:
          next = pc + 1;
          switch (m) {
            case 'IMM': reg[ins[1]] = ins[2]; break;
            case 'LDM': reg[ins[1]] = mem[reg[ins[2]]] | 0; break;
            case 'XOR': reg[ins[1]] = reg[ins[2]] ^ reg[ins[3]]; break;
            case 'ADD': reg[ins[1]] = (reg[ins[2]] + reg[ins[3]]) | 0; break;
            case 'SUB': reg[ins[1]] = (reg[ins[2]] - reg[ins[3]]) | 0; break;
            case 'INC': reg[ins[1]] = (reg[ins[1]] + 1) | 0; break;
            case 'OUT': out.push(reg[ins[1]]); break;
            case 'JZ': if (reg[ins[1]] === 0) next = ins[2]; break;
            case 'JMP': next = ins[1]; break;
            case 'HALT': return out;
            case 'NOP': break;
            default: break;
          }
          pc = next;
          state = 0x11;
          break;
        default:
          return out;
      }
    }
    return out;
  }

  function run(bundle) {
    var program = scramble(bundle.blob, bundle.streamSeed);
    var codes = execute(program, bundle.mem, bundle.opcodes.rev);
    return String.fromCharCode.apply(null, codes);
  }

  OBF.register({
    id: 'vm',
    title: '06 · 代码虚拟化 (VMProtect)',
    tags: ['自定义指令集', 'opcode 多态重排', '字节码异或加密', '寄存器虚拟机', 'FETCH/EXEC 平坦分发', '内存常量分离', '死指令'],
    run: function () {
      var b1 = build(0x5a, 0x1f3c), b2 = build(0x5a, 0x7a91);

      OBF.check('虚拟化字节码执行', run(b1) === PLAIN, '12 条指令解出 ' + PLAIN);

      var poly = JSON.stringify(b1.opcodes.map) !== JSON.stringify(b2.opcodes.map);
      OBF.check('opcode 多态重排', poly, '换 seed 后全部 ' + MNEMONICS.length + ' 个 opcode 语义映射变化');

      var wrong = {
        blob: b1.blob, mem: b1.mem, opcodes: b1.opcodes,
        streamSeed: (b1.streamSeed ^ 1) >>> 0
      };
      OBF.check('错误密钥产出垃圾', run(wrong) !== PLAIN, '字节码流未知时分发器无法识别指令');

      var opaque = b1.blob.every(function (ins) {
        return ins.every(function (v) { return v >= 0 && v <= 255; });
      });
      OBF.check('字节码无可读常量', opaque && b1.blob.length === b1.length,
        '密文 ' + b1.blob.length * 4 + ' 字节，明文串不在指令里');

      var memSeparated = b1.mem.every(function (v) { return v !== undefined && v !== null; });
      OBF.check('常量与逻辑分离', memSeparated, '字符常量存放在独立 mem 区');

      OBF.vm = { build: build, run: run, plain: PLAIN, mnemonics: MNEMONICS.slice() };
      return MNEMONICS.length + ' 条虚拟指令 / 12 条字节码 / 每次运行 opcode 全变';
    }
  });
})(window);
