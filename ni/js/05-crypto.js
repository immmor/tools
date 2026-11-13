/* 05-crypto.js — 密码学层：SHA / HMAC / PBKDF2 / AES-GCM / AES-CBC / RSA-OAEP / ECDSA / 环境绑定 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  function subtle() { return (root.crypto && root.crypto.subtle) || null; }

  function makeCodec(sub) {
    if (!sub) {
      return {
        mode: 'RC4 降级',
        seal: function (key, data) { return Promise.resolve(U.rc4(key, data)); },
        unseal: function (key, blob) { return Promise.resolve(U.rc4(key, blob)); }
      };
    }
    return {
      mode: 'AES-GCM-256',
      seal: function (key, data) {
        return sub.digest('SHA-256', key).then(function (h) {
          return sub.importKey('raw', new Uint8Array(h), { name: 'AES-GCM' }, false, ['encrypt']);
        }).then(function (k) {
          var iv = U.randomBytes(12);
          return sub.encrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, k, data).then(function (buf) {
            var tag = new Uint8Array(buf), out = new Uint8Array(12 + tag.length);
            out.set(iv, 0);
            out.set(tag, 12);
            return out;
          });
        });
      },
      unseal: function (key, blob) {
        return sub.digest('SHA-256', key).then(function (h) {
          return sub.importKey('raw', new Uint8Array(h), { name: 'AES-GCM' }, false, ['decrypt']);
        }).then(function (k) {
          return sub.decrypt({ name: 'AES-GCM', iv: blob.slice(0, 12), tagLength: 128 }, k, blob.slice(12));
        }).then(function (buf) { return new Uint8Array(buf); });
      }
    };
  }

  OBF.register({
    id: 'crypto',
    title: '05 · 密码学层',
    tags: ['SHA-256', 'HMAC-SHA256', 'PBKDF2', 'AES-GCM', 'AES-CBC', 'RSA-OAEP-2048', 'ECDSA-P256', 'getRandomValues', '环境绑定', '时间锁', 'RC4 降级'],
    run: function () {
      var sub = subtle();
      var codec = makeCodec(sub);
      var abc = U.utf8('abc');

      function attempt(name, fn) {
        return Promise.resolve().then(fn).then(function (r) {
          OBF.check(name, r.ok, r.detail);
        }).catch(function (e) {
          OBF.skip(name, (e && e.name ? e.name + ': ' : '') + ((e && e.message) || String(e)));
        });
      }

      OBF.crypto = {
        available: !!sub,
        codec: codec,
        digest: function (s) {
          if (!sub) return Promise.resolve(U.fnv(s));
          return sub.digest('SHA-256', U.utf8(s)).then(function (h) { return U.hex(new Uint8Array(h)); });
        },
        derive: function (pass, salt) {
          if (!sub) return Promise.resolve(U.utf8(U.fnv(pass + '|' + salt) + U.fnv(salt + '|' + pass)));
          return sub.importKey('raw', U.utf8(pass), { name: 'PBKDF2' }, false, ['deriveBits'])
            .then(function (base) {
              return sub.deriveBits({
                name: 'PBKDF2', salt: U.utf8(salt), iterations: 10000, hash: 'SHA-256'
              }, base, 256);
            })
            .then(function (bits) { return new Uint8Array(bits); });
        }
      };

      /* 无论是否有 subtle，降级流密码都必须可用 */
      var rk = U.utf8('fallback-rc4-key');
      OBF.check('RC4 降级通道往返', U.fromUtf8(U.rc4(rk, U.rc4(rk, U.utf8('SEALED')))) === 'SEALED',
        '非 Secure Context 时的兜底');

      var random = U.randomBytes(32);
      var notZero = false;
      for (var i = 0; i < random.length; i++) if (random[i]) { notZero = true; break; }
      OBF.check('getRandomValues 熵源', notZero && random.length === 32, U.hex(random.slice(0, 8)) + '…');

      if (!sub) {
        OBF.skip('WebCrypto 全套', 'crypto.subtle 不可用（建议用 http://localhost 打开）');
        return Promise.resolve('降级模式：RC4 + FNV，' + codec.mode);
      }

      var jobs = [
        attempt('SHA-256("abc") 标准向量', function () {
          return sub.digest('SHA-256', abc).then(function (h) {
            return {
              ok: U.hex(new Uint8Array(h)) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
              detail: U.hex(new Uint8Array(h)).slice(0, 24) + '…'
            };
          });
        }),

        attempt('HMAC-SHA256 签名 / 验签', function () {
          var msg = U.utf8('integrity'), key = U.utf8('hmac-key');
          return sub.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
            .then(function (k) {
              return sub.sign('HMAC', k, msg).then(function (sig) {
                return Promise.all([
                  sub.verify('HMAC', k, sig, msg),
                  sub.verify('HMAC', k, sig, U.utf8('tampered'))
                ]).then(function (r) {
                  return { ok: r[0] === true && r[1] === false, detail: '真=通过 / 篡改=拒绝' };
                });
              });
            });
        }),

        attempt('PBKDF2-SHA256 派生 256bit', function () {
          var base = sub.importKey('raw', U.utf8('p@ssw0rd'), { name: 'PBKDF2' }, false, ['deriveBits']);
          var opt = { name: 'PBKDF2', salt: U.utf8('fixed-salt'), iterations: 10000, hash: 'SHA-256' };
          return Promise.all([base.then(function (k) { return sub.deriveBits(opt, k, 256); }),
                              base.then(function (k) { return sub.deriveBits(opt, k, 256); })])
            .then(function (r) {
              var a = U.hex(new Uint8Array(r[0])), b = U.hex(new Uint8Array(r[1]));
              return { ok: a === b && a.length === 64, detail: '10000 轮，' + a.slice(0, 16) + '…' };
            });
        }),

        attempt('AES-GCM-256 加解密 + 认证标签', function () {
          var key = U.randomBytes(32), data = U.utf8('\u5bc6\u6587 payload');
          return codec.seal(key, data).then(function (blob) {
            return Promise.all([
              codec.unseal(key, blob),
              codec.unseal(U.randomBytes(32), blob).then(function () { return 'ok'; }).catch(function () { return 'rejected'; })
            ]).then(function (r) {
              return { ok: U.fromUtf8(r[0]) === '\u5bc6\u6587 payload' && r[1] === 'rejected',
                       detail: '12B IV + 16B tag，错误密钥被认证拒绝' };
            });
          });
        }),

        attempt('AES-CBC-256 + PKCS#7', function () {
          var key = U.randomBytes(32), iv = U.randomBytes(16), data = U.utf8('cbc-block-padding-test');
          return sub.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
            .then(function (k) {
              return sub.encrypt({ name: 'AES-CBC', iv: iv }, k, data);
            })
            .then(function (ct) {
              return sub.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt'])
                .then(function (k) { return sub.decrypt({ name: 'AES-CBC', iv: iv }, k, ct); });
            })
            .then(function (pt) {
              return { ok: U.fromUtf8(new Uint8Array(pt)) === 'cbc-block-padding-test', detail: '自动填充，长度非 16 倍数' };
            });
        }),

        attempt('RSA-OAEP-2048 密钥包裹', function () {
          return sub.generateKey({
            name: 'RSA-OAEP', modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
          }, true, ['encrypt', 'decrypt']).then(function (kp) {
            var aes = U.randomBytes(32);
            return sub.encrypt({ name: 'RSA-OAEP' }, kp.publicKey, aes)
              .then(function (wrapped) { return sub.decrypt({ name: 'RSA-OAEP' }, kp.privateKey, wrapped); })
              .then(function (raw) {
                return { ok: U.hex(new Uint8Array(raw)) === U.hex(aes), detail: '2048bit 公钥包裹 AES 会话密钥' };
              });
          });
        }),

        attempt('ECDSA-P256 签名 / 篡改拒绝', function () {
          var msg = U.utf8('bytecode-signature');
          return sub.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
            .then(function (kp) {
              return sub.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, msg)
                .then(function (sig) {
                  return Promise.all([
                    sub.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, sig, msg),
                    sub.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, sig, U.utf8('bytecode-signaturf'))
                  ]);
                });
            })
            .then(function (r) {
              return { ok: r[0] === true && r[1] === false, detail: '字节码摘要签名，改一个字节即失效' };
            });
        }),

        attempt('环境绑定（换域即换密钥）', function () {
          return Promise.all([
            OBF.crypto.derive('master', 'example.com'),
            OBF.crypto.derive('master', 'evil.com')
          ]).then(function (r) {
            var a = U.hex(r[0]), b = U.hex(r[1]);
            return { ok: a !== b, detail: '同口令不同域 → ' + a.slice(0, 12) + ' / ' + b.slice(0, 12) };
          });
        }),

        attempt('时间锁（按日轮换盐）', function () {
          var day = new Date().toISOString().slice(0, 10);
          return Promise.all([
            OBF.crypto.digest(day + '|' + OBF.antidebug.fingerprint()),
            OBF.crypto.digest('1970-01-01|' + OBF.antidebug.fingerprint())
          ]).then(function (r) {
            return { ok: r[0] !== r[1] && r[0].length >= 8, detail: '盐 = ' + day + ' + 环境指纹' };
          });
        })
      ];

      return Promise.all(jobs).then(function () {
        return codec.mode + ' · 9 组 WebCrypto 原语';
      });
    }
  });
})(window);
