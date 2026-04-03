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
        const { username, password, inviteCode } = params;
        
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

        // 生成唯一的6位邀请码（字母+数字）
        const generateInviteCode = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return code;
        };

        // 确保邀请码唯一
        let userInviteCode = generateInviteCode();
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
          const existingInvite = await DB
            .prepare('SELECT * FROM user WHERE invite_code = ?')
            .bind(userInviteCode)
            .first();
          
          if (!existingInvite) {
            isUnique = true;
          } else {
            userInviteCode = generateInviteCode();
            attempts++;
          }
        }

        if (!isUnique) {
          return resJson({ success: false, message: '邀请码生成失败，请重试！' }, 500);
        }

        let finalBalance = 0;

        // 如果提供了邀请码，检查邀请人是否存在并给予奖励
        if (inviteCode) {
          const inviterUser = await DB
            .prepare('SELECT * FROM user WHERE invite_code = ?')
            .bind(inviteCode)
            .first();
          
          if (inviterUser) {
            // 被邀请人奖励2元
            finalBalance = 2;
            
            // 邀请人奖励2元
            await DB
              .prepare('UPDATE user SET balance = balance + 2 WHERE username = ?')
              .bind(inviterUser.username)
              .run();
            
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            // 给被邀请人发送奖励通知
            await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind(username, `[系统通知] 您使用邀请码 ${inviteCode} 注册成功，获得奖励 2 元`, now)
              .run();
            
            // 给邀请人发送奖励通知
            await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind(inviterUser.username, `[系统通知] 您的邀请用户 ${username} 已注册，您获得奖励 2 元`, now)
              .run();
          }
        }

        // 插入新用户（默认余额0，VIP过期时间为null，流量限制相关字段）
        const result = await DB
          .prepare('INSERT INTO user (username, password, balance, v_expire_date, learn_vip_expire_date, monthly_quota, used_quota, quota_reset_date, invite_code, v_token, v_link_clash, v_link_v2ray) VALUES (?, ?, ?, NULL, NULL, 307200, 0, ?, ?, ?, ?, ?)')
          .bind(username, password, finalBalance, new Date().toISOString().slice(0, 19).replace('T', ' '), userInviteCode, '', '', '')
          .run();

        if (result.success) {
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const msg = `[系统通知] 用户 ${username} 注册成功！`;
          
          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind('immmor', msg, now)
            .run();
          
          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind('admin', msg, now)
            .run();

          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind(username, '欢迎加入phantom', now)
            .run();
          
          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind(username, '免费节点链接和付费节点链接不一样！！！！！', now)
            .run();
          
          return resJson({ 
            success: true, 
            message: finalBalance > 0 ? '注册成功！获得邀请奖励2元' : '注册成功！', 
            userInfo: { id: result.meta.last_row_id, username: username, balance: finalBalance },
            inviteCode: userInviteCode
          });
        } else {
          return resJson({ success: false, message: '注册失败，请重试！' }, 500);
        }
      }

      // ========== 批量更新链接接口 ==========
      if (path === '/api/batch-update-links' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { usernames, v_link_clash, v_link_v2ray } = params;
          
          if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
            return resJson({ code: 400, msg: '请提供至少一个用户名' }, 400);
          }
          
          if (!v_link_clash && !v_link_v2ray) {
            return resJson({ code: 400, msg: '请至少提供一个链接' }, 400);
          }
          
          let updatedCount = 0;
          
          for (const username of usernames) {
            const result = await DB
              .prepare('UPDATE user SET v_link_clash = ?, v_link_v2ray = ? WHERE username = ?')
              .bind(v_link_clash || '', v_link_v2ray || '', username)
              .run();
            
            if (result.success && result.meta.changes > 0) {
              updatedCount++;
            }
          }
          
          return resJson({
            code: 200,
            msg: `成功更新 ${updatedCount} 个用户的链接`,
            data: { updated: updatedCount }
          });
        } catch (err) {
          console.error('批量更新链接错误:', err);
          return resJson({ code: 500, msg: '更新失败', error: err.message }, 500);
        }
      }

      // ========== 更新用户链接接口（仅immmor和admin可操作） ==========
      if (path === '/api/update-link' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, v_link_clash, v_link_v2ray } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '请提供用户名' }, 400);
          }
          
          if (!v_link_clash && !v_link_v2ray) {
            return resJson({ code: 400, msg: '请至少提供一个链接' }, 400);
          }
          
          const allowedUsers = ['immmor', 'admin'];
          const currentUser = params.currentUser;
          
          if (!currentUser || !allowedUsers.includes(currentUser)) {
            return resJson({ code: 403, msg: '无权限操作' }, 403);
          }
          
          const result = await DB
            .prepare('UPDATE user SET v_link_clash = ?, v_link_v2ray = ? WHERE username = ?')
            .bind(v_link_clash || '', v_link_v2ray || '', username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            return resJson({ code: 200, msg: '链接更新成功' });
          } else {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
        } catch (err) {
          console.error('更新链接错误:', err);
          return resJson({ code: 500, msg: '更新失败', error: err.message }, 500);
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

      // ========== 生成5位随机字符串 ==========
      const generateVToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let token = '';
        for (let i = 0; i < 5; i++) {
          token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
      };

      // ========== 开通VIP接口 ==========
      if (path === '/api/open-vip' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, duration = 30, price = 10.00 } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const vipPrice = parseFloat(price);
          
          const now = new Date();
          let newExpireDate = new Date();
          
          const user = await DB
            .prepare('SELECT balance, v_expire_date, v_token, v_link_clash, v_link_v2ray FROM user WHERE username = ?')
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
          
          if (user.v_expire_date && new Date(user.v_expire_date) > now) {
            newExpireDate = new Date(user.v_expire_date);
            newExpireDate.setDate(newExpireDate.getDate() + duration);
          } else {
            newExpireDate.setDate(now.getDate() + duration);
          }
          
          const vToken = generateVToken();
          
          const isYearly = duration === 365;
          const vLinkClash = isYearly ? 'https://p5jli.no-mad-sub.one/link/R4eay53N8l0ooeQn?clash=3&extend=1' : (user.v_link_clash || 'https://lxlv9.no-mad-sub.one/link/Q8fwb1PCpjDpH1dK?clash=3&extend=1');
          const vLinkV2ray = isYearly ? 'https://p5jli.no-mad-sub.one/link/R4eay53N8l0ooeQn?sub=3&extend=1' : (user.v_link_v2ray || 'https://lxlv9.no-mad-sub.one/link/Q8fwb1PCpjDpH1dK?sub=2&extend=1');
          
          const result = await DB
            .prepare('UPDATE user SET balance = balance - ?, v_expire_date = ?, v_token = ?, v_link_clash = ?, v_link_v2ray = ? WHERE username = ?')
            .bind(vipPrice, newExpireDate.toISOString().slice(0, 19).replace('T', ' '), vToken, vLinkClash, vLinkV2ray, username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const msg = `[系统通知] 用户 ${username} 开通VIP成功！`;
            
            await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind('immmor', msg, now)
              .run();
            
            await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind('admin', msg, now)
              .run();
            
            const updatedUser = await DB
              .prepare('SELECT username, balance, v_expire_date, v_token, v_link_clash, v_link_v2ray FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            return resJson({
              code: 200,
              msg: 'VIP开通成功',
              data: {
                username: updatedUser.username,
                balance: updatedUser.balance,
                v_expire_date: updatedUser.v_expire_date,
                v_token: updatedUser.v_token,
                v_link_clash: updatedUser.v_link_clash,
                v_link_v2ray: updatedUser.v_link_v2ray,
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
            .prepare('SELECT username, v_expire_date, v_token, v_link_clash, v_link_v2ray FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date.replace(' ', 'T') + 'Z') : null;
          const isVipValid = expireDate && expireDate > now;
          
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
              v_token: user.v_token,
              v_link_clash: user.v_link_clash,
              v_link_v2ray: user.v_link_v2ray,
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

      // ========== 修改余额接口 ==========
      if (path === '/api/balance/edit' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, balance } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          if (balance === undefined || balance === null || isNaN(parseFloat(balance))) {
            return resJson({ code: 400, msg: '缺少有效的balance参数' }, 400);
          }
          
          const newBalance = parseFloat(balance);
          
          const user = await DB
            .prepare('SELECT username FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          const result = await DB
            .prepare('UPDATE user SET balance = ? WHERE username = ?')
            .bind(newBalance, username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            return resJson({ code: 200, msg: '余额修改成功', balance: newBalance });
          } else {
            return resJson({ code: 500, msg: '余额修改失败' }, 500);
          }
        } catch (err) {
          console.error('Balance edit error:', err);
          return resJson({ code: 500, msg: '修改失败', error: err.message }, 500);
        }
      }

      // ========== 查询流量使用情况接口 ==========
      if (path === '/api/quota' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const user = await DB
            .prepare('SELECT monthly_quota, used_quota, quota_reset_date, v_expire_date, v_link_clash, v_link_v2ray FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          const isVipValid = expireDate && expireDate > now;
          
          // 检查是否需要重置流量
          const resetDate = user.quota_reset_date ? new Date(user.quota_reset_date) : new Date();
          const nextMonth = new Date(resetDate);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          
          if (now > nextMonth) {
            await DB
              .prepare('UPDATE user SET used_quota = 0, quota_reset_date = ? WHERE username = ?')
              .bind(now.toISOString().slice(0, 19).replace('T', ' '), username)
              .run();
            user.used_quota = 0;
          }
          
          return resJson({
            code: 200,
            msg: '查询成功',
            data: {
              username: username,
              is_vip: isVipValid,
              monthly_quota: user.monthly_quota || 307200,
              used_quota: user.used_quota || 0,
              remaining_quota: (user.monthly_quota || 307200) - (user.used_quota || 0),
              quota_reset_date: user.quota_reset_date,
              v_link_clash: user.v_link_clash,
              v_link_v2ray: user.v_link_v2ray,
              next_reset_date: nextMonth.toISOString().slice(0, 19).replace('T', ' ')
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== VIP节点接口 ==========
      if (path === '/vip/clash' && request.method === 'GET') {
        try {
          const vToken = url.searchParams.get('v');
          
          if (!vToken) {
            return resJson({ code: 400, msg: '缺少v参数' }, 400);
          }
          
          const user = await DB
            .prepare('SELECT v_expire_date, v_token, monthly_quota, used_quota, quota_reset_date, username, v_link_clash FROM user WHERE v_token = ?')
            .bind(vToken)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: 'Token无效' }, 404);
          }
          
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          
          if (!expireDate || expireDate < now) {
            return resJson({ 
              code: 403, 
              msg: 'VIP已过期或未开通',
              quota_info: {
                monthly_quota: user.monthly_quota || 307200,
                used_quota: user.used_quota || 0,
                remaining_quota: (user.monthly_quota || 307200) - (user.used_quota || 0)
              }
            }, 403);
          }
          
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          
          const vipUrl = user.v_link_clash;
          
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
          const vToken = url.searchParams.get('v');
          
          if (!vToken) {
            return resJson({ code: 400, msg: '缺少v参数' }, 400);
          }
          
          const user = await DB
            .prepare('SELECT v_expire_date, v_token, username, v_link_v2ray FROM user WHERE v_token = ?')
            .bind(vToken)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: 'Token无效' }, 404);
          }
          
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          
          if (!expireDate || expireDate < now) {
            return resJson({ code: 403, msg: 'VIP已过期或未开通' }, 403);
          }
          
          const vipV2rayUrl = user.v_link_v2ray;
          
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

      // ========== 保存合同接口 ==========
      if (path === '/api/contract/save' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, contractTitle, contractContent, signatureImages } = params;
          
          if (!username || !contractContent) {
            return resJson({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          const contractId = 'contract_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          const shareToken = Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          
          // 插入合同记录
          const result = await DB
            .prepare('INSERT INTO contracts (contract_id, username, contract_title, contract_content, signature_images, share_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(contractId, username, contractTitle || '未命名合同', contractContent, JSON.stringify(signatureImages || {}), shareToken, now, now)
            .run();
          
          if (result.success) {
            return resJson({
              code: 200,
              msg: '合同保存成功',
              data: {
                contractId: contractId,
                shareToken: shareToken,
                shareUrl: `/api/contract/view?token=${shareToken}`
              }
            });
          } else {
            return resJson({ code: 500, msg: '保存失败，请重试' }, 500);
          }
        } catch (err) {
          console.error('保存合同错误:', err);
          return resJson({ code: 500, msg: '保存失败', error: err.message }, 500);
        }
      }

      // ========== 查看分享合同接口 ==========
      if (path === '/api/contract/view' && request.method === 'GET') {
        try {
          const token = url.searchParams.get('token');
          
          if (!token) {
            return resJson({ code: 400, msg: '缺少 token 参数' }, 400);
          }
          
          const contract = await DB
            .prepare('SELECT * FROM contracts WHERE share_token = ?')
            .bind(token)
            .first();
          
          if (!contract) {
            return resJson({ code: 404, msg: '合同不存在' }, 404);
          }
          
          // 增加查看次数
          await DB
            .prepare('UPDATE contracts SET view_count = view_count + 1 WHERE share_token = ?')
            .bind(token)
            .run();
          
          // 返回HTML页面而不是JSON
          const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${contract.contract_title}</title>
    <style>
        body {
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px;
            color: #1e293b;
        }
        .contract-paper {
            background: white;
            padding: 60px 80px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            line-height: 1.8;
        }
        h1 { text-align: center; color: #0f172a; margin-bottom: 40px; }
        h2 { border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; }
        .editable-field {
            background-color: #fffbeb;
            border-bottom: 1px dashed #f59e0b;
            padding: 0 5px;
        }
        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 50px;
        }
        .sig-box {
            border: 2px dashed #cbd5e1;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        @media (max-width: 768px) {
            .contract-paper { padding: 30px 20px; }
            .signature-section { grid-template-columns: 1fr; }
        }
        @media print {
            body { background: white; padding: 0; }
            .contract-paper { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="contract-paper">
${contract.contract_content.replace(/<script[^>]*>.*?<\/script>/gi, '')}
    </div>
</body>
</html>`;
          
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== 获取用户合同列表接口 ==========
      if (path === '/api/contract/list' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少 username 参数' }, 400);
          }
          
          const contracts = await DB
            .prepare('SELECT contract_id, contract_title, share_token, created_at, updated_at, view_count FROM contracts WHERE username = ? ORDER BY created_at DESC')
            .bind(username)
            .all();
          
          return resJson({
            code: 200,
            msg: '查询成功',
            data: contracts.results || []
          });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== 删除合同接口 ==========
      if (path === '/api/contract/delete' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, contractId } = params;
          
          if (!username || !contractId) {
            return resJson({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          // 验证合同所有权
          const contract = await DB
            .prepare('SELECT * FROM contracts WHERE contract_id = ? AND username = ?')
            .bind(contractId, username)
            .first();
          
          if (!contract) {
            return resJson({ code: 404, msg: '合同不存在或无权删除' }, 404);
          }
          
          const result = await DB
            .prepare('DELETE FROM contracts WHERE contract_id = ? AND username = ?')
            .bind(contractId, username)
            .run();
          
          if (result.success) {
            return resJson({ code: 200, msg: '删除成功' });
          } else {
            return resJson({ code: 500, msg: '删除失败' }, 500);
          }
        } catch (err) {
          return resJson({ code: 500, msg: '删除失败', error: err.message }, 500);
        }
      }

      // ========== 重置VIP Token接口 ==========
      if (path === '/api/reset-vtoken' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const now = new Date();
          
          const user = await DB
            .prepare('SELECT username, v_expire_date, v_token, v_link_clash, v_link_v2ray FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          if (!user.v_expire_date || new Date(user.v_expire_date) <= now) {
            return resJson({ code: 403, msg: 'VIP已过期或未开通，无法重置Token' }, 403);
          }
          
          const newVToken = generateVToken();
          
          const result = await DB
            .prepare('UPDATE user SET v_token = ?, v_link_clash = ?, v_link_v2ray = ? WHERE username = ?')
            .bind(newVToken, '', '', username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            const updatedUser = await DB
              .prepare('SELECT username, v_expire_date, v_token, v_link_clash, v_link_v2ray FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            return resJson({
              code: 200,
              msg: 'Token重置成功',
              data: {
                username: updatedUser.username,
                v_expire_date: updatedUser.v_expire_date,
                v_token: updatedUser.v_token,
                v_link_clash: updatedUser.v_link_clash,
                v_link_v2ray: updatedUser.v_link_v2ray
              }
            });
          } else {
            return resJson({ code: 500, msg: 'Token重置失败，请重试' }, 500);
          }
        } catch (err) {
          console.error('重置Token错误:', err);
          return resJson({ code: 500, msg: 'Token重置失败', error: err.message }, 500);
        }
      }

      // ========== 发送消息接口 ==========
      if (path === '/api/send-message' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { content, target, username } = params;
          
          if (!content) {
            return resJson({ code: 400, msg: '内容不能为空' }, 400);
          }
          
          if (target === 'single' && !username) {
            return resJson({ code: 400, msg: '请指定用户名' }, 400);
          }
          
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          
          if (target === 'all') {
            // 获取所有用户
            const users = await DB
              .prepare('SELECT username FROM user')
              .all();
            
            if (!users.results || users.results.length === 0) {
              return resJson({ code: 404, msg: '暂无用户' }, 404);
            }
            
            // 为每个用户插入消息
            for (const user of users.results) {
              await DB
                .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
                .bind(user.username, content, now)
                .run();
            }
            
            return resJson({
              code: 200,
              msg: '发送成功',
              data: {
                total: users.results.length,
                content
              }
            });
          } else if (target === 'single') {
            // 检查用户是否存在
            const existingUser = await DB
              .prepare('SELECT * FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            if (!existingUser) {
              return resJson({ code: 404, msg: '用户不存在' }, 404);
            }
            
            // 插入消息
            const result = await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind(username, content, now)
              .run();
            
            if (result.success) {
              return resJson({
                code: 200,
                msg: '发送成功',
                data: {
                  username,
                  content
                }
              });
            } else {
              return resJson({ code: 500, msg: '发送失败，请重试' }, 500);
            }
          } else {
            return resJson({ code: 400, msg: '无效的发送目标' }, 400);
          }
        } catch (err) {
          console.error('发送消息错误:', err);
          return resJson({ code: 500, msg: '发送失败', error: err.message }, 500);
        }
      }

      // ========== 获取用户消息接口 ==========
      if (path === '/api/messages' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '请传入username参数' }, 400);
          }
          
          // 获取用户消息列表
          const messages = await DB
            .prepare('SELECT * FROM messages WHERE username = ? ORDER BY created_at DESC LIMIT 50')
            .bind(username)
            .all();
          
          // 获取未读消息数量
          const unreadCount = await DB
            .prepare('SELECT COUNT(*) as count FROM messages WHERE username = ? AND is_read = 0')
            .bind(username)
            .first();
          
          return resJson({
            code: 200,
            msg: '查询成功',
            data: {
              messages: messages.results || [],
              unreadCount: unreadCount?.count || 0
            }
          });
        } catch (err) {
          console.error('获取消息错误:', err);
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== 标记消息为已读接口 ==========
      if (path === '/api/messages/read' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { messageId, username } = params;
          
          if (!messageId || !username) {
            return resJson({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          const result = await DB
            .prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND username = ?')
            .bind(messageId, username)
            .run();
          
          if (result.success) {
            return resJson({ code: 200, msg: '标记成功' });
          } else {
            return resJson({ code: 500, msg: '标记失败' }, 500);
          }
        } catch (err) {
          console.error('标记消息错误:', err);
          return resJson({ code: 500, msg: '标记失败', error: err.message }, 500);
        }
      }

      // ========== 默认接口提示 ==========
      return resJson({
        code: 200,
        msg: 'Worker+D1 服务正常 ✅'
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