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
    
    // 工具函数：返回JSON响应
    function jsonResponse(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 1. 处理自定义 API 接口（后台逻辑）
    if (url.pathname.startsWith('/api/')) {
      // 路由匹配：/api/register 注册接口（使用 D1 数据库）
      if (url.pathname === '/api/register' && request.method === 'POST') {
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
            .prepare('INSERT INTO user (username, password, balance) VALUES (?, ?, 0)')
            .bind(username, password)
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
            .prepare('SELECT rowid, username, balance, not_trusted FROM user WHERE username = ? AND password = ?')
            .bind(username, password)
            .first();

          if (user) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: '登录成功！', 
              userInfo: { id: user.rowid, username: user.username, balance: user.balance, not_trusted: user.not_trusted || '' } 
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
            notify_url: `https://immmor.com/api/pay/notify?username=${encodeURIComponent(params.username || '')}`,
            return_url: 'https://immmor.com/pay',
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
          
          // 记录订单到Supabase
          try {
            if (env.SUPABASE_URL && env.SUPABASE_KEY) {
              await supabaseFetch('orders', createSupabaseConfig('POST', {
                order_no: finalOrderNo,
                username: params.username,
                amount: amount,
                payment_type: epayType,
                status: 'pending',
                description: description
              }));
            }
          } catch (error) {
            console.error('Supabase订单记录失败:', error);
            // 忽略错误，继续流程
          }
          
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
            // 更新用户余额
            const result = await env.DB
              .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
              .bind(parseFloat(money), username)
              .run();
            
            // 更新订单状态到Supabase
            try {
              if (env.SUPABASE_URL && env.SUPABASE_KEY) {
                await supabaseFetch(`orders?order_no=eq.${order_no}`, createSupabaseConfig('PATCH', {
                  status: 'paid',
                  trade_no: trade_no,
                  paid_at: new Date().toISOString()
                }));
              }
            } catch (error) {
              console.error('Supabase订单更新失败:', error);
            }
            
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
          const { username, order_no } = params;
          
          if (!username || !order_no) {
            return jsonResponse({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          const creemApiKey = env.CREEM_API_KEY;
          const creemBaseUrl = 'https://api.creem.io/v1/checkouts';
          
          if (!creemApiKey) {
            return jsonResponse({ code: 500, msg: '支付服务未配置，请配置 CREEM_API_KEY 环境变量' }, 500);
          }
          
          const product_id = env.CREEM_PRODUCT_ID || 'prod_6SdsEpr0Bv5d3cyLUdcU6c';
          
          const checkoutData = {
            product_id: product_id,
            success_url: `https://immmor.com/api/pay/creem-notify?order_no=${encodeURIComponent(order_no)}&username=${encodeURIComponent(username)}`
          };
          
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
            try {
              await supabaseFetch('orders', createSupabaseConfig('POST', {
                order_no: order_no,
                username: username,
                amount: 140,
                payment_type: 'credit_card',
                status: 'pending',
                description: '信用卡支付'
              }));
            } catch (supabaseError) {
              console.error('Supabase订单记录失败:', supabaseError);
            }
            
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
          
          console.log('收到支付回调:', { checkout_id, order_id, order_no, username });
          
          if (order_no && username) {
            const amountCny = 140;
                
            // 更新用户余额
            await env.DB
              .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
              .bind(parseFloat(amountCny), username)
              .run();
            
            console.log(`余额更新成功: ${username} +${amountCny}`);
            
            // 更新订单状态
            try {
              await supabaseFetch(`orders?order_no=eq.${order_no}`, createSupabaseConfig('PATCH', {
                status: 'paid',
                paid_at: new Date().toISOString(),
                trade_no: order_id || checkout_id
              }));
              console.log('订单状态更新成功');
            } catch (supabaseError) {
              console.error('Supabase订单更新失败:', supabaseError);
            }
          } else {
            console.log('缺少必要参数，无法更新');
          }
          
          return Response.redirect('https://immmor.com/pay', 302);
        } catch (err) {
          console.error('Creem.io通知处理错误:', err);
          return Response.redirect('https://immmor.com/pay', 302);
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
          
          // 更新用户余额
          const result = await env.DB
            .prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
            .bind(amount, username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            // 更新订单状态为已支付，如果订单不存在则创建新订单
            try {
              // 先尝试查询订单是否存在
              const existingOrders = await supabaseFetch(`orders?order_no=eq.${order_no}`, createSupabaseConfig());
              
              if (existingOrders && existingOrders.length > 0) {
                // 订单已存在，更新状态
                await supabaseFetch(`orders?order_no=eq.${order_no}`, createSupabaseConfig('PATCH', {
                  status: 'paid',
                  trade_no: order_no,
                  paid_at: new Date().toISOString(),
                }));
              } else {
                // 订单不存在，创建新订单
                await supabaseFetch('orders', createSupabaseConfig('POST', {
                  order_no: order_no,
                  username: username,
                  amount: amount,
                  payment_type: payment_type,
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
                }));
              }
            } catch (error) {
              console.error('订单状态更新或创建失败:', error);
            }
            
            // 获取更新后的余额
            const user = await env.DB
              .prepare('SELECT balance FROM user WHERE username = ?')
              .bind(username)
              .first();
            
            return jsonResponse({ 
              success: true, 
              message: '充值成功', 
              balance: user.balance 
            });
          } else {
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
          
          // 保存订单到Supabase
          await supabaseFetch('orders', createSupabaseConfig('POST', orderData));
          
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

      // 路由匹配：/api/users 获取所有用户列表接口
      if (url.pathname === '/api/users' && request.method === 'GET') {
        try {
          const page = parseInt(url.searchParams.get('page')) || 1;
          const limit = parseInt(url.searchParams.get('limit')) || 50;
          const offset = (page - 1) * limit;
          
          // 获取用户总数
          const countResult = await env.DB
            .prepare('SELECT COUNT(*) as total FROM user')
            .first();
          const total = countResult ? countResult.total : 0;
          
          // 获取用户列表
          const users = await env.DB
            .prepare('SELECT rowid as id, username, password, balance, v_expire_date, learn_vip_expire_date, quota_reset_date, used_quota, monthly_quota, invite_code, v_token, v_link_v2ray, v_link_clash, login_info, price_plan, not_trusted, survey FROM user ORDER BY rowid DESC LIMIT ? OFFSET ?')
            .bind(limit, offset)
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
          
          // 获取VIP用户数 (v_expire_date 未过期)
          const now = new Date().toISOString();
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