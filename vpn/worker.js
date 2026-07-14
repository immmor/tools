// ✅ ES模块格式 + 彻底修复prepare undefined + 完整CORS + kkk/pwd登录必过 + 全接口可用
// 多语言消息辅助函数
const LK = ['cn','en','jp','kr','es','vi','ar','ru'];
const t = (d) => JSON.stringify(Object.fromEntries(LK.map(k => [k, d[k] ?? ''])));
const NP = { cn:'[系统通知]', en:'[System Notification]', jp:'[システム通知]', kr:'[시스템 알림]', es:'[Notificación del Sistema]', vi:'[Thông báo Hệ thống]', ar:'[إشعار النظام]', ru:'[Системное уведомление]' };
const nt = (d) => t(Object.fromEntries(LK.map(k => [k, `${NP[k]} ${d[k] ?? ''}`])));

function fbChoiceLabel(_match, choice) {
  const map = { a: '主胜', draw: '平局', b: '客胜' };
  return map[choice] || choice;
}

// 自动续费单个用户的函数
async function autoRenewUser(DB, user) {
  const now = new Date();
  const expireDate = user.v_expire_date ? new Date(user.v_expire_date.replace(' ', 'T') + 'Z') : null;
  const isVipValid = expireDate && expireDate > now;
  
  // 计算还有多久过期（毫秒）
  const timeUntilExpire = expireDate ? expireDate.getTime() - now.getTime() : Infinity;
  const oneDayInMs = 24 * 60 * 60 * 1000;
  
  // 如果未开启自动续费，直接返回
  if (!user.auto_rewn) return null;
  
  // 如果已经过期，或者距离过期还有不到 1 天，才执行续费
  const shouldRenew = !isVipValid || timeUntilExpire <= oneDayInMs;
  
  if (!shouldRenew) return null;

  const pp = user.price_plan ? JSON.parse(user.price_plan) : {};
  const mp = pp.monthly_discount || 10, ap = pp.annual_discount || 100;
  let dur, pr;
  
  if (user.balance >= ap) { dur = 365; pr = ap; }
  else if (user.balance >= mp) { dur = 30; pr = mp; }
  else return null;

  const lc = await DB.prepare('SELECT key, value FROM link WHERE key IN (?,?,?,?)').bind('clash_monthly','v2ray_monthly','clash_yearly','v2ray_yearly').all();
  const cfg = {}; lc.results.forEach(r => cfg[r.key] = r.value);
  const ne = new Date(); ne.setDate(ne.getDate() + dur);
  const vt = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const yr = dur === 365;
  const cl = user.v_link_clash || (yr ? cfg.clash_yearly : cfg.clash_monthly);
  const v2 = user.v_link_v2ray || (yr ? cfg.v2ray_yearly : cfg.v2ray_monthly);
  
  const r = await DB.prepare('UPDATE user SET balance = balance - ?, v_expire_date = ?, v_token = ?, v_link_clash = ?, v_link_v2ray = ? WHERE username = ?').bind(pr, ne.toISOString().slice(0,19).replace('T',' '), vt, cl, v2, user.username).run();
  
  if (r.success && r.meta.changes > 0) {
    const nowStr = new Date().toISOString().slice(0,19).replace('T',' ');
    
    // 给用户发送通知（多语言）
    await DB.prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)').bind(user.username, nt({
      cn: `您的VIP已自动续费成功！金额：${pr}元，天数：${dur}天`,
      en: `Your VIP has been automatically renewed successfully! Amount: ¥${pr}, Days: ${dur}`,
      jp: `VIPの自動更新が成功しました！金額：${pr}円、日数：${dur}日`,
      kr: `VIP 자동 갱신 성공! 금액: ¥${pr}, 일수: ${dur}일`,
      es: `¡Renovación automática de VIP exitosa! Monto: ¥${pr}, Días: ${dur}`,
      vi: `Gia hạn VIP tự động thành công! Số tiền: ¥${pr}, Ngày: ${dur}`,
      ar: `تم تجديد VIP تلقائيًا بنجاح! المبلغ: ¥${pr}, الأيام: ${dur}`,
      ru: `Автоматическое продление VIP успешно! Сумма: ¥${pr}, Дни: ${dur}`
    }), nowStr).run();
    
    // 给管理员发送通知（仅中文）
    await DB.prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)').bind('immmor', `用户 ${user.username} 自动续费VIP成功！金额：${pr}元，天数：${dur}天`, nowStr).run();
    
    return { username: user.username, amount: pr, days: dur };
  }
  
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ========== 1. 全局CORS跨域处理（前端无报错） ==========
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

      // ========== 发送邮箱验证码接口 ==========
      if (path === '/api/send-verify-code' && request.method === 'POST') {
        const params = await request.json();
        const { email } = params;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return resJson({ success: false, message: '请输入有效的邮箱地址！' }, 400);
        }

        // 检查频率限制：同一邮箱60秒内只能发送一次
        const lastSent = await DB.prepare('SELECT value FROM link WHERE key = ?').bind(`verify_code_time_${email}`).first();
        if (lastSent) {
          const elapsed = Date.now() - parseInt(lastSent.value);
          if (elapsed < 60000) {
            const remaining = Math.ceil((60000 - elapsed) / 1000);
            return resJson({ success: false, message: `请 ${remaining} 秒后再试！` }, 429);
          }
        }

        // 生成6位数字验证码
        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        const now = Date.now().toString();

        // 存储验证码和时间戳（5分钟有效）
        await DB.prepare('INSERT OR REPLACE INTO link (key, value) VALUES (?, ?)').bind(`verify_code_${email}`, verifyCode).run();
        await DB.prepare('INSERT OR REPLACE INTO link (key, value) VALUES (?, ?)').bind(`verify_code_time_${email}`, now).run();

        // 通过 Resend 发送验证码
        const RESEND_API_KEY = env.RESEND_API_KEY;
        if (!RESEND_API_KEY) {
          return resJson({ success: false, message: '邮件服务未配置，请联系管理员！' }, 500);
        }

        const emailSubject = 'PHANTOM VPN - 邮箱验证码';
        const emailHtml = `
          <div style="font-family: monospace; background: #050505; color: #00ff41; padding: 20px; max-width: 500px;">
            <h2 style="color: #00ff41; border-bottom: 1px solid #333; padding-bottom: 10px;">PHANTOM VPN</h2>
            <p style="color: #fff;">您的邮箱验证码是：</p>
            <div style="background: #111; border: 1px solid #00ff41; padding: 15px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #00ff41;">${verifyCode}</span>
            </div>
            <p style="color: #888; font-size: 12px;">此验证码有效期为 5 分钟，请勿泄露给他人。</p>
            <p style="color: #888; font-size: 12px;">如果您没有请求此验证码，请忽略此邮件。</p>
          </div>
        `;

        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'PHANTOM VPN <noreply@phantom.immmor.com>',
              to: [email],
              subject: emailSubject,
              html: emailHtml
            })
          });

          if (!resendResponse.ok) {
            const errorData = await resendResponse.json().catch(() => ({}));
            console.error('Resend API 错误:', errorData);
            return resJson({ success: false, message: '邮件发送失败，请稍后重试！' }, 500);
          }

          const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await DB.prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)').bind('immmor', `用户 ${email} 点击了获取验证码`, nowStr).run();

          return resJson({ success: true, message: '验证码已发送到您的邮箱！' });
        } catch (e) {
          console.error('发送邮件异常:', e);
          return resJson({ success: false, message: '邮件发送失败，请稍后重试！' }, 500);
        }
      }

      // ========== 验证邮箱验证码接口 ==========
      if (path === '/api/verify-code' && request.method === 'POST') {
        const params = await request.json();
        const { email, code } = params;

        if (!email || !code) {
          return resJson({ success: false, message: '邮箱和验证码不能为空！' }, 400);
        }

        const storedCode = await DB.prepare('SELECT value FROM link WHERE key = ?').bind(`verify_code_${email}`).first();

        if (!storedCode) {
          return resJson({ success: false, message: '请先获取验证码！' }, 400);
        }

        // 检查验证码是否过期（5分钟）
        const timeRow = await DB.prepare('SELECT value FROM link WHERE key = ?').bind(`verify_code_time_${email}`).first();
        if (timeRow) {
          const elapsed = Date.now() - parseInt(timeRow.value);
          if (elapsed > 5 * 60 * 1000) {
            // 验证码已过期，清理
            await DB.prepare('DELETE FROM link WHERE key = ?').bind(`verify_code_${email}`).run();
            await DB.prepare('DELETE FROM link WHERE key = ?').bind(`verify_code_time_${email}`).run();
            return resJson({ success: false, message: '验证码已过期，请重新获取！' }, 400);
          }
        }

        if (storedCode.value !== code) {
          return resJson({ success: false, message: '验证码错误！' }, 400);
        }

        // 验证成功：清理验证码，存储 verified 标记（5分钟有效，用于注册时校验）
        await DB.prepare('DELETE FROM link WHERE key = ?').bind(`verify_code_${email}`).run();
        await DB.prepare('DELETE FROM link WHERE key = ?').bind(`verify_code_time_${email}`).run();
        await DB.prepare('INSERT OR REPLACE INTO link (key, value) VALUES (?, ?)').bind(`verify_passed_${email}`, String(Date.now())).run();

        return resJson({ success: true, message: '验证成功！' });
      }

      // ========== 注册接口（核心）→ 用户名密码注册 ==========
      if (path === '/api/register' && request.method === 'POST') {
        const params = await request.json();
        const { username, password, inviteCode, securityAnswer, source, priceParam, fromGoogle, fromGithub, web3Address } = params;
        
        // 统一用小写处理 web3 地址
        const web3AddressLower = web3Address ? web3Address.toLowerCase() : '';
        
        if (!username || !password) {
          return resJson({ success: false, message: '用户名和密码不能为空！' }, 400);
        }

        // 校验邮箱格式：只能包含一个 @，且 @ 前后必须有内容
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(username)) {
          return resJson({ success: false, message: '邮箱格式不正确！' }, 400);
        }

        // 校验验证码：必须完成邮箱验证后才能注册（谷歌/GitHub 登录跳过此检查）
        if (!fromGoogle && !fromGithub) {
          const verifyPassed = await DB.prepare('SELECT value FROM link WHERE key = ?').bind(`verify_passed_${username}`).first();
          if (!verifyPassed) {
            return resJson({ success: false, message: '请先完成邮箱验证！' }, 400);
          }
          // 检查验证标记是否过期（5分钟）
          const verifyPassedTime = parseInt(verifyPassed.value);
          if (Date.now() - verifyPassedTime > 5 * 60 * 1000) {
            await DB.prepare('DELETE FROM link WHERE key = ?').bind(`verify_passed_${username}`).run();
            return resJson({ success: false, message: '验证已过期，请重新验证邮箱！' }, 400);
          }
        }

        // 检查用户是否已存在
        const existingUser = await DB
          .prepare('SELECT username FROM user WHERE username = ?')
          .bind(username)
          .first();

        if (existingUser) {
          return resJson({ success: false, message: '该邮箱已注册！' }, 409);
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

        let inviterUsername = null;

        // 如果提供了邀请码，检查邀请人是否存在并给予奖励
        if (inviteCode) {
          const inviterUser = await DB
            .prepare('SELECT * FROM user WHERE invite_code = ?')
            .bind(inviteCode)
            .first();

          if (inviterUser) {
            inviterUsername = inviterUser.username;
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
              .bind(username, nt({
                cn: `您使用邀请码 ${inviteCode} 注册成功，获得奖励 2 元`,
                en: `You registered using invite code ${inviteCode} and received a ¥2 reward`,
                jp: `招待コード ${inviteCode} を使用して登録し、2元の報酬を獲得しました`,
                kr: `초대 코드 ${inviteCode}를 사용하여 등록하고 2위안 보상을 받았습니다`,
                es: `Se registró con el código de invitación ${inviteCode} y recibió una recompensa de ¥2`,
                vi: `Bạn đã đăng ký bằng mã mời ${inviteCode} và nhận được phần thưởng 2 ¥`,
                ar: `لقد سجلت باستخدام رمز الدعوة ${inviteCode} وحصلت على مكافأة ¥2`,
                ru: `Вы зарегистрировались с кодом приглашения ${inviteCode} и получили вознаграждение ¥2`
              }), now)
              .run();

            // 给邀请人发送奖励通知
            await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind(inviterUser.username, nt({
                cn: `您的邀请用户 ${username} 已注册，您获得奖励 2 元`,
                en: `Your invitee ${username} has registered, you received a ¥2 reward`,
                jp: `招待したユーザー ${username} が登録しました。2元の報酬を獲得しました`,
                kr: `초대한 사용자 ${username} 님이 등록했습니다. 2위안 보상을 받았습니다`,
                es: `Su invitado ${username} se ha registrado, recibió una recompensa de ¥2`,
                vi: `Người được mời ${username} đã đăng ký, bạn nhận được phần thưởng 2 ¥`,
                ar: `قام المدعو ${username} بالتسجيل، لقد حصلت على مكافأة ¥2`,
                ru: `Приглашенный вами пользователь ${username} зарегистрировался, вы получили вознаграждение ¥2`
              }), now)
              .run();

            // 通知immmor有人邀请注册（邀请人不是immmor时才发）
            if (inviterUser.username !== 'immmor') {
              await DB
                .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
                .bind('immmor', nt({
                  cn: `用户 ${inviterUser.username} 成功邀请了 ${username} 注册`,
                  en: `User ${inviterUser.username} successfully invited ${username} to register`,
                  jp: `ユーザー ${inviterUser.username} が ${username} を招待して登録しました`,
                  kr: `사용자 ${inviterUser.username} 님이 ${username} 님을 초대하여 등록했습니다`,
                  es: `El usuario ${inviterUser.username} invitó exitosamente a ${username} a registrarse`,
                  vi: `Người dùng ${inviterUser.username} đã mời ${username} đăng ký thành công`,
                  ar: `قام المستخدم ${inviterUser.username} بدعوة ${username} للتسجيل بنجاح`,
                  ru: `Пользователь ${inviterUser.username} успешно пригласил ${username} зарегистрироваться`
                }), now)
                .run();
            }
          }
        }

        // 构建价格方案：如果提供了priceParam，使用对应的预定义价格
        const pricePlans = {
          'o': { monthly_original: 12, monthly_discount: 10, annual_original: 144, annual_discount: 100, annual_savings: 44 },
          't': { monthly_original: 25, monthly_discount: 20, annual_original: 300, annual_discount: 200, annual_savings: 100 },
          't3': { monthly_original: 37.5, monthly_discount: 30, annual_original: 450, annual_discount: 350, annual_savings: 100 },
          'f4': { monthly_original: 50, monthly_discount: 40, annual_original: 600, annual_discount: 450, annual_savings: 150 },
          'f': { monthly_original: 62.5, monthly_discount: 50, annual_original: 750, annual_discount: 550, annual_savings: 200 }
        };

        let pricePlanStr;
        if (priceParam && pricePlans[priceParam]) {
          pricePlanStr = JSON.stringify(pricePlans[priceParam]);
        } else {
          const defaultPrice = { monthly_original: 12, monthly_discount: 10, annual_original: 144, annual_discount: 100, annual_savings: 44 };
          const linkRows = await DB.prepare('SELECT key, value FROM link WHERE key LIKE ?').bind('price_%').all();
          linkRows.results.forEach(r => { if (r.value) defaultPrice[r.key.replace('price_', '')] = parseFloat(r.value); });
          pricePlanStr = JSON.stringify(defaultPrice);
        }

        // 根据前端传入的nt参数决定not_trusted值：nt=n时设为空字符串（信任）
        const notTrustedValue = params.nt === 'n' ? '' : 'yes';

        // 原子插入：利用数据库 UNIQUE 约束防止并发重复注册
        // 不再单独 SELECT 检查，直接 INSERT，由数据库保证原子性
        let result;
        try {
          result = await DB
            .prepare('INSERT INTO user (username, password, balance, v_expire_date, learn_vip_expire_date, monthly_quota, used_quota, quota_reset_date, invite_code, v_token, v_link_clash, v_link_v2ray, price_plan, survey, security_answer, fetch_link, source, not_trusted, auto_rewn, vorders, web3_address) VALUES (?, ?, ?, NULL, NULL, 307200, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
            .bind(username, password, finalBalance, new Date().toISOString().slice(0, 19).replace('T', ' '), userInviteCode, '', '', '', pricePlanStr, '{}', securityAnswer || '', '[]', source || '', notTrustedValue, '[]', web3AddressLower || '')
            .run();
        } catch (e) {
          // 捕获 UNIQUE 约束冲突 → 用户名已存在（并发注册竞争时触发）
          if (e.message && (e.message.includes('UNIQUE') || e.message.includes('constraint') || e.message.includes('duplicate'))) {
            return resJson({ success: false, message: '用户名已存在！' }, 409);
          }
          console.error('注册插入失败:', e);
          return resJson({ success: false, message: '注册失败，请重试！' }, 500);
        }

        if (result.success) {
          // 注册成功，清理验证标记
          await DB.prepare('DELETE FROM link WHERE key = ?').bind(`verify_passed_${username}`).run();

          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const msg = nt({
            cn: `用户 ${username} 注册成功！`,
            en: `User ${username} registered successfully!`,
            jp: `ユーザー ${username} が登録しました！`,
            kr: `사용자 ${username} 님이 등록했습니다!`,
            es: `¡El usuario ${username} se registró exitosamente!`,
            vi: `Người dùng ${username} đã đăng ký thành công!`,
            ar: `قام المستخدم ${username} بالتسجيل بنجاح!`,
            ru: `Пользователь ${username} успешно зарегистрировался!`
          });

          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind('immmor', msg, now)
            .run();

          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind(username, t({
              cn: '欢迎加入 Phantom',
              en: 'Welcome to Phantom',
              jp: 'Phantomへようこそ',
              kr: 'Phantom에 오신 것을 환영합니다',
              es: 'Bienvenido a Phantom',
              vi: 'Chào mừng bạn đến với Phantom',
              ar: 'مرحبًا بك في Phantom',
              ru: 'Добро пожаловать в Phantom'
            }), now)
            .run();

          await DB
            .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind(username, t({
              cn: '免费节点链接和付费节点链接不一样！！！！！',
              en: 'Free node links are different from paid node links!!!!!',
              jp: '無料ノードリンクと有料ノードリンクは異なります！！！！！',
              kr: '무료 노드 링크와 유료 노드 링크는 다릅니다！！！！！',
              es: '¡Los enlaces de nodos gratuitos son diferentes de los de pago!!!!!',
              vi: 'Liên kết node miễn phí khác với liên kết node trả phí!!!!!',
              ar: 'روابط العقد المجانية تختلف عن روابط العقد المدفوعة!!!!!',
              ru: 'Бесплатные ссылки на узлы отличаются от платных!!!!!'
            }), now)
            .run();

          const loginInfo = JSON.stringify([{
            type: 'register',
            time: now,
            ip: request.headers.get('CF-Connecting-IP') || 'unknown',
            device: request.headers.get('User-Agent') || 'unknown',
            acceptLanguage: request.headers.get('Accept-Language') || 'unknown',
            country: request.headers.get('CF-IPCountry') || 'unknown'
          }]);
          
          await DB
            .prepare('UPDATE user SET login_info = ? WHERE username = ?')
            .bind(loginInfo, username)
            .run();
          
          if (inviterUsername) {
            const inviter = await DB.prepare('SELECT invited_user FROM user WHERE username = ?').bind(inviterUsername).first();
            let invitedUsers = [];
            if (inviter?.invited_user) {
              try {
                invitedUsers = JSON.parse(inviter.invited_user);
              } catch (e) {}
            }
            const registerTime = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            invitedUsers.unshift({ username: username, registerTime: registerTime });
            await DB.prepare('UPDATE user SET invited_user = ? WHERE username = ?').bind(JSON.stringify(invitedUsers), inviterUsername).run();
          }
          
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

      // ========== 登录接口（核心）→ 用户名密码登录 ==========
      if (path === '/api/login' && request.method === 'POST') {
        const params = await request.json();
        const { username, password } = params;

        if (!username || !password) {
          return resJson({ success: false, message: '用户名和密码不能为空！' }, 400);
        }

        const user = await DB
          .prepare('SELECT rowid, username, balance, v_expire_date, price_plan, v_token, not_trusted, fetch_link, vorders FROM user WHERE username = ? AND password = ?')
          .bind(username, password)
          .first();

        if (user) {
          const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
          const loginInfoEntry = { type: 'login', time: now, ip: request.headers.get('CF-Connecting-IP') || 'unknown', device: request.headers.get('User-Agent') || 'unknown', acceptLanguage: request.headers.get('Accept-Language') || 'unknown', country: request.headers.get('CF-IPCountry') || 'unknown' };

          const loginInfo = await DB.prepare('SELECT login_info FROM user WHERE username = ?').bind(username).first();
          let updatedLoginInfo = JSON.stringify([loginInfoEntry]);
          if (loginInfo?.login_info) {
            try {
              const existingInfo = JSON.parse(loginInfo.login_info);
              existingInfo.unshift(loginInfoEntry);
              updatedLoginInfo = JSON.stringify(existingInfo.slice(0, 10));
            } catch (e) {}
          }
          await DB.prepare('UPDATE user SET login_info = ? WHERE username = ?').bind(updatedLoginInfo, username).run();

          const pricePlan = user.price_plan ? JSON.parse(user.price_plan) : { monthly_original: 12, monthly_discount: 10, annual_original: 144, annual_discount: 100, savings: 44 };

          return resJson({ success: true, message: '登录成功！', userInfo: { id: user.rowid, username: user.username, balance: user.balance, v_token: user.v_token, v_expire_date: user.v_expire_date, not_trusted: user.not_trusted || '', vorders: user.vorders }, pricePlan });
        } else {
          return resJson({ success: false, message: '用户名或密码错误' }, 401);
        }
      }

      // ========== Web3钱包登录接口 ==========
      if (path === '/api/web3-login' && request.method === 'POST') {
        const params = await request.json();
        const { address } = params;

        if (!address) {
          return resJson({ success: false, message: '请提供钱包地址！' }, 400);
        }

        // 统一用小写处理，避免大小写不匹配问题
        const addressLower = address.toLowerCase();

        const user = await DB
          .prepare('SELECT rowid, username, balance, v_expire_date, price_plan, v_token, not_trusted, fetch_link, vorders FROM user WHERE username = ? OR web3_address = ?')
          .bind(addressLower, addressLower)
          .first();

        if (user) {
          const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
          const loginInfoEntry = { type: 'login', time: now, ip: request.headers.get('CF-Connecting-IP') || 'unknown', device: request.headers.get('User-Agent') || 'unknown', acceptLanguage: request.headers.get('Accept-Language') || 'unknown', country: request.headers.get('CF-IPCountry') || 'unknown' };

          const loginInfo = await DB.prepare('SELECT login_info FROM user WHERE rowid = ?').bind(user.rowid).first();
          let updatedLoginInfo = JSON.stringify([loginInfoEntry]);
          if (loginInfo?.login_info) {
            try {
              const existingInfo = JSON.parse(loginInfo.login_info);
              existingInfo.unshift(loginInfoEntry);
              updatedLoginInfo = JSON.stringify(existingInfo.slice(0, 10));
            } catch (e) {}
          }
          await DB.prepare('UPDATE user SET login_info = ? WHERE rowid = ?').bind(updatedLoginInfo, user.rowid).run();

          const pricePlan = user.price_plan ? JSON.parse(user.price_plan) : { monthly_original: 12, monthly_discount: 10, annual_original: 144, annual_discount: 100, savings: 44 };

          return resJson({ success: true, message: '登录成功！', userInfo: { id: user.rowid, username: user.username, balance: user.balance, v_token: user.v_token, v_expire_date: user.v_expire_date, not_trusted: user.not_trusted || '', vorders: user.vorders }, pricePlan });
        } else {
          return resJson({ success: true, needRegister: true, address: address, message: '该钱包地址未注册，请完成注册！' });
        }
      }

      // ========== 谷歌快捷登录接口 ==========
      if (path === '/api/google-login' && request.method === 'POST') {
        const params = await request.json();
        const { token } = params;

        if (!token) {
          return resJson({ success: false, message: '请提供谷歌登录token！' }, 400);
        }

        try {
          const googleRes = await fetch('https://oauth2.googleapis.com/tokeninfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `access_token=${token}`
          });

          if (!googleRes.ok) {
            return resJson({ success: false, message: '谷歌token验证失败！' }, 401);
          }

          const googleData = await googleRes.json();
          const email = googleData.email;

          if (!email) {
            return resJson({ success: false, message: '无法获取谷歌账号邮箱！' }, 401);
          }

          const user = await DB
            .prepare('SELECT rowid, username, balance, v_expire_date, price_plan, v_token, not_trusted, fetch_link, vorders FROM user WHERE username = ?')
            .bind(email)
            .first();

          if (user) {
            const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            const loginInfoEntry = { type: 'login', time: now, ip: request.headers.get('CF-Connecting-IP') || 'unknown', device: request.headers.get('User-Agent') || 'unknown', acceptLanguage: request.headers.get('Accept-Language') || 'unknown', country: request.headers.get('CF-IPCountry') || 'unknown' };

            const loginInfo = await DB.prepare('SELECT login_info FROM user WHERE username = ?').bind(email).first();
            let updatedLoginInfo = JSON.stringify([loginInfoEntry]);
            if (loginInfo?.login_info) {
              try {
                const existingInfo = JSON.parse(loginInfo.login_info);
                existingInfo.unshift(loginInfoEntry);
                updatedLoginInfo = JSON.stringify(existingInfo.slice(0, 10));
              } catch (e) {}
            }
            await DB.prepare('UPDATE user SET login_info = ? WHERE username = ?').bind(updatedLoginInfo, email).run();

            const pricePlan = user.price_plan ? JSON.parse(user.price_plan) : { monthly_original: 12, monthly_discount: 10, annual_original: 144, annual_discount: 100, savings: 44 };

            return resJson({ success: true, message: '登录成功！', userInfo: { id: user.rowid, username: user.username, balance: user.balance, v_token: user.v_token, v_expire_date: user.v_expire_date, not_trusted: user.not_trusted || '', vorders: user.vorders }, pricePlan });
          } else {
            return resJson({ success: true, needRegister: true, email: email, message: '该谷歌账号未注册，请完成注册！' });
          }
        } catch (err) {
          return resJson({ success: false, message: '谷歌登录验证失败：' + err.message }, 500);
        }
      }

      // ========== GitHub OAuth Client ID 接口 ==========
      if (path === '/api/github-client-id' && request.method === 'GET') {
        const clientId = env.GITHUB_CLIENT_ID;
        if (!clientId) {
          return resJson({ success: false, message: 'GitHub登录未配置！' }, 500);
        }
        return resJson({ success: true, clientId });
      }

      // ========== GitHub 快捷登录接口 ==========
      if (path === '/api/github-login' && request.method === 'POST') {
        const params = await request.json();
        const { code, redirectUri } = params;

        if (!code || !redirectUri) {
          return resJson({ success: false, message: '请提供 GitHub 授权信息！' }, 400);
        }

        const clientId = env.GITHUB_CLIENT_ID;
        const clientSecret = env.GITHUB_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return resJson({ success: false, message: 'GitHub登录未配置！' }, 500);
        }

        try {
          const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri
            })
          });

          const tokenData = await tokenRes.json();
          if (tokenData.error || !tokenData.access_token) {
            return resJson({ success: false, message: 'GitHub token验证失败！' }, 401);
          }

          const emailsRes = await fetch('https://api.github.com/user/emails', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'PHANTOM-VPN'
            }
          });

          if (!emailsRes.ok) {
            return resJson({ success: false, message: '无法获取 GitHub 账号邮箱！' }, 401);
          }

          const emails = await emailsRes.json();
          const primaryEmail = emails.find(e => e.primary && e.verified)?.email
            || emails.find(e => e.verified)?.email;

          if (!primaryEmail) {
            return resJson({ success: false, message: '无法获取已验证的 GitHub 邮箱！' }, 401);
          }

          const email = primaryEmail;

          const user = await DB
            .prepare('SELECT rowid, username, balance, v_expire_date, price_plan, v_token, not_trusted, fetch_link, vorders FROM user WHERE username = ?')
            .bind(email)
            .first();

          if (user) {
            const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
            const loginInfoEntry = { type: 'login', time: now, ip: request.headers.get('CF-Connecting-IP') || 'unknown', device: request.headers.get('User-Agent') || 'unknown', acceptLanguage: request.headers.get('Accept-Language') || 'unknown', country: request.headers.get('CF-IPCountry') || 'unknown' };

            const loginInfo = await DB.prepare('SELECT login_info FROM user WHERE username = ?').bind(email).first();
            let updatedLoginInfo = JSON.stringify([loginInfoEntry]);
            if (loginInfo?.login_info) {
              try {
                const existingInfo = JSON.parse(loginInfo.login_info);
                existingInfo.unshift(loginInfoEntry);
                updatedLoginInfo = JSON.stringify(existingInfo.slice(0, 10));
              } catch (e) {}
            }
            await DB.prepare('UPDATE user SET login_info = ? WHERE username = ?').bind(updatedLoginInfo, email).run();

            const pricePlan = user.price_plan ? JSON.parse(user.price_plan) : { monthly_original: 12, monthly_discount: 10, annual_original: 144, annual_discount: 100, savings: 44 };

            return resJson({ success: true, message: '登录成功！', userInfo: { id: user.rowid, username: user.username, balance: user.balance, v_token: user.v_token, v_expire_date: user.v_expire_date, not_trusted: user.not_trusted || '', vorders: user.vorders }, pricePlan });
          } else {
            return resJson({ success: true, needRegister: true, email, message: '该 GitHub 账号未注册，请完成注册！' });
          }
        } catch (err) {
          return resJson({ success: false, message: 'GitHub登录验证失败：' + err.message }, 500);
        }
      }

      // ========== 视频通话TURN凭证接口 ==========
      if (path === '/api/video/ice-credentials' && request.method === 'GET') {
        const turnKeyId = env.TURN_KEY_ID;
        const turnApiToken = env.TURN_API_TOKEN;
        
        if (!turnKeyId || !turnApiToken) {
          return resJson({ success: false, message: 'TURN服务未配置' }, 500);
        }
        
        try {
          const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/generate-ice-servers`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${turnApiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ttl: 86400 })
          });
          
          if (!response.ok) {
            throw new Error(`TURN API error: ${response.status}`);
          }
          
          const iceData = await response.json();
          return resJson({ success: true, iceServers: iceData.iceServers });
        } catch (err) {
          return resJson({ success: false, message: '获取TURN凭证失败', error: err.message }, 500);
        }
      }

      // ========== 视频通话会话创建接口 ==========
      if (path === '/api/video/session' && request.method === 'POST') {
        const appId = env.TURN_APP_ID;
        
        if (!appId) {
          return resJson({ success: false, message: '视频服务未配置，请检查TURN_APP_ID' }, 500);
        }
        
        try {
          const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/new`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          const responseText = await response.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            throw new Error(`Cloudflare API错误: ${response.status} - ${responseText}`);
          }
          
          if (!response.ok) {
            throw new Error(data.error || data.message || data.errors?.[0]?.message || `Session API error: ${response.status}`);
          }
          
          return resJson({ success: true, sessionId: data.sessionId });
        } catch (err) {
          console.error('创建会话失败:', err);
          return resJson({ success: false, message: '创建会话失败', error: err.message }, 500);
        }
      }

      // ========== 视频通话Tracks接口（处理offer/answer） ==========
      if (path === '/api/video/tracks' && request.method === 'POST') {
        const appId = env.TURN_APP_ID;
        const params = await request.json();
        const { sessionId, sdp, type, trackName } = params;
        
        if (!appId || !sessionId) {
          return resJson({ success: false, message: '参数不完整' }, 400);
        }
        
        try {
          let url, method;
          const body = { sessionDescription: { sdp, type } };
          
          if (sdp) {
            url = `https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/${sessionId}/renegotiate`;
            method = 'PUT';
          } else {
            url = `https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/${sessionId}/tracks/new`;
            method = 'POST';
            delete body.sessionDescription;
            body.trackId = trackName || crypto.randomUUID();
            body.trackKind = 'video';
          }
          
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
          
          const responseText = await response.text();
          let result;
          try {
            result = JSON.parse(responseText);
          } catch {
            throw new Error(`Cloudflare API错误: ${response.status} - ${responseText}`);
          }
          
          if (!response.ok) {
            throw new Error(result.error || result.message || result.errors?.[0]?.message || `Tracks API error: ${response.status}`);
          }
          
          return resJson({ success: true, data: result });
        } catch (err) {
          console.error('处理Tracks失败:', err);
          return resJson({ success: false, message: '处理Tracks失败', error: err.message }, 500);
        }
      }

      if (path === '/api/check-security' && request.method === 'GET') {
        const username = url.searchParams.get('username');
        if (!username) return resJson({ code: 400, msg: '缺少username参数' }, 400);
        const user = await DB.prepare('SELECT security_answer FROM user WHERE username = ?').bind(username).first();
        if (!user) return resJson({ code: 404, msg: '用户不存在' }, 404);
        if (!user.security_answer) return resJson({ code: 400, msg: '该用户未设置密保问题' }, 400);
        return resJson({ code: 200, msg: '需要验证密保' });
      }

      if (path === '/api/reset-password' && request.method === 'POST') {
        const { username, securityAnswer, newPassword } = await request.json();
        if (!username || !securityAnswer || !newPassword) return resJson({ success: false, message: '参数不完整' }, 400);
        const user = await DB.prepare('SELECT security_answer FROM user WHERE username = ?').bind(username).first();
        if (!user) return resJson({ success: false, message: '用户不存在' }, 404);
        if (user.security_answer !== securityAnswer) return resJson({ success: false, message: '密保答案错误' }, 401);
        await DB.prepare('UPDATE user SET password = ? WHERE username = ?').bind(newPassword, username).run();
        return resJson({ success: true, message: '密码重置成功' });
      }

      if (path === '/api/get-user' && request.method === 'GET') {
        const name = url.searchParams.get('name');
        if (!name) return resJson({ code: 400, msg: '请传入name参数，例：?name=kkk' }, 400);
        
        const result = await DB
          .prepare('SELECT rowid as id, username, balance, v_expire_date, v_token, v_link_clash, v_link_v2ray, invite_code, source, vorders, free_expire_date, last_checkin FROM user WHERE username = ?')
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
      if (path === '/api/open-vip' && request.method === 'PUT') {
        try {
          const params = await request.json();
          const { username, duration = 30, price = 10.00 } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const vipPrice = parseFloat(price);
          
          const now = new Date();
          let newExpireDate = new Date();
          
          const linkConfig = await DB
            .prepare('SELECT key, value FROM link WHERE key IN (?, ?, ?, ?)')
            .bind('clash_monthly', 'v2ray_monthly', 'clash_yearly', 'v2ray_yearly')
            .all();
          
          const config = {};
          linkConfig.results.forEach(row => {
            config[row.key] = row.value;
          });
          
          const user = await DB
            .prepare('SELECT balance, v_expire_date, v_token, v_link_clash, v_link_v2ray, vorders FROM user WHERE username = ?')
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
          const vLinkClash = user.v_link_clash || (isYearly ? config.clash_yearly : config.clash_monthly);
          const vLinkV2ray = user.v_link_v2ray || (isYearly ? config.v2ray_yearly : config.v2ray_monthly);
          
          // 更新购买记录
          let vorders = [];
          try {
            vorders = JSON.parse(user.vorders || '[]');
          } catch (e) {
            vorders = [];
          }
          
          const newOrder = {
            type: 'vip',
            duration: duration,
            price: vipPrice,
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            method: 'balance',
            status: 'success'
          };
          
          vorders.unshift(newOrder);
          if (vorders.length > 50) vorders = vorders.slice(0, 50);
          const vordersStr = JSON.stringify(vorders);
          
          const result = await DB
            .prepare('UPDATE user SET balance = balance - ?, v_expire_date = ?, v_token = ?, v_link_clash = ?, v_link_v2ray = ?, vorders = ? WHERE username = ?')
            .bind(vipPrice, newExpireDate.toISOString().slice(0, 19).replace('T', ' '), vToken, vLinkClash, vLinkV2ray, vordersStr, username)
            .run();
          
          if (result.success && result.meta.changes > 0) {
            const nowTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const msg = nt({
              cn: `用户 ${username} 开通VIP成功！金额：${vipPrice}元，天数：${duration}天`,
              en: `User ${username} activated VIP successfully! Amount: ¥${vipPrice}, Days: ${duration}`,
              jp: `ユーザー ${username} がVIPをアクティブ化しました！金額：${vipPrice}元、期間：${duration}日`,
              kr: `사용자 ${username} 님이 VIP를 활성화했습니다! 금액: ¥${vipPrice}, 기간: ${duration}일`,
              es: `¡El usuario ${username} activó VIP exitosamente! Monto: ¥${vipPrice}, Días: ${duration}`,
              vi: `Người dùng ${username} đã kích hoạt VIP thành công! Số tiền: ¥${vipPrice}, Ngày: ${duration}`,
              ar: `قام المستخدم ${username} بتفعيل VIP بنجاح! المبلغ: ¥${vipPrice}، الأيام: ${duration}`,
              ru: `Пользователь ${username} успешно активировал VIP! Сумма: ¥${vipPrice}, Дней: ${duration}`
            });

            await DB
              .prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
              .bind('immmor', msg, nowTime)
              .run();
            
            const updatedUser = await DB
              .prepare('SELECT username, balance, v_expire_date, v_token, v_link_clash, v_link_v2ray, vorders FROM user WHERE username = ?')
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
                duration: duration,
                vorders: updatedUser.vorders
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

      // ========== 问卷接口 ==========
      if (path === '/api/survey' && request.method === 'POST') {
        try {
          const { username, key, value } = await request.json();
          if (!username || !key) return resJson({ code: 400, msg: '缺少参数' }, 400);
          const user = await DB.prepare('SELECT survey FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ code: 404, msg: '用户不存在' }, 404);
          const survey = user.survey ? JSON.parse(user.survey) : {};
          survey[key] = value;
          await DB.prepare('UPDATE user SET survey = ? WHERE username = ?').bind(JSON.stringify(survey), username).run();
          return resJson({ code: 200, msg: '提交成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '提交失败', error: err.message }, 500);
        }
      }

      // ========== 更新用户来源接口 ==========
      if (path === '/api/update-source' && request.method === 'PUT') {
        try {
          const { username, source } = await request.json();
          if (!username || !source) return resJson({ code: 400, msg: '缺少参数' }, 400);
          const user = await DB.prepare('SELECT source FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ code: 404, msg: '用户不存在' }, 404);
          if (user.source) return resJson({ code: 400, msg: '来源已设置' }, 400);
          await DB.prepare('UPDATE user SET source = ? WHERE username = ?').bind(source, username).run();
          return resJson({ code: 200, msg: '提交成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '提交失败', error: err.message }, 500);
        }
      }

      // ========== 查询用户VIP状态接口 ==========
      if (path === '/api/vip-status' && request.method === 'GET') {
        try {
          const username = url.searchParams.get('username');
          if (!username) return resJson({ code: 400, msg: '缺少username参数' }, 400);

          let user = await DB
            .prepare('SELECT username, v_expire_date, v_token, v_link_clash, v_link_v2ray, auto_rewn, balance, price_plan FROM user WHERE username = ?')
            .bind(username)
            .first();

          if (!user) return resJson({ code: 404, msg: '用户不存在' }, 404);

          const now = new Date();
          let expireDate = user.v_expire_date ? new Date(user.v_expire_date.replace(' ', 'T') + 'Z') : null;
          let isVipValid = expireDate && expireDate > now;
          let daysRemaining = isVipValid ? Math.max(0, Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

          if (!isVipValid && user.auto_rewn) {
            // 使用新的自动续费函数
            const result = await autoRenewUser(DB, user);
            if (result) {
              user = await DB
                .prepare('SELECT username, v_expire_date, v_token, v_link_clash, v_link_v2ray, auto_rewn, balance, price_plan FROM user WHERE username = ?')
                .bind(username)
                .first();
              expireDate = user.v_expire_date ? new Date(user.v_expire_date.replace(' ', 'T') + 'Z') : null;
              isVipValid = expireDate && expireDate > now;
              daysRemaining = isVipValid ? Math.max(0, Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
            }
          }

          return resJson({
            code: 200, msg: '查询成功',
            data: {
              username: user.username, v_expire_date: user.v_expire_date, v_token: user.v_token,
              v_link_clash: user.v_link_clash, v_link_v2ray: user.v_link_v2ray,
              is_vip_valid: isVipValid, days_remaining: daysRemaining, auto_renew: !!user.auto_rewn
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== 自动续费开关接口 ==========
      if (path === '/api/toggle-auto-renew' && request.method === 'PUT') {
        try {
          const { username, enabled } = await request.json();
          if (!username) return resJson({ code: 400, msg: '缺少username参数' }, 400);
          await DB.prepare('UPDATE user SET auto_rewn = ? WHERE username = ?').bind(enabled ? 1 : 0, username).run();
          return resJson({ code: 200, msg: 'ok', data: { auto_renew: !!enabled } });
        } catch (err) {
          return resJson({ code: 500, msg: '操作失败', error: err.message }, 500);
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

      // ========== 修改用户完整信息接口 ==========
      if (path === '/api/user/edit' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, password, balance, v_expire_date, learn_vip_expire_date, v_token, invite_code, v_link_clash, v_link_v2ray, not_trusted, login_info, price_plan, vorders, fetch_link, security_answer, auto_rewn, remark } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const user = await DB
            .prepare('SELECT rowid FROM user WHERE username = ?')
            .bind(username)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          const updates = [];
          const values = [];
          
          if (password !== undefined && password !== null && password !== '') {
            updates.push('password = ?');
            values.push(password);
          }
          if (balance !== undefined && balance !== null) {
            updates.push('balance = ?');
            values.push(balance);
          }
          if (v_expire_date !== undefined) {
            updates.push('v_expire_date = ?');
            values.push(v_expire_date);
          }
          if (learn_vip_expire_date !== undefined) {
            updates.push('learn_vip_expire_date = ?');
            values.push(learn_vip_expire_date);
          }
          if (v_token !== undefined) {
            updates.push('v_token = ?');
            values.push(v_token);
          }
          if (invite_code !== undefined) {
            updates.push('invite_code = ?');
            values.push(invite_code);
          }
          if (v_link_clash !== undefined) {
            updates.push('v_link_clash = ?');
            values.push(v_link_clash);
          }
          if (v_link_v2ray !== undefined) {
            updates.push('v_link_v2ray = ?');
            values.push(v_link_v2ray);
          }
          if (not_trusted !== undefined) {
            updates.push('not_trusted = ?');
            values.push(not_trusted);
          }
          if (price_plan !== undefined) {
            updates.push('price_plan = ?');
            values.push(price_plan);
          }
          if (login_info !== undefined) {
            updates.push('login_info = ?');
            values.push(login_info);
          }
          if (vorders !== undefined) {
            updates.push('vorders = ?');
            values.push(vorders);
          }
          if (fetch_link !== undefined) {
            updates.push('fetch_link = ?');
            values.push(fetch_link);
          }
          if (security_answer !== undefined) {
            updates.push('security_answer = ?');
            values.push(security_answer);
          }
          if (auto_rewn !== undefined) {
            updates.push('auto_rewn = ?');
            values.push(auto_rewn);
          }
          if (remark !== undefined) {
            updates.push('remark = ?');
            values.push(remark);
          }
          
          if (updates.length === 0) {
            return resJson({ code: 400, msg: '没有需要更新的字段' }, 400);
          }
          
          values.push(username);
          const sql = `UPDATE user SET ${updates.join(', ')} WHERE username = ?`;
          
          const result = await DB
            .prepare(sql)
            .bind(...values)
            .run();
          
          if (result.success) {
            return resJson({ code: 200, msg: '用户信息修改成功' });
          } else {
            return resJson({ code: 500, msg: '修改失败' }, 500);
          }
        } catch (err) {
          console.error('User edit error:', err);
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
            .prepare('SELECT v_expire_date, v_token, monthly_quota, used_quota, quota_reset_date, username, v_link_clash, fetch_link FROM user WHERE v_token = ?')
            .bind(vToken)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: 'Token无效' }, 404);
          }
          
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          
          if (!expireDate || expireDate < now) {
            const expiredConfig = `mixed-port: 7890
allow-lan: false
bind-address: "*"
mode: rule
log-level: info
dns:
  enable: true
  nameserver:
    - 1.1.1.1
    - 8.8.8.8
proxies:
  - name: "VIP-Expired-Server"
    type: vmess
    server: expired.phantom.immmor.com
    port: 443
    uuid: ${crypto.randomUUID()}
    alterId: 0
    cipher: auto
    tls: true
    servername: expired.phantom.immmor.com
proxy-groups:
  - name: "PROXY"
    type: select
    proxies:
      - "VIP-Expired-Server"
rules:
  - MATCH,PROXY`;
            return new Response(expiredConfig, {
              headers: {
                'Content-Type': 'text/yaml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': `attachment; filename="phantom-expired.yaml"`
              }
            });
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
          
          // 记录用户调用
          const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
          const fetchLink = user.fetch_link ? JSON.parse(user.fetch_link) : [];
          fetchLink.unshift({ type: 'vip', protocol: 'clash', fetchTime: beijingTime });
          if (fetchLink.length > 50) fetchLink.pop();
          await DB.prepare('UPDATE user SET fetch_link = ? WHERE username = ?').bind(JSON.stringify(fetchLink), user.username).run();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/yaml; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="phantom.yaml"`
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
            .prepare('SELECT v_expire_date, v_token, username, v_link_v2ray, fetch_link FROM user WHERE v_token = ?')
            .bind(vToken)
            .first();
          
          if (!user) {
            return resJson({ code: 404, msg: 'Token无效' }, 404);
          }
          
          const now = new Date();
          const expireDate = user.v_expire_date ? new Date(user.v_expire_date) : null;
          
          if (!expireDate || expireDate < now) {
            const v2rayConfig = JSON.stringify({
              v: '2',
              ps: 'VIP-Expired-Server',
              add: 'expired.phantom.immmor.com',
              port: '443',
              id: crypto.randomUUID(),
              aid: '0',
              net: 'ws',
              type: 'none',
              host: '',
              path: '',
              tls: 'tls',
              sni: 'expired.phantom.immmor.com'
            });
            const expiredConfig = 'vmess://' + btoa(v2rayConfig);
            return new Response(expiredConfig, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': `attachment; filename="phantom-expired.txt"`
              }
            });
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
          
          // 记录用户调用
          const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
          const fetchLink = user.fetch_link ? JSON.parse(user.fetch_link) : [];
          fetchLink.unshift({ type: 'vip', protocol: 'v2ray', fetchTime: beijingTime });
          if (fetchLink.length > 50) fetchLink.pop();
          await DB.prepare('UPDATE user SET fetch_link = ? WHERE username = ?').bind(JSON.stringify(fetchLink), user.username).run();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="phantom.txt"`
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '获取VIP节点配置失败', error: err.message }, 500);
        }
      }

      // ========== 签到接口 ==========
      if (path === '/api/checkin' && request.method === 'POST') {
        try {
          const { username } = await request.json();
          if (!username) return resJson({ code: 400, msg: '缺少username参数' }, 400);

          const user = await DB.prepare('SELECT last_checkin, free_expire_date FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ code: 404, msg: '用户不存在' }, 404);

          const today = new Date().toISOString().slice(0, 10);
          if (user.last_checkin === today) {
            return resJson({ code: 200, msg: '今日已签到', free_expire_date: user.free_expire_date });
          }

          const expireDate = user.free_expire_date 
            ? new Date(user.free_expire_date) 
            : new Date();
          expireDate.setDate(expireDate.getDate() + 1);

          await DB.prepare('UPDATE user SET last_checkin = ?, free_expire_date = ? WHERE username = ?')
            .bind(today, expireDate.toISOString().slice(0, 10), username).run();

          return resJson({ code: 200, msg: '签到成功，免费节点延长1天', free_expire_date: expireDate.toISOString().slice(0, 10) });
        } catch (err) {
          return resJson({ code: 500, msg: '签到失败', error: err.message }, 500);
        }
      }

      // ========== 免费节点接口 ==========
      if (path === '/free/clash' && request.method === 'GET') {
        try {
          let username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少 username 参数' }, 400);
          }
          
          // URL 解码用户名（处理邮箱等特殊字符）
          try {
            username = decodeURIComponent(username);
          } catch (e) {
            // 如果解码失败，使用原始值
          }
          
          // 验证用户是否存在并检查免费节点有效期
          const user = await DB.prepare('SELECT fetch_link, free_expire_date FROM user WHERE username = ?').bind(username).first();
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          // 检查免费节点是否过期
          const today = new Date().toISOString().slice(0, 10);
          if (!user.free_expire_date || user.free_expire_date < today) {
            const mockConfig = `mixed-port: 7890
allow-lan: true
mode: rule
log-level: info
dns:
  servers:
    - 8.8.8.8
    - 1.1.1.1
proxies:
  - name: "FREE_EXPIRED_SIGNIN_REQUIRED"
    type: vmess
    server: expired.freenode.local
    port: 8080
    uuid: 00000000-0000-0000-0000-000000000000
    alterId: 0
    cipher: auto
    tls: false
    skip-cert-verify: true
proxy-groups:
  - name: "🚀 免费节点已到期"
    type: select
    proxies:
      - FREE_EXPIRED_SIGNIN_REQUIRED
rules:
  - MATCH,🚀 免费节点已到期
`;
            return new Response(mockConfig, {
              headers: {
                'Content-Type': 'text/yaml; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment; filename="phantom-free.yaml"'
              }
            });
          }
          
          // 根据当前日期生成链接（获取昨天的配置文件）
          const now = new Date();
          // 减去1天获取昨天的日期
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const year = yesterday.getFullYear();
          const month = String(yesterday.getMonth() + 1).padStart(2, '0');
          const day = String(yesterday.getDate()).padStart(2, '0');
          
          const clashUrl = `https://node.clashnode.top/uploads/${year}/${month}/0-${year}${month}${day}.yaml`;
          
          // 获取 Clash 配置
          const response = await fetch(clashUrl);
          
          if (!response.ok) {
            return resJson({ code: 404, msg: '节点配置不存在' }, 404);
          }
          
          const configText = await response.text();
          
          // 记录用户调用
          const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
          const fetchLink = user.fetch_link ? JSON.parse(user.fetch_link) : [];
          fetchLink.unshift({ type: 'free', protocol: 'clash', fetchTime: beijingTime });
          if (fetchLink.length > 50) fetchLink.pop();
          await DB.prepare('UPDATE user SET fetch_link = ? WHERE username = ?').bind(JSON.stringify(fetchLink), username).run();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/yaml; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="phantom-free.yaml"`
            }
          });
        } catch (err) {
          return resJson({ code: 500, msg: '获取节点配置失败', error: err.message }, 500);
        }
      }

      if (path === '/free/v2ray' && request.method === 'GET') {
        try {
          let username = url.searchParams.get('username');
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少 username 参数' }, 400);
          }
          
          // URL 解码用户名（处理邮箱等特殊字符）
          try {
            username = decodeURIComponent(username);
          } catch (e) {
            // 如果解码失败，使用原始值
          }
          
          // 验证用户是否存在并检查免费节点有效期
          const user = await DB.prepare('SELECT fetch_link, free_expire_date FROM user WHERE username = ?').bind(username).first();
          if (!user) {
            return resJson({ code: 404, msg: '用户不存在' }, 404);
          }
          
          // 检查免费节点是否过期
          const today = new Date().toISOString().slice(0, 10);
          if (!user.free_expire_date || user.free_expire_date < today) {
            const mockConfig = `{
  "v": "2",
  "ps": "🚀 免费节点已到期",
  "add": "expired.freenode.local",
  "port": "8080",
  "id": "00000000-0000-0000-0000-000000000000",
  "aid": "0",
  "net": "tcp",
  "type": "none",
  "host": "",
  "path": "",
  "tls": ""
}`;
            return new Response(mockConfig, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment; filename="phantom-free.txt"'
              }
            });
          }
          
          // 根据当前日期生成链接（获取昨天的配置文件）
          const now = new Date();
          // 减去 1 天获取昨天的日期
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const year = yesterday.getFullYear();
          const month = String(yesterday.getMonth() + 1).padStart(2, '0');
          const day = String(yesterday.getDate()).padStart(2, '0');
          
          const v2rayUrl = `https://node.clashnode.top/uploads/${year}/${month}/0-${year}${month}${day}.txt`;
          
          // 获取 V2Ray 配置
          const response = await fetch(v2rayUrl);
          
          if (!response.ok) {
            return resJson({ code: 404, msg: '节点配置不存在' }, 404);
          }
          
          const configText = await response.text();
          
          // 记录用户调用
          const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
          const fetchLink = user.fetch_link ? JSON.parse(user.fetch_link) : [];
          fetchLink.unshift({ type: 'free', protocol: 'v2ray', fetchTime: beijingTime });
          if (fetchLink.length > 50) fetchLink.pop();
          await DB.prepare('UPDATE user SET fetch_link = ? WHERE username = ?').bind(JSON.stringify(fetchLink), username).run();
          
          return new Response(configText, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
              'Content-Disposition': `attachment; filename="phantom-free.txt"`
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
      if (path === '/api/reset-vtoken' && request.method === 'PUT') {
        try {
          const params = await request.json();
          const { username } = params;
          
          if (!username) {
            return resJson({ code: 400, msg: '缺少username参数' }, 400);
          }
          
          const now = new Date();
          
          const linkConfig = await DB
            .prepare('SELECT key, value FROM link WHERE key IN (?, ?, ?, ?)')
            .bind('clash_monthly', 'v2ray_monthly', 'clash_yearly', 'v2ray_yearly')
            .all();
          
          const config = {};
          linkConfig.results.forEach(row => {
            config[row.key] = row.value;
          });
          
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
            .bind(newVToken, config.clash_monthly, config.v2ray_monthly, username)
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
            const users = await DB
              .prepare('SELECT username FROM user')
              .all();

            if (!users.results || users.results.length === 0) {
              return resJson({ code: 404, msg: '暂无用户' }, 404);
            }

            const BATCH_SIZE = 30;
            let totalInserted = 0;

            for (let i = 0; i < users.results.length; i += BATCH_SIZE) {
              const batch = users.results.slice(i, i + BATCH_SIZE);
              const placeholders = batch.map(() => '(?, ?, ?, 0)').join(', ');
              const values = batch.flatMap(user => [user.username, content, now]);
              
              await DB
                .prepare(`INSERT INTO messages (username, content, created_at, is_read) VALUES ${placeholders}`)
                .bind(...values)
                .run();
              
              totalInserted += batch.length;
            }

            return resJson({
              code: 200,
              msg: '发送成功',
              data: {
                total: totalInserted,
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
          const all = url.searchParams.get('all');
          
          if (!username) {
            return resJson({ code: 400, msg: '请传入username参数' }, 400);
          }
          
          let messages;
          let unreadCount = 0;
          
          if (all === 'true') {
            const targetUser = url.searchParams.get('targetUser');
            if (targetUser) {
              messages = await DB
                .prepare('SELECT * FROM messages WHERE username = ? ORDER BY created_at DESC LIMIT 100')
                .bind(targetUser)
                .all();
              const unread = await DB
                .prepare('SELECT COUNT(*) as count FROM messages WHERE username = ? AND is_read = 0')
                .bind(targetUser)
                .first();
              unreadCount = unread?.count || 0;
            } else {
              messages = await DB
                .prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100')
                .all();
            }
          } else {
            messages = await DB
              .prepare('SELECT * FROM messages WHERE username = ? ORDER BY created_at DESC LIMIT 50')
              .bind(username)
              .all();
            
            const unread = await DB
              .prepare('SELECT COUNT(*) as count FROM messages WHERE username = ? AND is_read = 0')
              .bind(username)
              .first();
            unreadCount = unread?.count || 0;
          }
          
          return resJson({
            code: 200,
            msg: '查询成功',
            data: {
              messages: messages.results || [],
              unreadCount: unreadCount
            }
          });
        } catch (err) {
          console.error('获取消息错误:', err);
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      if (path === '/api/messages' && request.method === 'DELETE') {
        try {
          const params = await request.json();
          const { messageId } = params;
          
          if (!messageId) {
            return resJson({ code: 400, msg: '缺少必要参数' }, 400);
          }
          
          const result = await DB
            .prepare('DELETE FROM messages WHERE id = ?')
            .bind(messageId)
            .run();
          
          if (result.success) {
            return resJson({ code: 200, msg: '删除成功' });
          } else {
            return resJson({ code: 500, msg: '删除失败' }, 500);
          }
        } catch (err) {
          console.error('删除消息错误:', err);
          return resJson({ code: 500, msg: '删除失败', error: err.message }, 500);
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

      // ========== 获取订阅链接配置 ==========
      if (path === '/api/link/config' && request.method === 'GET') {
        try {
          const links = await DB
            .prepare('SELECT key, value FROM link WHERE key IN (?, ?, ?, ?)')
            .bind('clash_monthly', 'v2ray_monthly', 'clash_yearly', 'v2ray_yearly')
            .all();
          
          const config = {};
          links.results.forEach(row => {
            config[row.key] = row.value;
          });
          
          return resJson({
            code: 200,
            data: config
          });
        } catch (err) {
          console.error('获取链接配置错误:', err);
          return resJson({ code: 500, msg: '获取失败', error: err.message }, 500);
        }
      }

      // ========== 更新订阅链接配置 ==========
      if (path === '/api/link/update' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { key, value } = params;

          if (!key || !value) {
            return resJson({ code: 400, msg: '缺少必要参数' }, 400);
          }

          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

          const result = await DB
            .prepare('UPDATE link SET value = ?, updated_at = ? WHERE key = ?')
            .bind(value, now, key)
            .run();

          if (result.success && result.meta.changes > 0) {
            return resJson({ code: 200, msg: '更新成功' });
          } else {
            return resJson({ code: 500, msg: '更新失败' }, 500);
          }
        } catch (err) {
          console.error('更新链接配置错误:', err);
          return resJson({ code: 500, msg: '更新失败', error: err.message }, 500);
        }
      }

      // ========== 获取价格计划 ==========
      if (path === '/api/price-plan' && request.method === 'GET') {
        try {
          const rows = await DB.prepare('SELECT key, value FROM link WHERE key LIKE ?').bind('price_%').all();
          const plan = {};
          rows.results.forEach(r => plan[r.key.replace('price_', '')] = parseFloat(r.value) || 0);
          return resJson({ code: 200, data: plan });
        } catch (err) {
          return resJson({ code: 500, msg: '获取失败', error: err.message }, 500);
        }
      }

      // ========== 更新价格计划 ==========
      if (path === '/api/price-plan/update' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { monthly_original, monthly_discount, annual_original, annual_discount, savings } = params;
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const prices = { monthly_original, monthly_discount, annual_original, annual_discount, savings };
          for (const [key, value] of Object.entries(prices)) {
            if (value !== undefined) {
              await DB.prepare('INSERT OR REPLACE INTO link (key, value, updated_at) VALUES (?, ?, ?)')
                .bind(`price_${key}`, String(value), now).run();
            }
          }
          return resJson({ code: 200, msg: '更新成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '更新失败', error: err.message }, 500);
        }
      }

      // ========== 检测单个用户Clash链接 ==========
      if (path === '/api/clash-link' && request.method === 'GET') {
        const username = url.searchParams.get('username');
        if (!username) return resJson({ code: 400, msg: '缺少username参数' }, 400);
        const user = await DB.prepare('SELECT username, v_link_clash FROM user WHERE username = ?').bind(username).first();
        if (!user) return resJson({ code: 404, msg: '用户不存在' }, 404);
        if (!user.v_link_clash) return resJson({ code: 400, msg: '该用户无Clash链接' }, 400);
        try {
          const res = await fetch(user.v_link_clash);
          const info = res.headers.get('subscription-userinfo');
          return resJson({ code: 200, data: { username, link: user.v_link_clash, subscription_userinfo: info, ok: res.ok, status: res.status } });
        } catch (err) {
          return resJson({ code: 200, data: { username, link: user.v_link_clash, error: err.message } });
        }
      }

      // ========== 检测所有用户Clash链接 ==========
      if (path === '/api/clash-links' && request.method === 'GET') {
        const users = await DB.prepare('SELECT username, v_link_clash FROM user WHERE v_link_clash IS NOT NULL AND v_link_clash != ""').all();
        const results = [];
        for (const u of users.results || []) {
          if (!u.v_link_clash) continue;
          try {
            const res = await fetch(u.v_link_clash);
            const info = res.headers.get('subscription-userinfo');
            results.push({ username: u.username, link: u.v_link_clash, subscription_userinfo: info, ok: res.ok, status: res.status });
          } catch (err) {
            results.push({ username: u.username, link: u.v_link_clash, error: err.message });
          }
        }
        return resJson({ code: 200, data: results });
      }

      // ========== 获取所有节点链接 ==========
      if (path === '/api/links' && request.method === 'GET') {
        try {
          const links = await DB.prepare("SELECT * FROM link WHERE key LIKE 'node%' ORDER BY id DESC").all();
          return resJson({ code: 200, msg: '查询成功', data: links.results || [] });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      // ========== 添加或更新节点链接 ==========
      if (path === '/api/links' && request.method === 'POST') {
        try {
          const { key, value } = await request.json();
          if (!key || value === undefined) {
            return resJson({ code: 400, msg: '缺少key或value参数' }, 400);
          }
          const existing = await DB.prepare('SELECT * FROM link WHERE key = ?').bind(key).first();
          if (existing) {
            await DB.prepare('UPDATE link SET value = ?, updated_at = ? WHERE key = ?').bind(value, new Date().toISOString().slice(0, 19).replace('T', ' '), key).run();
          } else {
            await DB.prepare('INSERT INTO link (key, value) VALUES (?, ?)').bind(key, value).run();
          }
          return resJson({ code: 200, msg: '保存成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '保存失败', error: err.message }, 500);
        }
      }

      // ========== 删除节点链接 ==========
      if (path === '/api/links' && request.method === 'DELETE') {
        try {
          const { key } = await request.json();
          if (!key) return resJson({ code: 400, msg: '缺少key参数' }, 400);
          await DB.prepare('DELETE FROM link WHERE key = ?').bind(key).run();
          return resJson({ code: 200, msg: '删除成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '删除失败', error: err.message }, 500);
        }
      }

      // ========== node 表接口 ==========
      if (path === '/api/node' && request.method === 'GET') {
        try {
          const nodes = await DB.prepare('SELECT * FROM node ORDER BY id DESC').all();
          return resJson({ code: 200, data: nodes.results || [] });
        } catch (err) {
          return resJson({ code: 500, msg: '查询失败', error: err.message }, 500);
        }
      }

      if (path === '/api/node' && request.method === 'POST') {
        try {
          const { email, password, type, clash_link, v2ray_link, expire_date } = await request.json();
          if (!email || !password || !type || !clash_link || !v2ray_link) {
            return resJson({ code: 400, msg: '缺少必要参数' }, 400);
          }
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await DB.prepare('INSERT INTO node (email, password, type, clash_link, v2ray_link, expire_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(email, password, type, clash_link, v2ray_link, expire_date || '', now, now).run();
          return resJson({ code: 200, msg: '添加成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '添加失败', error: err.message }, 500);
        }
      }

      if (path === '/api/node' && request.method === 'PUT') {
        try {
          const { id, email, password, type, clash_link, v2ray_link, expire_date } = await request.json();
          if (!id) return resJson({ code: 400, msg: '缺少id参数' }, 400);
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await DB.prepare('UPDATE node SET email = ?, password = ?, type = ?, clash_link = ?, v2ray_link = ?, expire_date = ?, updated_at = ? WHERE id = ?')
            .bind(email, password, type, clash_link, v2ray_link, expire_date || '', now, id).run();
          return resJson({ code: 200, msg: '更新成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '更新失败', error: err.message }, 500);
        }
      }

      if (path === '/api/node' && request.method === 'DELETE') {
        try {
          const { id } = await request.json();
          if (!id) return resJson({ code: 400, msg: '缺少id参数' }, 400);
          await DB.prepare('DELETE FROM node WHERE id = ?').bind(id).run();
          return resJson({ code: 200, msg: '删除成功' });
        } catch (err) {
          return resJson({ code: 500, msg: '删除失败', error: err.message }, 500);
        }
      }

      // ========== 世界杯竞猜：获取比赛列表 ==========
      if (path === '/api/football/match' && request.method === 'GET') {
        try {
          const row = await DB.prepare('SELECT value FROM link WHERE key = ?').bind('fb_match').first();
          const matches = row?.value ? JSON.parse(row.value) : [];
          return resJson({ success: true, matches });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 世界杯竞猜：下注 ==========
      if (path === '/api/football/bet' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, password, choice, amount, matchId } = params;

          if (!username || !choice || !amount || matchId === undefined) {
            return resJson({ success: false, message: '参数不完整' }, 400);
          }
          if (!['a', 'draw', 'b'].includes(choice)) {
            return resJson({ success: false, message: '无效的选择' }, 400);
          }
          if (amount < 1) return resJson({ success: false, message: '下注金额至少1元' }, 400);

          // 验证用户是否存在
          const user = await DB.prepare('SELECT rowid, username, balance FROM user WHERE username = ?')
            .bind(username).first();
          if (!user) return resJson({ success: false, message: '请先登录' }, 401);

          // 查找指定比赛
          const fbRow = await DB.prepare('SELECT value FROM link WHERE key = ?').bind('fb_match').first();
          const matches = fbRow?.value ? JSON.parse(fbRow.value) : [];
          const matchData = matches.find(m => m.id == matchId);
          if (!matchData) return resJson({ success: false, message: '比赛不存在' }, 404);
          if (matchData.status !== 'open') return resJson({ success: false, message: '该比赛不在下注时间' }, 400);

          // 获取赔率
          const oddsMap = { a: 'oddsA', draw: 'oddsDraw', b: 'oddsB' };
          const odds = parseFloat(matchData[oddsMap[choice]] || '1');

          // 检查余额
          const amt = parseFloat(amount);
          if (user.balance < amt) return resJson({ success: false, message: '余额不足' }, 400);

          // 扣款 + 记录下注
          await DB.prepare('UPDATE user SET balance = balance - ? WHERE username = ?').bind(amt, username).run();

          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await DB.prepare('INSERT INTO football_bet (username, match_id, choice, amount, odds, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(username, matchId, choice, amt, odds, 'pending', now).run();

          return resJson({ success: true, message: `下注成功！${matchData.teamA} vs ${matchData.teamB} - ${fbChoiceLabel(matchData, choice)}，金额：${amount}，赔率：${odds}x` });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 世界杯竞猜：获取我的下注记录 ==========
      if (path === '/api/football/history' && request.method === 'POST') {
        try {
          const { username, password, all } = await request.json();
          if (!username) return resJson({ success: false, message: '请先登录' }, 401);

          const user = await DB.prepare('SELECT rowid FROM user WHERE username = ?')
            .bind(username).first();
          if (!user) return resJson({ success: false, message: '请先登录' }, 401);

          // 管理后台显式传 all=true 时查看全部，前台只返回当前用户记录
          let bets;
          if (all && username === 'immmor') {
            bets = await DB.prepare('SELECT * FROM football_bet ORDER BY id DESC LIMIT 200').all();
          } else {
            bets = await DB.prepare('SELECT * FROM football_bet WHERE username = ? ORDER BY id DESC LIMIT 50')
              .bind(username).all();
          }

          // 附带比赛信息
          const fbRow = await DB.prepare('SELECT value FROM link WHERE key = ?').bind('fb_match').first();
          const allMatches = fbRow?.value ? JSON.parse(fbRow.value) : [];
          const matchMap = {};
          allMatches.forEach(m => { matchMap[m.id] = m; });

          const enrichedBets = (bets.results || []).map(b => ({
            ...b,
            matchInfo: matchMap[b.match_id] || null
          }));

          return resJson({ success: true, bets: enrichedBets });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 世界杯竞猜：管理员设置结果（开奖） ==========
      if (path === '/api/football/settle' && request.method === 'POST') {
        try {
          const params = await request.json();
          const { username, password, result, matchId } = params;
          if (username !== 'immmor') return resJson({ success: false, message: '无权限' }, 403);
          if (!['a', 'draw', 'b'].includes(result)) return resJson({ success: false, message: '无效的结果' }, 400);
          if (matchId === undefined) return resJson({ success: false, message: '缺少 matchId' }, 400);

          // 读取并更新指定比赛
          const fbRow = await DB.prepare('SELECT value FROM link WHERE key = ?').bind('fb_match').first();
          let matches = fbRow?.value ? JSON.parse(fbRow.value) : [];
          const idx = matches.findIndex(m => m.id == matchId);
          if (idx === -1) return resJson({ success: false, message: '比赛不存在' }, 404);

          matches[idx].status = 'settled';
          matches[idx].result = result;
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await DB.prepare('UPDATE link SET value = ? WHERE key = ?')
            .bind(JSON.stringify(matches), 'fb_match').run();

          // 处理该比赛的 pending 下注
          const pendingBets = await DB.prepare("SELECT * FROM football_bet WHERE status = 'pending' AND match_id = ?")
            .bind(matchId).all();
          let totalPayout = 0;
          let winCount = 0;

          for (const bet of pendingBets.results || []) {
            const isWin = bet.choice === result;
            const payout = isWin ? parseFloat((bet.amount * bet.odds).toFixed(2)) : 0;
            const newStatus = isWin ? 'win' : 'lose';

            await DB.prepare('UPDATE football_bet SET status = ?, payout = ? WHERE id = ?')
              .bind(newStatus, payout, bet.id).run();

            if (isWin) {
              await DB.prepare('UPDATE user SET balance = balance + ? WHERE username = ?')
                .bind(payout, bet.username).run();
              totalPayout += payout;
              winCount++;

              await DB.prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
                .bind(bet.username, nt({
                  cn: `🎉 世界杯竞猜中奖！${matches[idx].teamA} vs ${matches[idx].teamB} - 您猜对了，获得 ¥${payout} 奖励`,
                  en: `🎉 World Cup bet won! ${matches[idx].teamA} vs ${matches[idx].teamB} - You guessed correctly and won ¥${payout}`,
                  jp: `🎉 ワールドカップ予想的中！${matches[idx].teamA} vs ${matches[idx].teamB} - 正解で ¥${payout} を獲得`,
                  kr: `🎉 월드컵 베팅 당첨! ${matches[idx].teamA} vs ${matches[idx].teamB} - 맞춰서 ¥${payout} 획득`,
                  es: `🎉 ¡Apuesta del Mundial ganada! ${matches[idx].teamA} vs ${matches[idx].teamB} - Acertaste y ganaste ¥${payout}`,
                  vi: `🎉 Dự đoán World Cup trúng thưởng! ${matches[idx].teamA} vs ${matches[idx].teamB} - Bạn đoán đúng và nhận được ¥${payout}`,
                  ar: `🎉 ربح الرهان على كأس العالم! ${matches[idx].teamA} vs ${matches[idx].teamB} - خمنت بشكل صحيح وفزت بـ ¥${payout}`,
                  ru: `🎉 Ставка на ЧМ выиграна! ${matches[idx].teamA} vs ${matches[idx].teamB} - Вы угадали и получили ¥${payout}`
                }), now).run();
            }
          }

          const resultLabel = fbChoiceLabel(matches[idx], result);
          await DB.prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)')
            .bind('immmor', `⚽ 竞猜开奖！${matches[idx].teamA} vs ${matches[idx].teamB} → 结果：${resultLabel}，派奖 ¥${totalPayout}，中奖 ${winCount} 人`, now).run();

          return resJson({
            success: true,
            message: `开奖完成！${matches[idx].teamA} vs ${matches[idx].teamB} 结果：${resultLabel}，中奖 ${winCount} 人，总派奖 ¥${totalPayout}`
          });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 世界杯竞猜：管理员重置比赛（新一轮） ==========
      if (path === '/api/football/reset' && request.method === 'POST') {
        try {
          const { username, password, matchId } = await request.json();
          if (username !== 'immmor') return resJson({ success: false, message: '无权限' }, 403);
          if (matchId === undefined) return resJson({ success: false, message: '缺少 matchId' }, 400);

          const fbRow = await DB.prepare('SELECT value FROM link WHERE key = ?').bind('fb_match').first();
          let matches = fbRow?.value ? JSON.parse(fbRow.value) : [];
          const idx = matches.findIndex(m => m.id == matchId);
          if (idx === -1) return resJson({ success: false, message: '比赛不存在' }, 404);

          matches[idx].status = 'open';
          matches[idx].result = '';
          matches[idx].score = '';
          await DB.prepare('UPDATE link SET value = ? WHERE key = ?')
            .bind(JSON.stringify(matches), 'fb_match').run();

          return resJson({ success: true, message: `${matches[idx].teamA} vs ${matches[idx].teamB} 已重置` });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 游戏中心：幸运转盘 ==========
      if (path === '/api/game/wheel' && request.method === 'POST') {
        try {
          const { username } = await request.json();
          if (!username) return resJson({ success: false, message: '请先登录' }, 401);

          const user = await DB.prepare('SELECT rowid, username, balance FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ success: false, message: '用户不存在' }, 404);

          const cost = 10;
          if (user.balance < cost) return resJson({ success: false, message: '余额不足' }, 400);

          const prizes = [3, 5, 5, 10, 10, 20, 50, 200];
          const weights = [0.25, 0.25, 0.18, 0.15, 0.08, 0.05, 0.03, 0.01];
          let r = Math.random();
          let prizeIndex = 0;
          for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) { prizeIndex = i; break; }
          }
          const prize = prizes[prizeIndex];
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

          await DB.prepare('UPDATE user SET balance = balance - ? + ? WHERE username = ?').bind(cost, prize, username).run();
          await DB.prepare('INSERT INTO game_bet (username, game_type, cost, prize, result, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(username, 'wheel', cost, prize, `¥${prize}`, now).run();

          return resJson({ success: true, prize, balance: user.balance - cost + prize });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 游戏中心：老虎机 ==========
      if (path === '/api/game/slot' && request.method === 'POST') {
        try {
          const { username } = await request.json();
          if (!username) return resJson({ success: false, message: '请先登录' }, 401);

          const user = await DB.prepare('SELECT rowid, username, balance FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ success: false, message: '用户不存在' }, 404);

          const cost = 20;
          if (user.balance < cost) return resJson({ success: false, message: '余额不足' }, 400);

          const symbols = ['🍒', '🍊', '🍋', '⭐', '💎', '7️⃣', '🔔'];
          const s1 = symbols[Math.floor(Math.random() * 7)];
          const s2 = symbols[Math.floor(Math.random() * 7)];
          const s3 = symbols[Math.floor(Math.random() * 7)];
          let prize = 0;

          if (s1 === s2 && s2 === s3) {
            if (s1 === '7️⃣') prize = 200;
            else if (s1 === '💎') prize = 100;
            else if (s1 === '⭐') prize = 50;
            else prize = 30;
          } else if (s1 === s2 || s2 === s3 || s1 === s3) {
            const pairSymbol = s1 === s2 ? s1 : (s2 === s3 ? s2 : s1);
            if (pairSymbol === '7️⃣') prize = 100;
            else if (pairSymbol === '💎') prize = 50;
            else if (pairSymbol === '⭐') prize = 25;
            else prize = 15;
          }

          const resultStr = (s1 === s2 && s2 === s3) ? `${s1}${s2}${s3}` : `${s1} ${s2} ${s3}`;
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

          await DB.prepare('UPDATE user SET balance = balance - ? + ? WHERE username = ?').bind(cost, prize, username).run();
          await DB.prepare('INSERT INTO game_bet (username, game_type, cost, prize, result, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(username, 'slot', cost, prize, resultStr, now).run();

          return resJson({ success: true, prize, symbols: [s1, s2, s3], balance: user.balance - cost + prize });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 游戏中心：刮刮乐 ==========
      if (path === '/api/game/scratch' && request.method === 'POST') {
        try {
          const { username } = await request.json();
          if (!username) return resJson({ success: false, message: '请先登录' }, 401);

          const user = await DB.prepare('SELECT rowid, username, balance FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ success: false, message: '用户不存在' }, 404);

          const cost = 15;
          if (user.balance < cost) return resJson({ success: false, message: '余额不足' }, 400);

          const prizes = [5, 10, 20, 50, 100, 200];
          const weights = [0.3, 0.25, 0.2, 0.15, 0.08, 0.02];
          let random = Math.random();
          let prize = 0;
          for (let i = 0; i < prizes.length; i++) {
            random -= weights[i];
            if (random <= 0) { prize = prizes[i]; break; }
          }

          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

          await DB.prepare('UPDATE user SET balance = balance - ? + ? WHERE username = ?').bind(cost, prize, username).run();
          await DB.prepare('INSERT INTO game_bet (username, game_type, cost, prize, result, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(username, 'scratch', cost, prize, `¥${prize}`, now).run();

          return resJson({ success: true, prize, balance: user.balance - cost + prize });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
        }
      }

      // ========== 游戏中心：获取游戏历史记录 ==========
      if (path === '/api/game/history' && request.method === 'POST') {
        try {
          const { username, gameType, all } = await request.json();
          if (!username) return resJson({ success: false, message: '请先登录' }, 401);

          const user = await DB.prepare('SELECT rowid FROM user WHERE username = ?').bind(username).first();
          if (!user) return resJson({ success: false, message: '用户不存在' }, 404);

          let query = 'SELECT * FROM game_bet';
          let params = [];
          if (all) {
            if (gameType) {
              query = 'SELECT * FROM game_bet WHERE game_type = ? ORDER BY id DESC LIMIT 100';
              params = [gameType];
            } else {
              query = 'SELECT * FROM game_bet ORDER BY id DESC LIMIT 100';
            }
          } else {
            if (gameType) {
              query = 'SELECT * FROM game_bet WHERE username = ? AND game_type = ? ORDER BY id DESC LIMIT 50';
              params = [username, gameType];
            } else {
              query = 'SELECT * FROM game_bet WHERE username = ? ORDER BY id DESC LIMIT 50';
              params = [username];
            }
          }

          const result = await DB.prepare(query).bind(...params).all();
          return resJson({ success: true, history: result.results || [] });
        } catch (err) {
          return resJson({ success: false, message: err.message }, 500);
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

  // ========== Cloudflare Worker 定时任务 ==========
  async scheduled(event, env, ctx) {
    console.log('定时任务开始执行:', new Date().toISOString());
    
    try {
      const DB = env.DB;
      if (!DB) {
        console.error('数据库绑定失败！');
        return;
      }
      
      // 计算过期前1天和当前时间
      const now = new Date();
      const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
      const oneDayLaterStr = oneDayLater.toISOString().slice(0, 19).replace('T', ' ');
      
      // 优化：直接在数据库层面过滤，只查询需要续费的用户
      // 条件：开启自动续费 且 (已过期 或 1天内过期)
      const usersResult = await DB
        .prepare(`
          SELECT username, v_expire_date, v_token, v_link_clash, v_link_v2ray, auto_rewn, balance, price_plan 
          FROM user 
          WHERE auto_rewn = 1 
          AND (v_expire_date IS NULL OR v_expire_date <= ?)
        `)
        .bind(oneDayLaterStr)
        .all();
      
      if (!usersResult.results || usersResult.results.length === 0) {
        console.log('没有需要自动续费的用户');
        return;
      }
      
      const users = usersResult.results;
      const results = [];
      
      console.log(`找到 ${users.length} 个可能需要续费的用户`);
      
      // 处理每个用户的自动续费
      for (const user of users) {
        try {
          const result = await autoRenewUser(DB, user);
          if (result) {
            results.push(result);
            console.log(`用户 ${user.username} 自动续费成功: ¥${result.amount}, ${result.days}天`);
          }
        } catch (err) {
          console.error(`处理用户 ${user.username} 时出错:`, err);
        }
      }
      
      console.log(`定时任务执行完成，共检查 ${users.length} 个用户，成功续费 ${results.length} 个用户`);
      
      // 如果有续费成功的用户，给管理员发送汇总通知（仅中文）
      if (results.length > 0) {
        const now = new Date().toISOString().slice(0,19).replace('T',' ');
        const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);
        await DB.prepare('INSERT INTO messages (username, content, created_at, is_read) VALUES (?, ?, ?, 0)').bind('immmor', `定时任务执行完成！共续费 ${results.length} 个用户，总金额 ¥${totalAmount}`, now).run();
      }
      
    } catch (err) {
      console.error('定时任务执行出错:', err);
    }
  },
};