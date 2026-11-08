const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const file = path.join(__dirname, '../src/components/PopupSheet.tsx');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
function harness(width, height) {
  const states = []; let cursor = 0;
  const exports = {};
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; }, useRef: () => ({ current: null }), useEffect() {} };
  const rn = { View: 'View', Modal: 'Modal', KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable', Platform: { OS: 'android' }, useWindowDimensions: () => ({ width, height }), StyleSheet: { create: x => x, absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } } };
  vm.runInNewContext(compiled.outputText, { exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'react-native') return rn;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) };
    if (name.includes('ModalChrome')) return { useModalChrome: () => ({ setBottomNavHidden() {} }) };
    if (name.includes('theme')) return { colors: {} };
    if (name.includes('LocalizedText')) return { Text: 'Text' };
    if (name.includes('vector-icons')) return { Ionicons: 'Icon' };
    throw Error(name);
  } });
  const props = { visible: true, stabilizeLayout: true, fitContent: true, title: 'Choose date', onClose() {} };
  const render = () => { cursor = 0; const child = exports.default(props); const modal = child.type(child.props); const overlay = modal.props.children.props.children; return { modal, overlay, panel: overlay.props.children }; };
  return { render, exports, props };
}
const style = element => Object.assign({}, ...element.props.style.filter(Boolean));
const layout = (element, value) => element.props.onLayout({ nativeEvent: { layout: value } });
for (const width of [320, 390, 430]) {
  const h = harness(width, 800); let r = h.render();
  assert.equal(r.modal.props.animationType, 'none'); assert.equal(style(r.panel).opacity, 0);
  // The reported left-side intermediate panel must never be exposed.
  layout(r.overlay, { width: 260, height: 500 }); layout(r.panel, { x: 0, y: 0, width: 260, height: 500 }); r.modal.props.onShow();
  r = h.render(); assert.equal(style(r.panel).opacity, 0); assert.equal(r.panel.props.pointerEvents, 'none');
  layout(r.overlay, { width, height: 800 }); layout(r.panel, { x: 0, y: 100, width, height: 400 });
  r = h.render(); assert.equal(style(r.panel).opacity, 0);
  layout(r.panel, { x: 0, y: 400, width, height: 400 }); r = h.render();
  assert.notEqual(style(r.panel).opacity, 0); assert.equal(style(r.panel).bottom, 0); assert.equal(r.panel.props.pointerEvents, 'auto');
  assert.equal(h.exports.default({ ...h.props, visible: false }), null);
  assert.equal(style(harness(width, 800).render().panel).opacity, 0, 'reopening must reset gate');
}
const tablet = harness(1000, 800); let r = tablet.render(); r.modal.props.onShow(); layout(r.overlay, { width: 1000, height: 800 }); layout(r.panel, { x: 190, y: 200, width: 620, height: 400 }); assert.notEqual(style(tablet.render().panel).opacity, 0);
const normal = harness(390, 800); normal.props.stabilizeLayout = false; normal.props.fitContent = false; assert.equal(normal.render().modal.props.animationType, 'slide');
console.log('PASS: first-frame visibility, narrow/mid-screen rejection, bottom anchoring, reopening, tablet positioning, and normal sheet animation.');
