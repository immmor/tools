// _worker.js
export default {
  // fetch 事件是核心，拦截所有进入 Pages 的请求
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 工具函数：创建Supabase请求配置
    function createSupabaseConfig(method = 'GET', body = null) {
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        }
      };
      if (body) config.body = JSON.stringify(body);
      return config;
    }
    
    // 工具函数：处理Supabase API调用
    async function supabaseFetch(endpoint, config) {
      try {
        if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
          throw new Error('Supabase environment variables not configured');
        }
        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${endpoint}`, config);
        return await response.json();
      } catch (error) {
        console.error('Supabase API error:', error);
        throw error;
      }
    }
    
    // 工具函数：创建订单（先创建订单，失败抛错以阻断后续操作）
    async function createOrder(orderData) {
      if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
        throw new Error('Supabase 未配置，无法创建订单');
      }
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/orders`, createSupabaseConfig('POST', orderData));
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch (e) {}
        throw new Error(`订单创建失败 (HTTP ${response.status}): ${detail}`);
      }
      try { return await response.json(); } catch (e) { return null; }
    }

    // 工具函数：返回JSON响应
    function jsonResponse(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 工具函数：原子认领订单（幂等性核心，仍基于 Supabase）
    // 关键：用 Postgres 的一条「UPDATE ... WHERE status IN (pending, failed)」做原子认领。
    // 同一 order_no 的并发回调中，只有最先执行该语句的请求会真正把状态改为 paid 并返回受影响行，
    // 其余请求因状态已不是 pending/failed 而匹配 0 行 —— 从而不会被重复充值（彻底消除 TOCTOU 竞态）。
    // 依赖 Supabase 表 orders 在 order_no 上有唯一约束。
    // 返回 'claimed'（本次应充值）或 'already'（已被处理过）；无法确定时抛错（fail-closed，绝不擅自充值）。
    async function claimOrderAndMaybeCredit({ order_no, patchBody, insertBody }) {
      const oeq = encodeURIComponent(order_no);

      // 1) 原子认领：仅当状态仍为 pending/failed 时才改为 paid
      const claimed = await supabaseFetch(
        `orders?order_no=eq.${oeq}&or=(status.eq.pending,status.eq.failed)`,
        createSupabaseConfig('PATCH', patchBody)
      );
      if (Array.isArray(claimed) && claimed.length > 0) {
        return 'claimed';
      }

      // 2) 不是本次认领：确认是否已被标记为 paid（并发的另一请求已处理，或历史已处理）
      const paid = await supabaseFetch(
        `orders?order_no=eq.${oeq}&status=eq.paid&select=id`,
        createSupabaseConfig()
      );
      if (Array.isArray(paid) && paid.length > 0) {
        return 'already';
      }

      // 3) 订单尚不存在（如 confirm 未预创建订单的场景）：尝试插入，依赖 order_no 唯一约束
      const created = await supabaseFetch('orders', createSupabaseConfig('POST', insertBody));
      if (Array.isArray(created) && created.length > 0) {
        return 'claimed';
      }

      // 4) 插入失败（唯一冲突，说明并发已插入并 paid）：再次确认
      const paid2 = await supabaseFetch(
        `orders?order_no=eq.${oeq}&status=eq.paid&select=id`,
        createSupabaseConfig()
      );
      if (Array.isArray(paid2) && paid2.length > 0) {
        return 'already';
      }

      // 5) 仍无法确定（Supabase 异常/网络问题）：安全拒绝，避免凭空充值
      throw new Error('无法确定订单状态，已安全拒绝本次充值');
    }

    // 工具函数：充值失败后把订单回滚为 pending，使后续重试可以重新认领，避免「钱没加但订单已 paid」导致永久漏充
    async function rollbackOrderPending(order_no) {
      try {
        await supabaseFetch(
          `orders?order_no=eq.${encodeURIComponent(order_no)}`,
          createSupabaseConfig('PATCH', { status: 'pending' })
        );
      } catch (e) {
        console.error('订单回滚失败:', e);
      }
    }

    // 工具函数：给管理员发站内消息（走 api.funbua.uk 的 send-message 接口）
    async function sendAdminMessage(content) {
      try {
        await fetch('https://api.funbua.uk/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, target: 'single', username: 'immmor' })
        });
      } catch (error) {
        console.error('管理员消息发送失败:', error);
      }
    }

    // 1. 处理自定义 API 接口（后台逻辑）
    if (url.pathname.startsWith('/api/')) {
      // 路由匹配：/api/register 注册接口（使用 D1 数据库）
      if (url.pathname === '/api/register' && request.method === 'POST') {
        const params = await request.json();
        const { username, password, securityAnswer } = params;
        
        if (!username || !password) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: '用户名和密码不能为空！' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        try {
          const existingUser = await env.DB
            .prepare('SELECT * FROM user WHERE username = ?')
            .bind(username)
            .first();

          if (existingUser) {
            return new Response(JSON.stringify({ 
              success: false, 
              message: '用户名已存在！' 
            }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const result = await env.DB
            .prepare('INSERT INTO user (username, password, balance, vorders) VALUES (?, ?, 0, ?)')
            .bind(username, password, '[]')
            .run();

          if (result.success) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: '注册成功！', 
              userInfo: { sername: username } 
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ 
              success: false, 
              message: '注册失败，请重试！' 
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: '数据库操作失败',
            error: err.message 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/login 登录接口（使用 D1 数据库）
      if (url.pathname === '/api/login' && request.method === 'POST') {
        const params = await request.json();
        const { username, password } = params;
        
        if (!username || !password) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: '用户名和密码不能为空！' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        try {
          const user = await env.DB
            .prepare('SELECT rowid, username, balance, not_trusted, vorders FROM user WHERE username = ? AND password = ?')
            .bind(username, password)
            .first();

          if (user) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: '登录成功！', 
              userInfo: { id: user.rowid, username: user.username, balance: user.balance, not_trusted: user.not_trusted || '', vorders: user.vorders } 
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ 
              success: false, 
              message: '用户名或密码错误' 
            }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: '数据库查询失败',
            error: err.message 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/pay/build-url 构建支付URL
      if (url.pathname === '/api/pay/build-url' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { type, order_no, amount, description } = params;
          
          if (!type || !order_no || !amount || !description) {
            return jsonResponse({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          const apiUrl = env.PAY_API_URL;
          const pid = env.PAY_MID;
          const key = env.PAY_KEY;
          
          const epayType = type === 'alipay' ? 'alipay' : 'wxpay';
          
          const finalOrderNo = params.username 
            ? (params.username.includes('@') 
                ? `${params.username.split('@')[0]}_${order_no}` 
                : `${params.username}_${order_no}`)
            : order_no;
          
          const paymentParams = {
            pid: pid,
            type: epayType,
            out_trade_no: finalOrderNo,
            notify_url: `https://funbua.uk/api/pay/notify?username=${encodeURIComponent(params.username || '')}`,
            return_url: 'https://funbua.uk/pay',
            name: description,
            money: amount.toFixed(2),
            sitename: '我的网站'
          };
          
          const sortedParams = Object.entries(paymentParams)
            .filter(([k, v]) => !['sign', 'sign_type'].includes(k) && v !== '')
            .sort(([a], [b]) => a.localeCompare(b));
          
          const queryString = sortedParams.map(([k, v]) => `${k}=${v}`).join('&');
          const signStr = queryString + key;
          
          const sign = await md5Hash(signStr);
          
          paymentParams['sign'] = sign;
          paymentParams['sign_type'] = 'MD5';
          
          const finalQueryString = Object.entries(paymentParams)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
          
          const payUrl = `${apiUrl}?${finalQueryString}`;
          
          // 1) 先创建订单，未创建成功则直接报错，不发送消息、不返回支付链接
          if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
            return jsonResponse({ code: 500, msg: '订单服务未配置' }, 500);
          }
          try {
            await createOrder({
              order_no: finalOrderNo,
              username: params.username,
              amount: amount,
              payment_type: epayType,
              status: 'pending',
              description: description
            });
          } catch (error) {
            console.error('订单创建失败，终止流程:', error);
            return jsonResponse({ code: 500, msg: '订单创建失败，请重试' }, 500);
          }

          // 2) 订单创建成功后再发送通知（失败不影响主流程）
          try {
            await sendAdminMessage(`📝 新订单：${params.username} 充值 ¥${Number(amount).toFixed(2)}（${epayType}），订单号 ${finalOrderNo}`);
          } catch (e) { console.error('通知发送失败:', e); }

          return jsonResponse({
            code: 200,
            msg: '支付URL构建成功',
            data: {
              pay_url: payUrl,
              order_no: order_no,
              amount: amount
            }
          });
        } catch (err) {
          return jsonResponse({ code: 500, msg: '支付URL构建失败', error: err.message }, 500);
        }
      }
      
      async function md5Hash(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('MD5', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
      }

      // 路由匹配：/api/pay/notify 支付通知接口
      if (url.pathname === '/api/pay/notify' && request.method === 'GET') {
        try {
          const order_no = url.searchParams.get('out_trade_no');
          const trade_no = url.searchParams.get('trade_no');
          const trade_status = url.searchParams.get('trade_status');
          const money = url.searchParams.get('money');
          const sign = url.searchParams.get('sign');
          const username = url.searchParams.get('username');

          if (!username) {
            return new Response('fail', { status: 400 });
          }

          if (trade_status === 'TRADE_SUCCESS') {
            // 原子认领订单：只有本次真正把 pending/failed -> paid 的请求才负责充值，杜绝并发重复充值
            let claim;
            try {
              claim = await claimOrderAndMaybeCredit({
                order_no,
                patchBody: {
                  status: 'paid',
                  trade_no: trade_no,
                  paid_at: new Date().toISOString()
                },
                insertBody: {
                  order_no: order_no,
                  username: username,
                  amount: parseFloat(money),
                  payment_type: 'epay',
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  description: '易支付回调'
                }
              });
            } catch (e) {
              console.error('幂等认领失败:', e);
              return new Response('fail', { status: 500 });
            }

            if (claim === 'already') {
              return new Response('success', { status: 200 });
            }

            // claim === 'claimed'：本次负责充值
            const result = await env.DB
              .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
              .bind(parseFloat(money), username)
              .run();

            if (!result.success) {
              // D1 余额更新失败，回滚订单状态以便重试
              await rollbackOrderPending(order_no);
              return new Response('fail', { status: 500 });
            }

            await sendAdminMessage(`✅ 支付成功：${username} 充值 ¥${parseFloat(money).toFixed(2)}，订单号 ${order_no}`);
            return new Response('success', { status: 200 });
          } else {
            // 支付失败，更新订单状态到Supabase
            try {
              if (env.SUPABASE_URL && env.SUPABASE_KEY) {
                await supabaseFetch(`orders?order_no=eq.${order_no}`, createSupabaseConfig('PATCH', {
                  status: 'failed'
                }));
              }
            } catch (error) {
              console.error('Supabase订单更新失败:', error);
            }

            return new Response('fail', { status: 200 });
          }
        } catch (err) {
          return new Response('fail', { status: 500 });
        }
      }

      // 路由匹配：/api/pay/creem-checkout creem.io信用卡支付接口
      if (url.pathname === '/api/pay/creem-checkout' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, order_no, amount = 20 } = params;
          
          if (!username || !order_no) {
            return jsonResponse({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          const usdAmount = parseFloat(amount) || 20;
          const cnyAmount = usdAmount * 6.7;
          
          const creemApiKey = env.CREEM_API_KEY;
          const creemBaseUrl = 'https://api.creem.io/v1/checkouts';
          
          if (!creemApiKey) {
            return jsonResponse({ code: 500, msg: '支付服务未配置，请配置 CREEM_API_KEY 环境变量' }, 500);
          }
          
          const productIds = {
            5: 'prod_6lnHBXB70J5QrjZyrP2xnH',  // 替换为 $5 产品的真实ID
            10: 'prod_2vOIqGclfU7th5LLRh7eC4', // 替换为 $10 产品的真实ID
            20: 'prod_1I3N5DS5Q3ibzWYPr5OphH',
            30: 'prod_4V2xguG8ZPPZbMAGWuLhpE', // TODO: 替换为 $30 产品的真实ID
            50: 'prod_4etoGHeis7Mxe83R8Hj16a', // TODO: 替换为 $50 产品的真实ID
            100: 'prod_1a666EWxt0Jzha7HjbTu2F'
          };
          const product_id = productIds[usdAmount] || productIds[20];
          
          const checkoutData = {
            product_id: product_id,
            success_url: `https://funbua.uk/api/pay/creem-notify?order_no=${encodeURIComponent(order_no)}&username=${encodeURIComponent(username)}&amount=${cnyAmount}`
          };
          
          // 1) 先创建订单，未创建成功不创建 Creem 结账、不发送消息
          try {
            await createOrder({
              order_no: order_no,
              username: username,
              amount: cnyAmount,
              payment_type: 'creem',
              status: 'pending',
              description: `信用卡支付 $${usdAmount}`
            });
          } catch (err) {
            console.error('Creem 订单创建失败:', err);
            return jsonResponse({ code: 500, msg: '订单创建失败: ' + err.message }, 500);
          }

          // 2) 订单创建成功后，再调用 Creem 创建结账
          const response = await fetch(creemBaseUrl, {
            method: 'POST',
            headers: {
              'x-api-key': creemApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(checkoutData)
          });

          console.log('Creem.io response status:', response.status);
          const checkoutResult = await response.json();
          console.log('Creem.io response:', checkoutResult);

          if (response.ok && checkoutResult.id) {
            // 3) 发送通知（失败不影响主流程）
            try {
              await sendAdminMessage(`📝 新订单：${username} 信用卡充值 ¥${cnyAmount.toFixed(2)}，订单号 ${order_no}`);
            } catch (e) { console.error('通知发送失败:', e); }

            return jsonResponse({
              code: 200,
              msg: '支付链接创建成功',
              data: {
                checkout_url: checkoutResult.checkout_url,
                checkout_id: checkoutResult.id,
                order_no: order_no
              }
            });
          } else {
            console.error('Creem.io创建支付失败:', checkoutResult);
            console.error('Creem.io response status:', response.status);
            console.error('Checkout data sent:', checkoutData);
            return jsonResponse({ 
              code: 500, 
              msg: '支付链接创建失败', 
              error: checkoutResult.error || '未知错误',
              details: checkoutResult 
            }, 500);
          }
        } catch (err) {
          console.error('Creem.io支付接口错误:', err);
          return jsonResponse({ code: 500, msg: '支付接口错误', error: err.message }, 500);
        }
      }

      // 路由匹配：/api/pay/creem-notify creem.io支付通知接口
      if (url.pathname === '/api/pay/creem-notify' && request.method === 'GET') {
        try {
          const checkout_id = url.searchParams.get('checkout_id');
          const order_id = url.searchParams.get('order_id');
          const order_no = url.searchParams.get('order_no');
          const username = url.searchParams.get('username');
          const amount = url.searchParams.get('amount');

          console.log('收到支付回调:', { checkout_id, order_id, order_no, username, amount });

          if (order_no && username) {
            const amountCny = parseFloat(amount) || 140;

            // 原子认领订单，杜绝并发重复充值
            let claim;
            try {
              claim = await claimOrderAndMaybeCredit({
                order_no,
                patchBody: {
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  trade_no: order_id || checkout_id
                },
                insertBody: {
                  order_no: order_no,
                  username: username,
                  amount: amountCny,
                  payment_type: 'creem',
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  description: '信用卡支付'
                }
              });
            } catch (e) {
              console.error('幂等认领失败:', e);
              return Response.redirect('https://funbua.uk/pay?err=1', 302);
            }

            if (claim === 'already') {
              return Response.redirect('https://funbua.uk/pay', 302);
            }

            // claim === 'claimed'：本次负责充值
            const result = await env.DB
              .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
              .bind(amountCny, username)
              .run();

            if (!result.success) {
              await rollbackOrderPending(order_no);
              return Response.redirect('https://funbua.uk/pay?err=1', 302);
            }

            console.log(`余额更新成功: ${username} +${amountCny}`);
            await sendAdminMessage(`✅ 支付成功：${username} 信用卡充值 ¥${amountCny.toFixed(2)}，订单号 ${order_no}`);
          } else {
            console.log('缺少必要参数，无法更新');
          }

          return Response.redirect('https://funbua.uk/pay', 302);
        } catch (err) {
          console.error('Creem.io通知处理错误:', err);
          return Response.redirect('https://funbua.uk/pay', 302);
        }
      }

      // 路由匹配：/api/recharge 充值接口
      if (url.pathname === '/api/recharge' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, amount } = params;
          
          if (!username || !amount || amount <= 0) {
            return new Response(JSON.stringify({ code: 400, msg: '参数错误' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const result = await env.DB
            .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
            .bind(amount, username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            const user = await env.DB
              .prepare('SELECT balance FROM user WHERE username = ?')
              .bind(username)
              .first();

            // 写入充值记录到 Supabase orders 表，否则后台充值记录里查不到
            try {
              if (env.SUPABASE_URL && env.SUPABASE_KEY) {
                await supabaseFetch('orders', createSupabaseConfig('POST', {
                  order_no: `manual_${username}_${Date.now()}`,
                  username: username,
                  amount: amount,
                  payment_type: 'manual',
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  description: '后台快速充值'
                }));
              }
            } catch (orderErr) {
              console.error('充值订单记录失败:', orderErr);
            }
            
            return new Response(JSON.stringify({ code: 200, msg: '充值成功', balance: user.balance }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ code: 404, msg: '用户不存在' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          return new Response(JSON.stringify({ code: 500, msg: '充值失败', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/recharge/confirm 人工审核充值确认接口
      if (url.pathname === '/api/recharge/confirm' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, order_no, amount, payment_type } = params;

          if (!username || !order_no || !amount || amount <= 0) {
            return jsonResponse({ success: false, message: '参数错误' }, 400);
          }

          // 原子认领订单：并发/重复调用只会有一个请求真正充值
          let claim;
          try {
            claim = await claimOrderAndMaybeCredit({
              order_no,
              patchBody: {
                status: 'paid',
                trade_no: order_no,
                paid_at: new Date().toISOString()
              },
              insertBody: {
                order_no: order_no,
                username: username,
                amount: amount,
                payment_type: payment_type,
                status: 'paid',
                paid_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              }
            });
          } catch (e) {
            console.error('幂等认领失败:', e);
            return jsonResponse({ success: false, message: '充值校验失败，请稍后重试' }, 500);
          }

          if (claim === 'already') {
            const u = await env.DB
              .prepare('SELECT balance FROM user WHERE username = ?')
              .bind(username)
              .first();
            return jsonResponse({ success: true, message: '充值成功（已处理过）', balance: u ? u.balance : null });
          }

          // claim === 'claimed'：本次负责充值
          const result = await env.DB
            .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
            .bind(amount, username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            // 获取更新后的余额
            const user = await env.DB
              .prepare('SELECT balance FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            await sendAdminMessage(`✅ 支付成功：${username} 人工确认充值 ¥${parseFloat(amount).toFixed(2)}（${payment_type || '手动'}），订单号 ${order_no}`);

            return jsonResponse({ 
              success: true, 
              message: '充值成功', 
              balance: user.balance 
            });
          } else {
            // 用户不存在：回滚订单状态，避免留下 paid 但余额未加
            await rollbackOrderPending(order_no);
            return jsonResponse({ success: false, message: '用户不存在' }, 404);
          }
        } catch (err) {
          console.error('人工审核充值失败:', err);
          return jsonResponse({ success: false, message: '充值失败', error: err.message }, 500);
        }
      }

      // 路由匹配：/api/order/create-static 创建静态订单接口
      if (url.pathname === '/api/order/create-static' && request.method === 'POST') {
        try {
          const orderData = await request.json();
          
          if (!orderData.order_no || !orderData.username || !orderData.amount) {
            return jsonResponse({ success: false, message: '订单数据不完整' }, 400);
          }
          
          // 1) 先创建订单，未创建成功不发送消息、不返回成功
          try {
            await createOrder(orderData);
          } catch (err) {
            console.error('静态订单创建失败:', err);
            return jsonResponse({ success: false, message: '订单创建失败: ' + err.message }, 500);
          }

          // 2) 订单创建成功后再发送通知（失败不影响主流程）
          try {
            await sendAdminMessage(`📝 新订单：${orderData.username} 充值 ¥${orderData.amount}（${orderData.payment_type || '手动'}），订单号 ${orderData.order_no}`);
          } catch (e) { console.error('通知发送失败:', e); }

          return jsonResponse({ success: true, message: '静态订单创建成功' });
        } catch (err) {
          console.error('创建静态订单失败:', err);
          return jsonResponse({ success: false, message: '创建静态订单失败: ' + err.message }, 500);
        }
      }

      // 路由匹配：/api/balance 查询余额接口
      if (url.pathname === '/api/balance' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return new Response(JSON.stringify({ code: 400, msg: '缺少username参数' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          const user = await env.DB
            .prepare('SELECT balance FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (user) {
            return new Response(JSON.stringify({ code: 200, msg: '查询成功', balance: user.balance }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({ code: 404, msg: '用户不存在' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {
          return new Response(JSON.stringify({ code: 500, msg: '查询失败', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/orders 查询订单列表接口
      if (url.pathname === '/api/orders' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          const page = parseInt(url.searchParams.get('page')) || 1;
          const limit = parseInt(url.searchParams.get('limit')) || 10;
          const offset = (page - 1) * limit;
          
          let totalData, orders;
          
          if (username) {
            // 查询特定用户的订单
            totalData = await supabaseFetch(`orders?username=eq.${username}&select=id`, createSupabaseConfig());
            orders = await supabaseFetch(`orders?username=eq.${username}&order=created_at.desc&limit=${limit}&offset=${offset}`, createSupabaseConfig());
          } else {
            // 查询所有订单
            totalData = await supabaseFetch('orders?select=id', createSupabaseConfig());
            orders = await supabaseFetch(`orders?order=created_at.desc&limit=${limit}&offset=${offset}`, createSupabaseConfig());
          }
          
          const total = Array.isArray(totalData) ? totalData.length : 0;
          
          return jsonResponse({
            code: 200,
            msg: '查询成功',
            data: {
              orders: orders || [],
              pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
              }
            }
          });
        } catch (err) {
          return new Response(JSON.stringify({ code: 500, msg: '查询失败', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/orders 删除订单接口
      if (url.pathname === '/api/orders' && request.method === 'DELETE') {
        try {
          const { order_no } = await request.json();
          if (!order_no) {
            return jsonResponse({ code: 400, msg: '订单号不能为空' }, 400);
          }
          await supabaseFetch(`orders?order_no=eq.${order_no}`, createSupabaseConfig('DELETE'));
          return jsonResponse({ code: 200, msg: '删除成功' });
        } catch (err) {
          return new Response(JSON.stringify({ code: 500, msg: '删除失败', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/orders/pending 删除所有待支付订单接口
      if (url.pathname === '/api/orders/pending' && request.method === 'DELETE') {
        try {
          await supabaseFetch('orders?status=eq.pending', createSupabaseConfig('DELETE'));
          return jsonResponse({ code: 200, msg: '删除所有待支付订单成功' });
        } catch (err) {
          return new Response(JSON.stringify({ code: 500, msg: '删除失败', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/order/detail 查询订单详情接口
      if (url.pathname === '/api/order/detail' && request.method === 'GET') {
        try {
          const orderNo = url.searchParams.get('order_no');
          
          if (!orderNo) {
            return new Response(JSON.stringify({ code: 400, msg: '缺少order_no参数' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // 查询订单详情
          const orders = await supabaseFetch(`orders?order_no=eq.${orderNo}`, createSupabaseConfig());
          
          if (orders.length > 0) {
            return jsonResponse({ code: 200, msg: '查询成功', data: orders[0] });
          } else {
            return jsonResponse({ code: 404, msg: '订单不存在' }, 404);
          }
        } catch (err) {
          return new Response(JSON.stringify({ code: 500, msg: '查询失败', error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 路由匹配：/api/learn/vip VIP购买接口
      if (url.pathname === '/api/learn/vip' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, amount = 0.01, duration = 30 } = params;
          
          if (!username || !amount || amount <= 0) {
            return jsonResponse({ code: 400, msg: '参数错误' }, 400);
          }
          
          // 查询用户当前余额和VIP状态
          const user = await env.DB
            .prepare('SELECT balance, learn_vip_expire_date FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return jsonResponse({ code: 404, msg: '用户不存在' }, 404);
          }
          
          // 检查余额是否足够
          if (parseFloat(user.balance) < amount) {
            return jsonResponse({ code: 400, msg: '余额不足' }, 400);
          }
          
          // 计算新的VIP过期时间
          const now = new Date();
          let newExpireDate;
          
          // 如果用户已有VIP且未过期，则在原基础上续期
          if (user.learn_vip_expire_date) {
            const currentExpireDate = new Date(user.learn_vip_expire_date);
            if (currentExpireDate > now) {
              // VIP未过期，在原基础上续期
              newExpireDate = new Date(currentExpireDate.getTime() + duration * 24 * 60 * 60 * 1000);
            } else {
              // VIP已过期，从现在开始计算
              newExpireDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
            }
          } else {
            // 没有VIP，从现在开始计算
            newExpireDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
          }
          
          // 扣除余额并更新VIP过期时间
          const result = await env.DB
            .prepare('UPDATE user SET balance = balance - ?, learn_vip_expire_date = ? WHERE username = ?')
            .bind(amount, newExpireDate.toISOString(), username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            // 获取更新后的用户信息
            const updatedUser = await env.DB
              .prepare('SELECT balance, learn_vip_expire_date FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            // 格式化VIP过期时间
            const expireDate = new Date(updatedUser.learn_vip_expire_date);
            const formattedExpireDate = `${expireDate.getFullYear()}-${String(expireDate.getMonth() + 1).padStart(2, '0')}-${String(expireDate.getDate()).padStart(2, '0')} ${String(expireDate.getHours()).padStart(2, '0')}:${String(expireDate.getMinutes()).padStart(2, '0')}:${String(expireDate.getSeconds()).padStart(2, '0')}`;
            
            // 计算剩余天数
            const remainingDays = Math.ceil((expireDate - now) / (24 * 60 * 60 * 1000));
            
            return jsonResponse({
              code: 200, 
              msg: 'VIP购买成功', 
              data: {
                balance: updatedUser.balance,
                vip_expire_date: formattedExpireDate,
                remaining_days: remainingDays
              }
            });
          } else {
            return jsonResponse({ code: 500, msg: '购买失败' }, 500);
          }
        } catch (err) {
          return jsonResponse({ code: 500, msg: 'VIP购买失败', error: err.message }, 500);
        }
      }

      // 路由匹配：/api/learn/vip/status 查询VIP状态接口
      if (url.pathname === '/api/learn/vip/status' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          
          if (!username) {
            return jsonResponse({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const user = await env.DB
            .prepare('SELECT learn_vip_expire_date FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return jsonResponse({ code: 404, msg: '用户不存在' }, 404);
          }
          
          const now = new Date();
          let isVip = false;
          let remainingDays = 0;
          
          if (user.learn_vip_expire_date) {
            const expireDate = new Date(user.learn_vip_expire_date);
            if (expireDate > now) {
              isVip = true;
              remainingDays = Math.ceil((expireDate - now) / (24 * 60 * 60 * 1000));
            }
          }
          
          // 格式化VIP过期时间
          let formattedExpireDate = null;
          if (user.learn_vip_expire_date) {
            const expireDate = new Date(user.learn_vip_expire_date);
            formattedExpireDate = `${expireDate.getFullYear()}-${String(expireDate.getMonth() + 1).padStart(2, '0')}-${String(expireDate.getDate()).padStart(2, '0')} ${String(expireDate.getHours()).padStart(2, '0')}:${String(expireDate.getMinutes()).padStart(2, '0')}:${String(expireDate.getSeconds()).padStart(2, '0')}`;
          }
          
          return jsonResponse({
            code: 200,
            msg: '查询成功',
            data: {
              is_vip: isVip,
              vip_expire_date: formattedExpireDate,
              remaining_days: remainingDays
            }
          });
        } catch (err) {
          return jsonResponse({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // 路由匹配：/api/users 获取用户列表（支持分页 / 搜索 / 排序）
      if (url.pathname === '/api/users' && request.method === 'GET') {
        try {
          const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
          // 上限放宽到 10000：列表 UI 仅用 10~100 分页；统计类调用（limit=9999）仍需全量
          const limit = Math.min(10000, Math.max(1, parseInt(url.searchParams.get('limit')) || 50));
          const offset = (page - 1) * limit;
          const search = (url.searchParams.get('search') || '').trim();

          // 可排序字段白名单，防止 SQL 注入
          const sortWhitelist = {
            id:'id', username:'username', password:'password', v_expire_date:'v_expire_date',
            v_token:'v_token', invite_code:'invite_code', invited_user:'invited_user',
            v_link_clash:'v_link_clash', v_link_v2ray:'v_link_v2ray', login_info:'login_info',
            fetch_link:'fetch_link', price_plan:'price_plan', balance:'balance', monthly_quota:'monthly_quota',
            survey:'survey', security_answer:'security_answer', source:'source',
            free_expire_date:'free_expire_date', last_checkin:'last_checkin', auto_rewn:'auto_rewn', remark:'remark'
          };
          const reqSort = url.searchParams.get('sort');
          const reqOrder = (url.searchParams.get('order') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
          const sortCol = sortWhitelist[reqSort] || 'rowid';
          const orderBy = sortCol === 'rowid' ? 'rowid DESC' : (sortCol + ' ' + reqOrder);

          let where = '';
          const params = [];
          if (search) {
            where = ' WHERE username LIKE ? OR v_expire_date LIKE ? OR v_link_clash LIKE ? OR fetch_link LIKE ?';
            const like = '%' + search + '%';
            params.push(like, like, like, like);
          }

          // 获取用户总数
          const countResult = await env.DB
            .prepare('SELECT COUNT(*) as total FROM user' + where)
            .bind(...params)
            .first();
          const total = countResult ? countResult.total : 0;

          // 获取用户列表
          const users = await env.DB
            .prepare('SELECT rowid as id, username, password, balance, v_expire_date, learn_vip_expire_date, quota_reset_date, used_quota, monthly_quota, invite_code, v_token, v_link_v2ray, v_link_clash, login_info, fetch_link, price_plan, not_trusted, survey, invited_user, security_answer, source, auto_rewn, vorders, remark, free_expire_date, last_checkin FROM user' + where + ' ORDER BY ' + orderBy + ' LIMIT ? OFFSET ?')
            .bind(...params, limit, offset)
            .all();

          return jsonResponse({
            code: 200,
            msg: '查询成功',
            data: {
              users: users.results || [],
              pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
              }
            }
          });
        } catch (err) {
          return jsonResponse({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // 路由匹配：/api/stats 获取统计数据接口
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        try {
          // 获取用户总数
          const userCountResult = await env.DB
            .prepare('SELECT COUNT(*) as total FROM user')
            .first();
          const totalUsers = userCountResult ? userCountResult.total : 0;
          
          // 获取订单总数
          const ordersCountResult = await supabaseFetch('orders?select=id', createSupabaseConfig());
          const totalOrders = Array.isArray(ordersCountResult) ? ordersCountResult.length : 0;
          
          // 获取待处理订单数
          const pendingOrdersResult = await supabaseFetch('orders?status=eq.pending&select=id', createSupabaseConfig());
          const pendingOrders = Array.isArray(pendingOrdersResult) ? pendingOrdersResult.length : 0;
          
          // 获取总收入（已支付的订单）
          const paidOrdersResult = await supabaseFetch('orders?status=eq.paid&select=amount', createSupabaseConfig());
          let totalRevenue = 0;
          if (Array.isArray(paidOrdersResult)) {
            totalRevenue = paidOrdersResult.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0);
          }
          
          // 获取VIP用户数 (v_expire_date 未过期)；now 用空格格式与存储的 "YYYY-MM-DD HH:MM:SS" 对齐，保证字符串比较正确
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const vipUsersResult = await env.DB
            .prepare('SELECT COUNT(*) as total FROM user WHERE v_expire_date IS NOT NULL AND v_expire_date > ?')
            .bind(now)
            .first();
          const vipUsers = vipUsersResult ? vipUsersResult.total : 0;
          const normalUsers = totalUsers - vipUsers;
          
          // 获取订单趋势数据（最近7天）
          const recentOrdersResult = await supabaseFetch(
            'orders?select=created_at,amount&status=eq.paid&order=created_at.desc',
            createSupabaseConfig()
          );
          const orderLabels = [];
          const orderData = [];
          if (Array.isArray(recentOrdersResult)) {
            for (let i = 6; i >= 0; i--) {
              const date = new Date();
              date.setDate(date.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];
              orderLabels.push(`${date.getMonth() + 1}/${date.getDate()}`);
              
              const dayOrders = recentOrdersResult.filter(o => 
                o.created_at && o.created_at.startsWith(dateStr)
              );
              orderData.push(dayOrders.length);
            }
          } else {
            orderLabels.push('周一', '周二', '周三', '周四', '周五', '周六', '周日');
            orderData.push(12, 19, 15, 25, 22, 30, 28);
          }
          
          // 获取支付方式分布（从Supabase订单表）
          const allOrdersResult = await supabaseFetch('orders?select=payment_type,amount,status', createSupabaseConfig());
          const paymentMap = {};
          
          if (Array.isArray(allOrdersResult)) {
            allOrdersResult.forEach(order => {
              if (order.status === 'paid' || order.status === 'completed') {
                const type = order.payment_type || 'unknown';
                paymentMap[type] = (paymentMap[type] || 0) + parseFloat(order.amount || 0);
              }
            });
          }
          
          const paymentLabels = Object.keys(paymentMap);
          const paymentData = Object.values(paymentMap).map(v => parseFloat(v.toFixed(2)));
          
          return jsonResponse({
            code: 200,
            msg: '查询成功',
            data: {
              totalUsers,
              totalOrders,
              pendingOrders,
              totalRevenue: totalRevenue.toFixed(2),
              vipUsers,
              normalUsers,
              orderLabels,
              orderData,
              paymentLabels,
              paymentData
            }
          });
        } catch (err) {
          return jsonResponse({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      return jsonResponse({ code: 404, message: 'API not found' }, 404);
    }

    // 2. 放行静态资源（HTML/CSS/JS/图片等）
    // env.ASSETS.fetch 是 Pages 内置的静态资源获取方法
    return env.ASSETS.fetch(request);
  }
};