// phanfun.js — 敏感字符串反明文 / XOR 还原（quick-login 等）
//
// 浏览器：在 index.html 主脚本之前用 <script src="phanfun.js"></script> 引入，
//         之后调用 window.PhanFun.qlEndpoint() 拿到 quick-login 接口地址。
// Node  ：node -e "console.log(require('./phanfun.js').genQlCipher('https://api.funbua.uk/api/quick-login-ticket'))"
//         把打印出的 base64 粘进下方 CIPHER 即可启用 XOR 层。
(function (root) {
    'use strict';

    const KEY = 'PHANTOM'; // XOR 密钥，改了记得重新 genQlCipher()

    // XOR + base64 还原
    function xorDecode(b64, key) {
        const raw = (root.atob || (s => Buffer.from(s, 'base64').toString('latin1')))(b64);
        let out = '';
        for (let i = 0; i < raw.length; i++) {
            out += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return out;
    }

    // quick-login 接口地址：CIPHER 非空走 XOR，否则回退反写明文（始终可跑）
    function qlEndpoint() {
        const CIPHER = ''; // 粘贴 node 生成的 base64 密文
        if (CIPHER) return xorDecode(CIPHER, KEY);
        const X = '/ipa/ku.aubnuf.ipa//:sptth'; // reverse("https://api.funbua.uk/api/")
        const Y = 'tekcit-nigol-kciuq';         // reverse("quick-login-ticket")
        return X.split('').reverse().join('') + Y.split('').reverse().join('');
    }

    // Node 端：生成 quick-login 的 XOR 密文（base64）。url 必填，明文不落库
    function genQlCipher(url) {
        if (!url) throw new Error('genQlCipher(url) 需要传入明文接口地址，明文不要写进本文件');
        let s = '';
        for (let i = 0; i < url.length; i++) {
            s += String.fromCharCode(url.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
        }
        return Buffer.from(s, 'latin1').toString('base64');
    }

    const PhanFun = { qlEndpoint, genQlCipher, xorDecode, KEY };
    if (typeof module !== 'undefined' && module.exports) module.exports = PhanFun;
    root.PhanFun = PhanFun;
    root._ql = qlEndpoint; // 兼容 index.html 现有 _ql() 调用
})(typeof window !== 'undefined' ? window : globalThis);
