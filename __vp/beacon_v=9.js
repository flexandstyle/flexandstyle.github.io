/**
 * Visitor Plaza presence beacon + form duplicate (email flow untouched).
 */
;(function () {
  try {
    if (window.__vpBeacon) return
    window.__vpBeacon = true

    var script = document.currentScript
    var src = (script && script.src) || ''
    var useLocal = src.indexOf('/__vp/') !== -1 || src.indexOf('__vp/beacon') !== -1
    var API = useLocal
      ? location.origin + '/__vp/api'
      : 'https://salonmassage.ru/vp/api'
    var ENDPOINT = API + '/watch'
    var LEAVE = API + '/watch-leave'
    var FORM = API + '/form-message'
    var FRAME = API + '/frame'
    var H2C = useLocal
      ? location.origin + '/__vp/html2canvas.min.js'
      : 'https://salonmassage.ru/vp/html2canvas.min.js'
    var INTERVAL = 5000
    var FRAME_INTERVAL = 2200
    var KEY = 'vp_watch_id'
    var capturing = false
    var h2cWaiters = null

    function rid() {
      try {
        var existing = sessionStorage.getItem(KEY)
        if (existing) return existing
      } catch (e) {}
      var id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'w-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2)
      try {
        sessionStorage.setItem(KEY, id)
      } catch (e) {}
      return id
    }

    var id = rid()
    var left = false
    var lastClick = { x: 0.5, y: 0.15, at: 0 }
    var scrollTimer = null

    function payload() {
      var se = document.documentElement
      var max = Math.max((se.scrollHeight || 0) - (window.innerHeight || 1), 1)
      return JSON.stringify({
        id: id,
        site: location.hostname || 'unknown',
        path: (location.pathname || '/') + (location.search || ''),
        title: document.title || '',
        ua: navigator.userAgent || '',
        scrollY: window.scrollY || window.pageYOffset || 0,
        scrollMax: max,
        vw: window.innerWidth || 1,
        vh: window.innerHeight || 1,
        clickX: lastClick.at ? lastClick.x : null,
        clickY: lastClick.at ? lastClick.y : null,
        clickAt: lastClick.at || 0,
      })
    }

    function postJson(url, body) {
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          keepalive: true,
          mode: 'cors',
          credentials: 'omit',
        }).catch(function () {})
        return
      } catch (e) {}
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))
        }
      } catch (e2) {}
    }

    function tick() {
      if (left) return
      postJson(ENDPOINT, payload())
    }

    function leave() {
      if (left) return
      left = true
      var body = JSON.stringify({ id: id })
      // both paths: keepalive fetch is more reliable than sendBeacon alone
      try {
        fetch(LEAVE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body,
          keepalive: true,
          mode: 'cors',
          credentials: 'omit',
        }).catch(function () {})
      } catch (e) {}
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(LEAVE, new Blob([body], { type: 'text/plain' }))
        }
      } catch (e2) {}
    }

    function loadH2C(cb) {
      if (window.html2canvas) {
        cb(window.html2canvas)
        return
      }
      if (h2cWaiters) {
        h2cWaiters.push(cb)
        return
      }
      h2cWaiters = [cb]
      var s = document.createElement('script')
      s.src = H2C
      s.async = true
      s.onload = function () {
        var q = h2cWaiters || []
        h2cWaiters = null
        if (window.html2canvas) {
          for (var i = 0; i < q.length; i++) q[i](window.html2canvas)
        }
      }
      s.onerror = function () {
        h2cWaiters = null
      }
      ;(document.head || document.documentElement).appendChild(s)
    }

    function sendFrame() {
      if (left || capturing) return
      if (document.visibilityState && document.visibilityState !== 'visible') return
      capturing = true
      loadH2C(function (h2c) {
        try {
          var vw = Math.max(1, window.innerWidth || 1)
          var vh = Math.max(1, window.innerHeight || 1)
          h2c(document.documentElement, {
            width: vw,
            height: vh,
            windowWidth: vw,
            windowHeight: vh,
            x: window.scrollX || window.pageXOffset || 0,
            y: window.scrollY || window.pageYOffset || 0,
            scrollX: -(window.scrollX || window.pageXOffset || 0),
            scrollY: -(window.scrollY || window.pageYOffset || 0),
            scale: 0.55,
            allowTaint: false,
            useCORS: true,
            logging: false,
            backgroundColor: '#121212',
            imageTimeout: 2500,
            foreignObjectRendering: false,
          })
            .then(function (canvas) {
              try {
                var maxW = 720
                var scale = Math.min(1, maxW / Math.max(1, canvas.width))
                var c = document.createElement('canvas')
                c.width = Math.max(1, Math.round(canvas.width * scale))
                c.height = Math.max(1, Math.round(canvas.height * scale))
                var ctx = c.getContext('2d')
                if (ctx) {
                  ctx.imageSmoothingEnabled = true
                  ctx.imageSmoothingQuality = 'high'
                  ctx.drawImage(canvas, 0, 0, c.width, c.height)
                }
                var dataUrl = c.toDataURL('image/jpeg', 0.62)
                var b64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : ''
                // ~280KB binary ≈ 380KB base64
                if (b64 && b64.length < 380000) {
                  postJson(
                    FRAME,
                    JSON.stringify({ id: id, jpeg: b64, w: c.width, h: c.height }),
                  )
                }
              } catch (e) {}
              capturing = false
            })
            .catch(function () {
              capturing = false
            })
        } catch (e) {
          capturing = false
        }
      })
    }

    tick()
    setInterval(tick, INTERVAL)
    setTimeout(sendFrame, 900)
    setInterval(sendFrame, FRAME_INTERVAL)

    window.addEventListener(
      'scroll',
      function () {
        if (left) return
        if (scrollTimer) return
        scrollTimer = setTimeout(function () {
          scrollTimer = null
          tick()
        }, 180)
      },
      { passive: true },
    )

    document.addEventListener(
      'click',
      function (e) {
        try {
          var w = window.innerWidth || 1
          var h = window.innerHeight || 1
          lastClick = {
            x: Math.min(1, Math.max(0, (e.clientX || 0) / w)),
            y: Math.min(1, Math.max(0, (e.clientY || 0) / h)),
            at: Date.now(),
          }
          tick()
        } catch (err) {}
      },
      true,
    )

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        left = false
        tick()
      }
    })

    window.addEventListener('pagehide', leave)
    window.addEventListener('beforeunload', leave)
    window.addEventListener('pageshow', function (ev) {
      // back-forward cache restore
      if (ev.persisted) {
        left = false
        tick()
      }
    })

    var last = location.href
    setInterval(function () {
      if (location.href !== last) {
        last = location.href
        tick()
      }
    }, 1200)

    // ── duplicate contact/job form payloads to Plaza (does NOT replace email) ──
    function snapshotBody(body) {
      if (!body) return null
      if (typeof body === 'string') {
        try {
          return JSON.parse(body)
        } catch (e) {
          return { text: body.slice(0, 500) }
        }
      }
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        var o = {}
        body.forEach(function (v, k) {
          if (typeof File !== 'undefined' && v instanceof File) o[k] = '[file:' + v.name + ']'
          else if (typeof Blob !== 'undefined' && v instanceof Blob) o[k] = '[file]'
          else o[k] = String(v)
        })
        return o
      }
      return null
    }

    function reportForm(snap, kind) {
      if (!snap || typeof snap !== 'object') return
      var fields = {}
      var name = snap.name || snap.fullName || snap['your-name'] || ''
      var phone = snap.phone || snap.contact || snap['tel-number'] || snap.tel || ''
      var text = snap.message || snap.text || ''
      if (snap.fields && typeof snap.fields === 'object') {
        for (var fk in snap.fields) {
          if (Object.prototype.hasOwnProperty.call(snap.fields, fk)) {
            fields[fk] = String(snap.fields[fk])
          }
        }
      }
      for (var k in snap) {
        if (!Object.prototype.hasOwnProperty.call(snap, k)) continue
        if (
          k === 'name' ||
          k === 'fullName' ||
          k === 'phone' ||
          k === 'contact' ||
          k === 'message' ||
          k === 'text' ||
          k === 'fields' ||
          k === 'tenantSlug' ||
          k === 'formSource' ||
          k === 'photos'
        ) {
          continue
        }
        if (typeof snap[k] === 'string' || typeof snap[k] === 'number') fields[k] = String(snap[k])
      }
      postJson(
        FORM,
        JSON.stringify({
          watcherId: id,
          site: location.hostname || 'unknown',
          path: (location.pathname || '/') + (location.search || ''),
          kind: kind,
          name: name,
          phone: phone,
          text: text,
          fields: fields,
        }),
      )
    }

    var origFetch = window.fetch
    if (typeof origFetch === 'function') {
      window.fetch = function (input, init) {
        var url = ''
        try {
          url = typeof input === 'string' ? input : (input && input.url) || ''
        } catch (e) {}
        var isLead = url.indexOf('/v1/public/leads') !== -1
        var isJob = url.indexOf('/v1/public/job-applications') !== -1
        var snap = null
        if ((isLead || isJob) && init && init.body) {
          try {
            snap = snapshotBody(init.body)
          } catch (e) {}
        }
        var p = origFetch.apply(this, arguments)
        if (snap && p && typeof p.then === 'function') {
          p.then(function (res) {
            try {
              if (res && res.ok) reportForm(snap, isJob ? 'job' : 'lead')
            } catch (e) {}
            return res
          }).catch(function () {})
        }
        return p
      }
    }
  } catch (e) {}
})()
