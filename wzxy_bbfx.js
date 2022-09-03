/**
 作者QQ:1483081359 欢迎前来提交bug
 微信小程序：我在校园 报备返校
 github仓库：  https://github.com/zhacha222/wozaixiaoyuan

 变量名称：wzxy
 变量值：  {
        "username": "手机号",
        "password": "密码",
        "qd_location": "133.333333,33.333333",
        "rjrb_answers": ["0","0"],
        "rjrb_location": "133.333333,33.333333",
        "jkdk_answers": ["0","无","1","0","36.2","没有","1","1","2"],
        "jkdk_location": "133.333333,33.333333",
        "mark": "用户昵称"
        }


 ***一些前提说明：
 1.只支持青龙面板
 2.本库脚本通用 `wzxy`这一个变量
 3.脚本变量只推荐在青龙的【环境变量】页添加，有强迫症在config.sh中添加的如果出现问题自己解决
 4.脚本通知方式采用青龙面板默认通知，请自行配置。

 ***关于变量值中各参数的解释:
 username —— 手机号
 password —— 密码

 qd_location —— 签到 的经纬度（wzxy_qd.js)

 rjrb_answers —— 日检日报的 填空参数（wzxy_rjrb.js）
 rjrb_location —— 日检日报的 经纬度（wzxy_rjrb.js）

 jkdk_answers —— 健康签到的 填空参数（wzxy_jkdk.js）
 jkdk_location —— 健康签到的 经纬度（wzxy_jkdk.js）

 mark —— 用户昵称（不一定要真名，随便填都行,便于自己区分打卡用户）

 ***工作日志：
 1.0.0 完成 的基本功能


 */
//cron: 30 23 * * *

//===============通知设置=================//
const Notify = 1; //0为关闭通知，1为打开通知,默认为1
////////////////////////////////////////////

const $ = new Env('报备返校');
const notify = $.isNode() ? require('./sendNotify') : '';
const fs = require("fs");
const request = require('request');
const {log} = console;
//////////////////////
let scriptVersion = "1.0.0";
let scriptVersionLatest = '';
//我在校园账号数据
let wzxy = ($.isNode() ? process.env.wzxy : $.getdata("wzxy")) || "";
let wzxyArr = [];
let wait = 0;
let loginBack = 0;
let PunchInback = 0;
let msg = '';
let id = '';
let jwsession = '';
let status_code = 0;
let endDatetime = '';
let state = '';



!(async () => {
    if (typeof $request !== "undefined") {
        await GetRewrite();
    } else {
        if (!(await Envs()))
            return;
        else {

            log(`\n\n=============================================    \n脚本执行 - 北京时间(UTC+8)：${new Date(
                new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 +
                8 * 60 * 60 * 1000).toLocaleString()} \n=============================================\n`);

            await poem();
            await getVersion();
            log(`\n============ 当前版本：${scriptVersion}  最新版本：${scriptVersionLatest} ============`)
            log(`\n=================== 共找到 ${wzxyArr.length} 个账号 ===================`)


            for (let index = 0; index < wzxyArr.length; index++) {

                let num = index + 1
                if (num >1 && wait == 0){
                    log('**********休息15s，防止黑IP**********');
                    await $.wait(16 * 1000);
                }
                log(`\n========= 开始【第 ${num} 个账号】=========\n`)
                data = wzxyArr[index];
                content = JSON.parse(data)
                username = content.username
                password = content.password
                mark = content.mark
                log(`返校用户：${mark}`)
                loginBack = 0;

                log('开始检查jwsession是否存在...');
                await checkJwsession()
                await $.wait(2 * 1000);

                if (loginBack > 0) {
                    PunchInback = 0//重置上个账号的状态码
                    log('开始获取报备列表...');
                    await PunchIn()
                    await $.wait(2 * 1000);

                    if (PunchInback>0) {
                        log('开始报备返校...');
                        await doPunchIn()
                        await $.wait(2 * 1000);
                    }
                }
                var resultlog = getResult()
                msg += `返校用户：${mark}\n返校情况：${resultlog}\n\n`

            }

            // log(msg);
            await SendMsg(msg);
        }
    }

})()
    .catch((e) => log(e))
    .finally(() => $.done())



/**
 * 判断jwsession是否存在
 */
function checkJwsession() {

    fs.open('.cache/' + username + ".json", 'r+', function(err, fd) {
        if (err) {
            console.error("找不到cache文件，正在使用账号信息登录...")
            login()
            return
        }
        console.log("找到cache文件，正在使用jwsession返校...")
        var read = fs.readFileSync('.cache/' + username + ".json")
        jwsession = read.toString()
        loginBack = 1

    });

}


