'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('M1.1 — Visão Geral mantém .u1-left-stack, .u1-side-stack e .u1-categories como irmãos diretos de .u1-main-grid', () => {
  const source = read('src/app.ts');
  const ast = ts.createSourceFile('src/app.ts', source, ts.ScriptTarget.ES2020, true);
  let overview = null;
  function walk(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'renderOverview') overview = node;
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert(overview, 'renderOverview() deve existir');
  const returned = overview.body.statements.find((s) => ts.isReturnStatement(s));
  assert(returned && ts.isCallExpression(returned.expression));

  const getClass = (call) => {
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== 'h') return '';
    const attrs = call.arguments[1];
    if (!ts.isObjectLiteralExpression(attrs)) return '';
    const prop = attrs.properties.find(
      (p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'className'
    );
    return prop && ts.isStringLiteral(prop.initializer) ? prop.initializer.text : '';
  };

  const rootChildren = Array.from(returned.expression.arguments).slice(2);
  const mainGrid = rootChildren.find((n) => getClass(n) === 'u1-main-grid');
  const detailGrid = rootChildren.find((n) => getClass(n) === 'u1-detail-grid');
  assert(mainGrid && ts.isCallExpression(mainGrid), '.u1-main-grid deve existir');
  assert(detailGrid && rootChildren.indexOf(detailGrid) > rootChildren.indexOf(mainGrid), '.u1-detail-grid deve suceder .u1-main-grid');

  const mainChildren = Array.from(mainGrid.arguments).slice(2);
  const mainClasses = mainChildren.map(getClass);
  assert.deepEqual(mainClasses, ['u1-left-stack', 'u1-side-stack', 'u1-panel u1-categories']);

  const leftChildren = Array.from(mainChildren[0].arguments).slice(2).map(getClass);
  assert.deepEqual(leftChildren, ['u1-panel u1-rhythm']);

  const sideChildren = Array.from(mainChildren[1].arguments).slice(2).map(getClass);
  assert.deepEqual(sideChildren, ['mf-plan-shortcut', 'u1-panel u1-budget']);
});

test('M1.1 — Últimas movimentações resolve ícones D05 por categoria/subcategoria sem usar seta genérica', () => {
  const source = read('src/app.ts');
  const overviewSlice = source.slice(source.indexOf('renderOverview()'), source.indexOf('renderTransactions()'));
  assert.match(overviewSlice, /resolveCategoryVisualIdentity\(\{categoryId:t\.categoryId,subcategoryId:t\.subcategoryId,categoryName:t\.category,catalog:state\.qa84VisualCatalog\|\|\[\]\}\)/);
  assert.match(overviewSlice, /h\(CategoryVisualGlyph,\{identity:txIdentity,size:18\}\)/);
  assert.doesNotMatch(overviewSlice, /u1-transaction-icon/);

  const assetsSrc = read('src/d05-visual-assets.ts');
  const js = ts.transpileModule(assetsSrc, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None }
  }).outputText;
  const { resolveCategoryVisualIdentity } = new Function(
    'const React={createElement:()=>null};const h=()=>null;' + js + ';return {resolveCategoryVisualIdentity};'
  )();

  assert.equal(resolveCategoryVisualIdentity({ categoryName: 'Assinaturas' }).iconKey, 'repeat-2');
  assert.equal(resolveCategoryVisualIdentity({ categoryName: 'Contas' }).iconKey, 'receipt-text');
  assert.equal(resolveCategoryVisualIdentity({ categoryName: 'Transporte' }).iconKey, 'car-front');
  assert.equal(resolveCategoryVisualIdentity({ categoryName: 'Alimentação' }).iconKey, 'utensils');
  assert.equal(resolveCategoryVisualIdentity({ categoryName: 'Moradia' }).iconKey, 'house');
  assert.equal(
    resolveCategoryVisualIdentity({ categoryId: 'cat:alimentacao', subcategoryId: 'sub:alimentacao/supermercados' }).iconKey,
    'shopping-basket'
  );
});

test('M1.1 — overview.css integra categorias em largura total, 2 colunas apenas >=1181px e libera espaço da FAB no rodapé', () => {
  const css = read('app/overview.css');
  assert.match(css, /\.u1-overview \.u1-main-grid > \.u1-categories\s*\{\s*grid-column:\s*1 \/ -1;/);
  assert.match(css, /@media \(min-width: 1181px\)\s*\{[\s\S]*?\.u1-overview \.u1-categories \.qa84-distribution-list:has\(> :nth-child\(2\)\)/);
  assert.match(css, /@media \(max-width: 1180px\)\s*\{[\s\S]*?\.u1-overview \.u1-side-stack\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)\s*\{[\s\S]*?\.u1-overview \.u1-side-stack\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.u1-shell > \.footer\s*\{\s*padding-right:\s*76px;/);
  assert.match(css, /\.u1-overview \.u1-context\s*\{[\s\S]*?z-index:\s*10/);
  assert.match(css, /\.u1-overview \.u1-source-stats\s*\{/);
});
