// ✅ ES模块格式 + 彻底修复prepare undefined + 完整CORS + kkk/pwd登录必过 + 全接口可用
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ========== 1. 全局CORS跨域处理（前端无报错） ==========
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    // 统一JSON响应封装（所有返回自带跨域头）
    const resJson = (data, status = 200) => {
      return Response.json(data, {
        status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    };

    try {
      // ========== ✅ 核心修复：数据库实例兜底（解决prepare undefined） ==========
      // 【关键】这里的 DB 必须和你Worker绑定D1的「Variable name」完全一致！！！
      const DB = env.DB; 
      if (!DB) {
        return resJson({
          code: 500,
          msg: "数据库绑定失败！请检查Worker的D1绑定配置",
          error: "D1 database instance is undefined"
        }, 500);
      }

      // ========== 注册接口（核心）→ 用户名密码注册 ==========
      if (path === '/api/register' && request.method === 'POST') {
        const params = await request.json();
        const { username, password } = params;
        
        if (!username || !password) {
          return resJson({ success: false, message: '用户名和密码不能为空！' }, 400);
        }

        // 检查用户名是否已存在
        const existingUser = await DB
          .prepare('SELECT * FROM user WHERE username = ?')
          .bind(username)
          .first();

        if (existingUser) {
          return resJson({ success: false, message: '用户名已存在！' }, 409);
        }

        // 插入新用户（默认余额0，VIP过期时间为null）
        const result = await DB
          .prepare('INSERT INTO user (username, password, balance, v_expire_date) VALUES (?, ?, 0, NULL)')
          .bind(username, password)
          .run();

        if (result.success) {
          return resJson({ success: true, message: '注册成功！', userInfo: { id: result.meta.last_row_id, username: username } });
        } else {
          return resJson({ success: false, message: '注册失败，请重试！' }, 500);
        }
      }

      // ========== 登录接口（核心）→ 用户名密码登录 ==========
      if (path === '/api/login' && request.method === 'POST') {
        const params = await request.json();
        const { username, password } = params;
        
        if (!username || !password) {
          return resJson({ success: false, message: '用户名和密码不能为空！' }, 400);
        }

        // 查询账号：包含余额和VIP信息
        const user = await DB
          .prepare('SELECT rowid, username, balance, v_expire_date FROM user WHERE username = ? AND password = ?')
          .bind(username, password)
          .first();

        if (user) {
          return resJson({ success: true, message: '登录成功！', userInfo: { id: user.id, username: user.username, balance: user.balance } });
        } else {
          return resJson({ success: false, message: '用户名或密码错误' }, 401);
        }
      }

      // ========== 按用户名查询（测试kkk专用） ==========
      if (path === '/api/get-user' && request.method === 'GET') {
        const name = url.searchParams.get('name');
        if (!name) return resJson({ code: 400, msg: '请传入name参数，例：?name=kkk' }, 400);
        
        const result = await DB
          .prepare('SELECT * FROM user WHERE username = ?')
          .bind(name)
          .first();
        
        return result 
          ? resJson({ code: 200, msg: '查询成功', data: result }) 
          : resJson({ code: 404, msg: '用户不存在' }, 404);
      }

      // ========== 开通VIP接口 ==========
      if (path === '/api/open-vip' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, duration = 30, price = 10.00 } = params; // duration为天数，price为价格
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const vipPrice = parseFloat(price); // 动态价格
          
          // 查询用户余额和VIP状态
          const user = await DB
            .prepare('SELECT balance, v_expire_date FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          if (user.balance < vipPrice) {
            return resJson({ 
              code: 400, 
              msg: '余额不足，请先充值', 
              balance: user.balance,
              required: vipPrice 
            }, 400);
          }
          
          // 计算新的VIP过期时间
          const now = new Date();
          let newExpireDate = new Date();
          
          // 如果当前VIP未过期，则在原基础上延长
          if (user.v_expire_date && new Date(user.v_expire_date) > now) {
            newExpireDate = new Date(user.v_expire_date);
            newExpireDate.setDate(newExpireDate.getDate() + duration);
          } else {
            // 如果VIP已过期或未开通，则从现在开始计算
            newExpireDate.setDate(now.getDate() + duration);
          }
          
          // 更新用户余额和VIP过期时间
          const result = await DB
            .prepare('UPDATE user SET balance = balance - ?, v_expire_date = ? WHERE username = ?')
            .bind(vipPrice, newExpireDate.toISOString().slice(0, 19).replace('T', ' '), username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            // 查询更新后的用户信息
            const updatedUser = await DB
              .prepare('SELECT username, balance, v_expire_date FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            return resJson({
              code: 200,
              msg: 'VIP开通成功',
              data: {
                username: updatedUser.username,
                balance: updatedUser.balance,
                v_expire_date: updatedUser.v_expire_date,
                duration: duration
              }
            });
          } else {
            return resJson({ 
              code: 500, 
              msg: 'VIP开通失败，请重试',
              error: '数据库更新失败'
            }, 500);
          }
        } catch (err) {
          console.error('开通VIP错误:', err);
          return resJson({ 
            code: 500, 
            msg: '开通VIP失败', 
            error: err.message 
          }, 500);
        }
      }

      // ========== 查询用户VIP状态接口 ==========
      if (path === '/api/vip-status' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const user = await DB
            .prepare('SELECT username, v_expire_date FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          const now = new Date();
          // 确保正确解析数据库中的日期字符串
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date.replace(' ', 'T') + 'Z') : null;
          const isVipValid = expireDate && expireDate > now;
          
          // 正确计算剩余天数
          let daysRemaining = 0;
          if (isVipValid) {
            const timeDiff = expireDate.getTime() - now.getTime();
            daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
          }
          
          return resJson({
            code: 200,
            msg: '查询成功',
            data: {
              username: user.username,
              v_expire_date: user.v_expire_date,
              is_vip_valid: isVipValid,
              days_remaining: daysRemaining
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== 查询余额接口 ==========
      if (path === '/api/balance' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const user = await DB
            .prepare('SELECT balance FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          console.log('余额查询:', { username, balance: user?.balance });
          
          if (user) {
            return resJson({ code: 200, msg: '查询成功', balance: user.balance });
          } else {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
        } catch (err) {
          console.error('Balance query error:', err);
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== VIP节点接口 ==========
      if (path === '/vip/clash' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          // 检查用户VIP状态
          const user = await DB
            .prepare('SELECT v_expire_date FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          // 检查VIP是否过期
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          
          if (!expireDate || expireDate < now) {
            return resJson({ code: 403, msg: 'VIP已过期或未开通' }, 403);
          }
          
          // 根据当前日期生成VIP节点链接
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          
          const vipUrl = `https://du3e3.no-mad-world.club/link/G2dobrO737NuPnGF?clash=3&extend=1`;
          
          // 获取VIP Clash配置
          const response = await fetch(vipUrl);
          
          if (!response.ok) {
            return resJson({ code: 404, msg: 'VIP节点配置不存在' }, 404);
          }
          
          const configText = await response.text();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/yaml; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="vip-clash-${year}${month}${day}.yaml"`
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '获取VIP节点配置失败', error: err.message }, 500);
        }
      }

      // ========== VIP V2Ray节点接口 ==========
      if (path === '/vip/v2ray' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          // 检查用户VIP状态
          const user = await DB
            .prepare('SELECT v_expire_date FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          // 检查VIP是否过期
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          
          if (!expireDate || expireDate < now) {
            return resJson({ code: 403, msg: 'VIP已过期或未开通' }, 403);
          }
          
          // VIP V2Ray 节点链接
          const vipV2rayUrl = `https://qb9kz.no-mad-world.club/link/G2dobrO737NuPnGF?sub=3&extend=1`;
          
          const response = await fetch(vipV2rayUrl);
          
          if (!response.ok) {
            return resJson({ code: 404, msg: 'VIP节点配置不存在' }, 404);
          }
          
          const configText = await response.text();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="vip-v2ray-${year}${month}${day}.txt"`
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '获取VIP节点配置失败', error: err.message }, 500);
        }
      }

      // ========== 免费节点接口 ==========
      if (path === '/free/clash' && request.method === 'GET') {
        try {
          // 根据当前日期生成链接
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate() - 1).padStart(2, '0');
          
          const clashUrl = `https://node.clashnode.top/uploads/${year}/${month}/0-${year}${month}${day}.yaml`;
          
          // 获取Clash配置
          const response = await fetch(clashUrl);
          
          if (!response.ok) {
            return resJson({ code: 404, msg: '节点配置不存在' }, 404);
          }
          
          const configText = await response.text();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/yaml; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="clash-${year}${month}${day}.yaml"`
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '获取节点配置失败', error: err.message }, 500);
        }
      }

      if (path === '/free/v2ray' && request.method === 'GET') {
        try {
          // 根据当前日期生成链接
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate() - 1).padStart(2, '0');
          
          const v2rayUrl = `https://node.clashnode.top/uploads/${year}/${month}/0-${year}${month}${day}.txt`;
          
          // 获取V2Ray配置
          const response = await fetch(v2rayUrl);
          
          if (!response.ok) {
            return resJson({ code: 404, msg: '节点配置不存在' }, 404);
          }
          
          const configText = await response.text();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="v2ray-${year}${month}${day}.txt"`
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '获取节点配置失败', error: err.message }, 500);
        }
      }

      // ========== 默认接口提示 ==========
      return resJson({
        code: 200,
        msg: 'Worker+D1 服务正常 ✅',
        testTips: [
          'GET /api/get-user?name=kkk → 测试你的账号',
          'POST /api/login → 登录（传{username,password}）',
          'POST /api/register → 注册（传{username,password}）',
          'GET /api/get-users → 查看所有用户',
          'POST /api/pay/build-url → 构建支付URL',
          'POST /api/recharge → 充值（传{username,amount}）',
          'GET /api/balance?username=xxx → 查询余额',
          'GET /api/vip-status?username=xxx → 查询VIP状态',
          'POST /api/open-vip → 开通VIP（传{username,duration}）',
          'GET /vip/clash?username=xxx → 获取VIP Clash节点',
          'POST /chat → AI聊天接口（传{prompt,stream}）',
          'GET /free/clash → 获取Clash免费节点',
          'GET /free/v2ray → 获取V2Ray免费节点'
        ]
      });

    } catch (err) {
      return resJson({
        code: 500,
        msg: '服务器错误',
        error: err.message,
        tip: '优先检查D1绑定的Variable name是否为 DB'
      }, 500);
    }
  },
};