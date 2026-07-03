/* Supabase Auth CAPTCHA bridge.
 *
 * Keeps older cached builds working by wrapping Supabase Auth calls before
 * app.js creates its client. The native app.js CAPTCHA path takes priority when
 * it already sends options.captchaToken.
 */
(function () {
  "use strict";

  window.__BITACORA_CAPTCHA_PATCH_LOADED = true;

  var SCRIPT_SRC = {
    turnstile: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
  };
  var token = "";
  var widgetId = null;
  var scriptPromise = null;
  var patchAttempts = 0;

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? (el.getAttribute("content") || "").trim() : "";
  }
  function provider() {
    var raw = meta("bitacora-captcha-provider").toLowerCase();
    if (raw === "cloudflare" || raw === "cf-turnstile") return "turnstile";
    return raw;
  }
  function siteKey() { return meta("bitacora-captcha-site-key"); }
  function configured() { return !!(provider() && siteKey() && SCRIPT_SRC[provider()]); }
  function api() {
    if (provider() === "turnstile") return window.turnstile;
    if (provider() === "hcaptcha") return window.hcaptcha;
    return null;
  }
  function missingConfigMessage() {
    return "Supabase tiene CAPTCHA activo, pero falta configurar la site key pública en la app. Agrega el proveedor y la site key en index.html o desactiva CAPTCHA en Supabase mientras pruebas.";
  }
  function captchaRequired(msg) {
    return /captcha|captcha_token|hcaptcha|turnstile|request disallowed/i.test(msg || "");
  }
  function setError(msg) {
    var box = document.getElementById("auth-captcha-patch-error");
    if (!box) return;
    box.textContent = msg || "";
    box.style.display = msg ? "block" : "none";
  }
  function resetWidget(msg) {
    token = "";
    setError(msg || "");
    try {
      var currentApi = api();
      if (currentApi && widgetId != null && typeof currentApi.reset === "function") currentApi.reset(widgetId);
    } catch (e) { }
  }
  function loadScript() {
    if (!configured()) return Promise.reject(new Error(missingConfigMessage()));
    if (api()) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = SCRIPT_SRC[provider()];
      script.async = true;
      script.defer = true;
      script.setAttribute("data-bitacora-captcha-patch", provider());
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("captcha script failed")); };
      document.head.appendChild(script);
    });
    return scriptPromise;
  }
  function insertWidget() {
    if (!configured()) return;
    if (document.getElementById("auth-captcha") || document.getElementById("auth-captcha-patch")) return;
    var card = document.querySelector(".dc-modal");
    if (!card || !card.querySelector('input[type="password"]')) return;
    var buttons = Array.prototype.slice.call(card.querySelectorAll("button"));
    var submit = buttons.filter(function (btn) { return /Entrar|Crear cuenta|Un momento/.test(btn.textContent || ""); })[0];
    if (!submit) return;
    var wrap = document.createElement("div");
    wrap.id = "auth-captcha-patch";
    wrap.style.cssText = "margin-top:14px;";
    var holder = document.createElement("div");
    holder.id = "auth-captcha-patch-widget";
    holder.style.cssText = "min-height:72px;display:flex;align-items:center;justify-content:flex-start;";
    var error = document.createElement("div");
    error.id = "auth-captcha-patch-error";
    error.style.cssText = "display:none;margin-top:8px;font-size:12.5px;color:#8A5A00;background:#FFF6E2;border:1px solid #F2D49A;border-radius:9px;padding:9px 11px;line-height:1.35;";
    wrap.appendChild(holder);
    wrap.appendChild(error);
    card.insertBefore(wrap, submit.parentNode || submit);
    loadScript().then(function () {
      var currentApi = api();
      if (!currentApi || typeof currentApi.render !== "function") throw new Error("captcha api unavailable");
      widgetId = currentApi.render(holder, {
        sitekey: siteKey(),
        callback: function (captchaToken) {
          token = captchaToken || "";
          setError("");
        },
        "expired-callback": function () { resetWidget("La verificación expiró. Complétala otra vez."); },
        "error-callback": function () { resetWidget("No se pudo verificar el CAPTCHA. Inténtalo otra vez."); },
      });
    }).catch(function () {
      setError("No se pudo cargar el CAPTCHA. Revisa la conexión, extensiones del navegador o la configuración.");
    });
  }
  function wrappedError(message) {
    return { data: { user: null, session: null }, error: new Error(message) };
  }
  function withCaptcha(original) {
    return function (request) {
      request = request || {};
      var hasNativeToken = request.options && request.options.captchaToken;
      if (configured() && !hasNativeToken) {
        if (!token) return Promise.resolve(wrappedError("Completa la verificación CAPTCHA antes de continuar."));
        request.options = request.options || {};
        request.options.captchaToken = token;
      }
      return Promise.resolve(original.apply(this, arguments)).then(function (result) {
        if (result && result.error && captchaRequired(result.error.message)) {
          if (!configured()) result.error.message = missingConfigMessage();
          else resetWidget();
        }
        return result;
      }, function (err) {
        if (captchaRequired(err && err.message)) resetWidget();
        throw err;
      });
    };
  }
  function patchSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") return;
    if (window.supabase.__bitacoraCaptchaPatched) return;
    var createClient = window.supabase.createClient;
    window.supabase.createClient = function () {
      var client = createClient.apply(this, arguments);
      if (client && client.auth && !client.auth.__bitacoraCaptchaPatched) {
        if (typeof client.auth.signInWithPassword === "function") client.auth.signInWithPassword = withCaptcha(client.auth.signInWithPassword);
        if (typeof client.auth.signUp === "function") client.auth.signUp = withCaptcha(client.auth.signUp);
        client.auth.__bitacoraCaptchaPatched = true;
      }
      return client;
    };
    window.supabase.__bitacoraCaptchaPatched = true;
  }
  function patchSupabaseWhenReady() {
    patchSupabase();
    if (window.supabase && window.supabase.__bitacoraCaptchaPatched) return;
    if (patchAttempts++ < 50) window.setTimeout(patchSupabaseWhenReady, 100);
  }

  patchSupabaseWhenReady();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", insertWidget);
  else insertWidget();
  try {
    new MutationObserver(insertWidget).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { }
})();