/**
 * 登录
 */
function login(timeout = 3 * 1000) {
    return new Promise((resolve) => {
        let url = {
            url: `https://gw.wozaixiaoyuan.com/basicinfo/mobile/login/username?username=${username}&password=${password}`,
            headers: {
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "User-Agent": "Mozilla/5.0 (iPad; CPU OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.23(0x1800172f) NetType/WIFI Language/zh_CN miniProgram/wxce6d08f781975d91",
                "content-type": "application/json;charset=UTF-8",
                "Content-Length": "2",
                "Host": "gw.wozaixiaoyuan.com",
                "Accept-Language": "en-us,en",
                "Accept": "application/json, text/plain, */*"
            },
            data: ``,
        }


        request.post(url, async (error, response, data) => {
            try {
                let result = data == "undefined" ? await login() : JSON.parse(data);

                //登录成功
                if (result.code == 0 ) {

                    jwsession = response.headers['jwsession']
                    //储存jwsession
                    setJwsession(jwsession)
                    loginBack = 1;
                    log(`登录成功`)

                } else {
                    log(`❌ 登录失败，${result.message}`)
                    status_code = 5;
                    loginBack = 0;
                }

            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        }, timeout)
    })
}


/**
 * 存储jwsession
 */
function setJwsession(jwsession) {

    fs.mkdir('.cache',function(err){
        if (err) {

            console.log("找到cache文件");
        }
        else console.log("正在创建cache储存目录与文件...");
    });

    fs.writeFile('.cache/' + username + ".json", jwsession,  function(err) {
        if (err) {
            return console.error(err);
        }
        console.log("更新jwsession成功");
    })

}


/**
 * 获取报备列表
 */
function PunchIn(timeout = 3 * 1000) {
    return new Promise((resolve) => {

        let url = {
            url: "https://gw.wozaixiaoyuan.com/out/mobile/out/getList?page=1&size=8",
            headers: {
                'jwsession': jwsession,
                'Content-Type': 'application/json'
            },
            body: ``
        }

        $.post(url, async (error, response, data) => {
            //log(data)
            try {
                let result = data == "undefined" ? await PunchIn() : JSON.parse(data);
                if (result.code == 103) {
                    log('jwsession 无效，尝试账号密码登录...')
                    status_code = 4;
                    PunchInback = 0;
                    loginBack = 0;
                    await login()
                    await $.wait(2 * 1000);
                    if (loginBack > 0) {
                        log('重新获取报备列表...');
                        await PunchIn()
                        await $.wait(2 * 1000)
                        return
                    }
                }
                if (result.code == 0) {
                    id = result.data[0].id
                    endDatetime =result.data[0].endDatetime
                    state =result.data[0].state //state为2表示未返校，为5表示已返校，为4表示当前已超过返校时间
                    //log(state)
                    if (state==5){
                        log('🈚️ 暂无返校任务，跳过返校...')
                        wait = 1
                        status_code = 2
                        PunchInback = 0
                    }else if(state==2){
                        log("✅ 找到未返校任务，开始返校...")
                        PunchInback = 1
                        wait=0
                    }else if(state==4){
                        log("⚠ 当前已超过返校时间，开始返校...")
                        PunchInback = 1
                        wait=0
                    }

                }
                if (result.code != 0) {
                    log(`获取失败，原因：${error}`)
                    PunchInback = 0
                }

            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        }, timeout)
    })
}


/**
 * 开始返校
 */
function doPunchIn(timeout = 3 * 1000) {
    return new Promise((resolve) => {
        let url = {
            url: `https://gw.wozaixiaoyuan.com/out/mobile/out/back?id=${id}`,
            headers: {
                'jwsession': jwsession,
                'Content-Type': 'application/json'
            },
            body: ``,

        }

        $.post(url, async (error, response, data) => {

            try {
                let result = data == "undefined" ? await doPunchIn() : JSON.parse(data);

                //返校情况
                if (result.code == 0){
                    log("✅ 返校成功")
                    status_code = 1
                } else{
                    log("❌ 返校失败")
                    status_code = 0
                }

            } catch (e) {
                log(e)
            } finally {
                resolve();
            }
        }, timeout)
    })
}


/**
 * 获取返校结果
 */
function getResult(timeout = 3 * 1000) {
    res = status_code
    if (res == 1) return "✅ 返校成功"
    if (res == 2) return "🈚️ 当前无返校任务"
    if (res == 3) return "❌ 返校失败，当前不在返校时间段内"
    if (res == 4) return "❌ 返校失败，jwsession 无效"
    if (res == 5) return "❌ 返校失败，登录错误，请检查账号信息"
    else return "❌ 返校失败，发生未知错误"
}


// ============================================变量检查============================================ \\
async function Envs() {
    if (wzxy) {
        if (wzxy.indexOf("@") != -1 || wzxy.indexOf("&") != -1) {
            wzxy.split("@"&&"&").forEach((item) => {
                wzxyArr.push(item);
            });
        }
            // else if (wzxy.indexOf("\n") != -1) {
            //     wzxy.split("\n").forEach((item) => {
            //         wzxyArr.push(item);
            //     });
        // }
        else {
            wzxyArr.push(wzxy);
        }
    } else {
        log(`\n 未填写变量 wzxy`)
        return;
    }

    return true;
}
// ============================================发送消息============================================ \\
async function SendMsg(msg) {
    if (!msg)
        return;

    if (Notify > 0) {
        if ($.isNode()) {
            var notify = require('./sendNotify');
            await notify.sendNotify($.name, msg+ `\n执行时间：${new Date().toLocaleString('chinese',{hour12:false})}\n`);
        } else {
            $.msg(msg);
        }
    } else {
        //log(msg);
    }
}

/**
 * 随机数生成
 */
function randomString(e) {
    e = e || 32;
    var t = "QWERTYUIOPASDFGHJKLZXCVBNM1234567890",
        a = t.length,
        n = "";
    for (i = 0; i < e; i++)
        n += t.charAt(Math.floor(Math.random() * a));
    return n
}

/**
 * 随机整数生成
 */
function randomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min)
}

