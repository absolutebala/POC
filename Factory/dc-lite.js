/* Minimal renderer for the Production Tower wireframes (static hosting). */
(function () {
  var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, source: 1, track: 1, wbr: 1 };
  var TAG = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  var ATTR = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  var HOLE = /\{\{([^}]+)\}\}/g;
  var WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/;

  function parseAttrs(s) {
    var out = [], m;
    ATTR.lastIndex = 0;
    while ((m = ATTR.exec(s))) {
      var v = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
      out.push({ name: m[1], value: v });
    }
    return out;
  }

  function parse(src) {
    var root = { tag: '#root', attrs: [], children: [] }, stack = [root], last = 0, m;
    function top() { return stack[stack.length - 1]; }
    TAG.lastIndex = 0;
    while ((m = TAG.exec(src))) {
      if (m.index > last) top().children.push({ text: src.slice(last, m.index) });
      last = TAG.lastIndex;
      if (m[0].lastIndexOf('<!--', 0) === 0) continue;
      if (m[1]) {
        var t = m[1].toLowerCase();
        for (var i = stack.length - 1; i > 0; i--) { if (stack[i].tag === t) { stack.length = i; break; } }
        continue;
      }
      var tag = m[2].toLowerCase(), node = { tag: tag, attrs: parseAttrs(m[3] || ''), children: [] };
      top().children.push(node);
      if (!VOID[tag] && !m[4]) stack.push(node);
    }
    if (last < src.length) top().children.push({ text: src.slice(last) });
    return root;
  }

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v = scope[parts[0]];
    for (var i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return v;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function attrOf(node, name) {
    for (var i = 0; i < node.attrs.length; i++) if (node.attrs[i].name === name) return node.attrs[i].value;
    return null;
  }

  function whole(raw, scope) {
    var m = raw == null ? null : raw.match(WHOLE);
    return m ? lookup(m[1], scope) : raw;
  }

  function render(node, scope, out, ctx) {
    if (node.text != null) {
      out.push(node.text.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? '' : esc(v); }));
      return;
    }
    var tag = node.tag, i;
    if (tag === 'helmet' || tag === 'script') return;
    if (tag === '#root') { for (i = 0; i < node.children.length; i++) render(node.children[i], scope, out, ctx); return; }
    if (tag === 'sc-for') {
      var list = whole(attrOf(node, 'list'), scope) || [], as = attrOf(node, 'as') || 'item';
      for (var k = 0; k < list.length; k++) {
        var s = Object.create(scope); s[as] = list[k]; s.$index = k;
        for (i = 0; i < node.children.length; i++) render(node.children[i], s, out, ctx);
      }
      return;
    }
    if (tag === 'sc-if') {
      if (whole(attrOf(node, 'value'), scope)) for (i = 0; i < node.children.length; i++) render(node.children[i], scope, out, ctx);
      return;
    }
    out.push('<' + tag);
    for (i = 0; i < node.attrs.length; i++) {
      var a = node.attrs[i], name = a.name, raw = a.value;
      if (name === 'className') name = 'class';
      if (name === 'htmlFor') name = 'for';
      if (raw == null) { out.push(' ' + name); continue; }
      var wm = raw.match(WHOLE);
      if (wm) {
        var v = lookup(wm[1], scope);
        if (/^on[A-Z]/.test(name)) {
          if (typeof v === 'function') {
            ctx.handlers.push(v);
            out.push(' data-dc-on-' + name.slice(2).toLowerCase() + '="' + (ctx.handlers.length - 1) + '"');
          }
          continue;
        }
        if (v === false || v == null) continue;
        if (v === true) { out.push(' ' + name); continue; }
        out.push(' ' + name + '="' + esc(v) + '"');
      } else if (raw.indexOf('{{') > -1) {
        out.push(' ' + name + '="' + raw.replace(HOLE, function (_, p) { var v2 = lookup(p, scope); return v2 == null ? '' : esc(v2); }) + '"');
      } else {
        out.push(' ' + name + '="' + raw + '"');
      }
    }
    out.push('>');
    if (VOID[tag]) return;
    for (i = 0; i < node.children.length; i++) render(node.children[i], scope, out, ctx);
    out.push('</' + tag + '>');
  }

  function DCLogic() {}
  DCLogic.prototype.setState = function (p) {
    var patch = typeof p === 'function' ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state || {}, patch);
    if (this.__render) this.__render();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };
  window.DCLogic = DCLogic;

  window.dcMount = function (template, Comp, el) {
    var tree = parse(template), c = new Comp();
    c.props = c.props || {};
    c.__render = function () {
      var ctx = { handlers: [] }, out = [];
      render(tree, c.renderVals ? c.renderVals() : {}, out, ctx);
      el.innerHTML = out.join('');
      var nodes = el.querySelectorAll('*');
      for (var i = 0; i < nodes.length; i++) {
        var attrs = nodes[i].attributes;
        for (var j = 0; j < attrs.length; j++) {
          var n = attrs[j].name;
          if (n.indexOf('data-dc-on-') === 0) nodes[i].addEventListener(n.slice(11), ctx.handlers[+attrs[j].value]);
        }
      }
    };
    c.__render();
    if (c.componentDidMount) c.componentDidMount();
    return c;
  };
})();
