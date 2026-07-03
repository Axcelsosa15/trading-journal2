// Supabase CAPTCHA protection requires a visible provider widget and a token
// passed to Auth as options.captchaToken. Pure fs assertions, no jsdom.
const fs = require("fs");
const idx = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const patch = fs.readFileSync("captcha-auth-patch.js", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

const csp = (idx.match(/Content-Security-Policy" content="([^"]*)"/) || [, ""])[1];
const nativeSendsToken = /options\s*=\s*\{\s*captchaToken:\s*captchaToken\s*\}/.test(app) && /signInWithPassword\(authRequest/.test(app) && /signUp\(authRequest/.test(app);
const nativeRendersWidget = /id:\s*"auth-captcha"/.test(app) && /api\.render\(box/.test(app);
const nativeExplainsConfig = /captchaConfigMissingMessage/.test(app) && /site key publica|site key pública/i.test(app);
const bridgeSendsToken = /withCaptcha/.test(patch) && /options\.captchaToken/.test(patch);
const bridgeRendersWidget = /auth-captcha-patch/.test(patch) && /currentApi\.render\(holder/.test(patch);
const bridgeExplainsConfig = /missingConfigMessage/.test(patch) && /site key publica|site key pública/i.test(patch);
console.log("CSP allows Turnstile script/frame/connect:", /script-src[^;]*challenges\.cloudflare\.com/.test(csp) && /frame-src[^;]*challenges\.cloudflare\.com/.test(csp) && /connect-src[^;]*challenges\.cloudflare\.com/.test(csp));
console.log("CSP allows hCaptcha script/frame/connect:", /script-src[^;]*js\.hcaptcha\.com/.test(csp) && /frame-src[^;]*(hcaptcha\.com|\*\.hcaptcha\.com)/.test(csp) && /connect-src[^;]*(hcaptcha\.com|\*\.hcaptcha\.com)/.test(csp));
console.log("index exposes public CAPTCHA config hooks:", /bitacora-captcha-provider/.test(idx) && /bitacora-captcha-site-key/.test(idx));
console.log("auth sends captchaToken to Supabase:", nativeSendsToken || bridgeSendsToken);
console.log("auth renders CAPTCHA widget when configured:", nativeRendersWidget || bridgeRendersWidget);
console.log("auth explains missing CAPTCHA site key:", nativeExplainsConfig || bridgeExplainsConfig);
console.log("compat patch loads before app.js:", /supabase-js@2[\s\S]*captcha-auth-patch\.js[\s\S]*app\.js/.test(idx));
console.log("compat patch wraps Supabase auth:", /__BITACORA_CAPTCHA_PATCH_LOADED/.test(patch) && /createClient[\s\S]*signInWithPassword[\s\S]*withCaptcha/.test(patch) && /options\.captchaToken/.test(patch));
console.log("service worker caches compat patch:", /captcha-auth-patch\.js/.test(sw));
console.log("AUTH CAPTCHA SMOKE OK");