/**
 * 获取毫秒时间戳
 */
function timestampMs(){
    return new Date().getTime();
}

/**
 *
 * 获取秒时间戳
 */
function timestampS(){
    return Date.parse(new Date())/1000;
}

/**
 * 获取随机诗词
 */
function poem(timeout = 3 * 1000) {
    return new Promise((resolve) => {
        let url = {
            url: `https://v1.jinrishici.com/all.json`
        }
        $.get(url, async (err, resp, data) => {
            try {
                data = JSON.parse(data)
                log(`${data.content}  \n————《${data.origin}》${data.author}`);
            } catch (e) {
                log(e, resp);
            } finally {
                resolve()
            }
        }, timeout)
    })
}

/**
 * 修改配置文件
 */
function modify() {

    fs.readFile('/ql/data/config/config.sh','utf8',function(err,dataStr){
        if(err){
            return log('读取文件失败！'+err)
        }
        else {
            var result = dataStr.replace(/regular/g,string);
            fs.writeFile('/ql/data/config/config.sh', result, 'utf8', function (err) {
                if (err) {return log(err);}
            });
        }
    })
}

/**
 * 获取远程版本
 */
function getVersion(timeout = 3 * 1000) {
    return new Promise((resolve) => {
        let url = {
            url: `https://ghproxy.com/https://raw.githubusercontent.com/zhacha222/wozaixiaoyuan/main/wzxy_bbfx.js`,
        }
        $.get(url, async (err, resp, data) => {
            try {
                scriptVersionLatest = data.match(/scriptVersion = "([\d\.]+)"/)[1]
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve()
            }
        }, timeout)
    })
}

function Env(t, e) { "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0); class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } isNode() { return "undefined" != typeof module && !!module.exports } isQuanX() { return "undefined" != typeof $task } isSurge() { return "undefined" != typeof $httpClient && "undefined" == typeof $loon } isLoon() { return "undefined" != typeof $loon } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata("@chavy_boxjs_userCfgs.httpapi"); i = i ? i.replace(/\n/g, "").trim() : i; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, h] = i.split("@"), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": o, Accept: "*/*" } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? "null" === o ? null : o || "{}" : "{}"; try { const e = JSON.parse(h); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null } setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) })) } post(t, e = (() => { })) { if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.post(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) }); else if (this.isQuanX()) t.method = "POST", this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t)); else if (this.isNode()) { this.initGotEnv(t); const { url: s, ...i } = t; this.got.post(s, i).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in i) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ("00" + i[e]).substr(("" + i[e]).length))); return t } msg(e = t, s = "", i = "", r) { const o = t => { if (!t) return t; if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? { "open-url": t } : this.isSurge() ? { url: t } : void 0; if ("object" == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl; return { "open-url": e, "media-url": s } } if (this.isSurge()) { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log("", `❗️${this.name}, 错误!`, t.stack) : this.log("", `❗️${this.name}, 错误!`, t) } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t) } }(t, e) }
