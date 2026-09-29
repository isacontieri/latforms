// E2E da v3 (Fase 6), com 2 contextos (cliente e consultora): lista /admin ao vivo, amarelo em < 2 s, foco em azul,
// revertido sem amarelo, filtro, concluir → reabrir → aprovar, PDF, auditoria. Dados fictícios e limpeza no fim.
import { mkdirSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(`${RAIZ}/package.json`);
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('@playwright/test');
const Papa = require('papaparse');

const S = `${RAIZ}/test-results/e2e`; // capturas e PDFs gerados (fora do git)
mkdirSync(S, { recursive: true });
const APP = process.env.APP ?? 'http://localhost:3000';
const env = Object.fromEntries(readFileSync(`${RAIZ}/.env.local`, 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const linhas = Papa.parse(readFileSync(`${RAIZ}/tests/fixtures/rd-export.csv`, 'utf8').replace(/^sep=.*\r?\n/, ''), { header: true, skipEmptyLines: 'greedy' }).data
  .map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v ?? ''])));
const RD_IDS = linhas.map((l) => l.ID);
const ALVO = RD_IDS[2]; // Antônio Ribeiro Neto (fictício)

let falhas = 0;
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) falhas++; };
const aparece = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);
const email = `e2e-v3-${Date.now()}@example.com`, senha = `E2e#9a${randomBytes(9).toString('base64url')}`;
let userId = null, fichaId = null;
const importacoes = [];

const b = await chromium.launch();
try {
  await admin.from('clientes').delete().in('rd_id', RD_IDS);
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (eu) throw eu;
  userId = u.user.id;
  await admin.from('consultoras').insert({ id: userId, nome: 'Consultora Teste', email });

  const ctxF = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const f = await ctxF.newPage();
  const errosF = [];
  f.on('pageerror', (e) => errosF.push(e.message.slice(0, 200)));
  await f.goto(`${APP}/login`);
  await f.fill('input[name=email]', email); await f.fill('input[name=senha]', senha);
  await Promise.all([f.waitForURL(/\/admin/), f.click('button[type=submit]')]);

  const imp = await (await f.request.post(`${APP}/api/importacoes`, { data: { arquivoNome: 'rd-export.csv', totalLinhas: 4 } })).json();
  importacoes.push(imp.data.id);
  await f.request.post(`${APP}/api/importacoes/${imp.data.id}/lote`, { data: { inicio: 0, linhas } });
  const { data: cli } = await admin.from('clientes').select('id').eq('rd_id', ALVO).single();
  fichaId = (await (await f.request.post(`${APP}/api/fichas`, { data: { clienteId: cli.id } })).json()).data.id;
  const link = (await (await f.request.post(`${APP}/api/fichas/${fichaId}/link`)).json()).data.url;
  const statusNoPainel = (s, t = 5000) =>
    f.waitForFunction((s) => document.querySelector('aside [data-status]')?.getAttribute('data-status') === s, s, { timeout: t }).then(() => true).catch(() => false);

  console.log('Fase 6 — lista ao vivo:');
  await f.goto(`${APP}/admin`);
  const linhaLista = f.locator(`tr[data-ficha="${fichaId}"]`);
  ok(await aparece(linhaLista), 'ficha aparece em "Fichas em andamento"');
  ok((await linhaLista.locator('[data-status]').getAttribute('data-status')) === 'enviada', 'lista: status "enviada"');
  await f.waitForTimeout(2000); // canal assinado

  const c = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await c.goto(link); await c.waitForFunction(() => document.querySelectorAll('[data-campo="nome"]').length === 1, null, { timeout: 60000 });
  ok(await aparece(linhaLista.locator('[data-online="true"]'), 8000), 'lista: cliente online (presença ao vivo)');
  ok(await f.waitForFunction((id) => document.querySelector(`tr[data-ficha="${id}"] [data-status]`)?.getAttribute('data-status') === 'aberta', fichaId, { timeout: 8000 }).then(() => true).catch(() => false),
    'lista: vira "aberta" sem recarregar');

  console.log('Fase 6 — painel da ficha:');
  await f.goto(`${APP}/admin/fichas/${fichaId}`);
  await f.locator('[data-campo="convenioMedico"]').first().waitFor({ timeout: 60000 });
  ok(await aparece(f.getByText('Ao vivo — atualiza sozinho')), 'painel conectado ao canal privado');
  ok(await f.locator('[data-campo="nome"]').isDisabled(), 'consultora só visualiza (campos desabilitados)');

  // foco → azul
  await c.locator('[data-campo="convenioMedico"]').click();
  let t0 = Date.now();
  const azul = await f.waitForFunction(() => document.querySelector('[data-campo="convenioMedico"]')?.classList.contains('ficha-editando'), null, { timeout: 5000 }).then(() => true).catch(() => false);
  ok(azul, `foco do cliente aparece em azul (${Date.now() - t0} ms)`);
  const contorno = await f.locator('[data-campo="convenioMedico"]').evaluate((e) => getComputedStyle(e).outlineColor);
  ok(contorno === 'rgb(37, 99, 235)', `contorno azul #2563eb (${contorno})`);

  // edição → amarelo em < 2 s depois do salvamento
  await c.locator('[data-campo="convenioMedico"]').fill('Unimed Nacional');
  t0 = Date.now();
  const amarelo = await f.waitForFunction(() => {
    const e = document.querySelector('[data-campo="convenioMedico"]');
    return e?.classList.contains('ficha-alterado') && e.value === 'Unimed Nacional';
  }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  const ms = Date.now() - t0;
  ok(amarelo && ms < 2800, `alteração aparece em amarelo (${ms} ms após digitar, dos quais 800 ms são a espera do autosave)`);
  await f.waitForTimeout(2300); // fim do destaque de 2 s
  const fundo = await f.locator('[data-campo="convenioMedico"]').evaluate((e) => getComputedStyle(e).backgroundColor);
  ok(fundo === 'rgb(255, 229, 143)', `fundo amarelo #ffe58f (${fundo})`);
  ok((await f.getByTestId('n-alterados').textContent()) === '1', 'contador: 1 alterado');
  ok(await aparece(f.getByTestId('historico').getByText('Unimed Nacional')), 'histórico mostra a alteração');
  ok((await f.locator('[data-campo="convenioMedico"]').getAttribute('title'))?.startsWith('Antes:'), 'dica "Antes: …" no campo alterado');

  // revertido ao original → sem amarelo, histórico registra
  const { data: fx0 } = await admin.from('fichas').select('dados_originais').eq('id', fichaId).single();
  const original = fx0.dados_originais.estadoCivil ?? '';
  const outro = original === 'Viúvo' ? 'Casado' : 'Viúvo';
  await c.locator('[data-campo="estadoCivil"]').selectOption(outro);
  await f.waitForFunction(() => document.querySelector('[data-campo="estadoCivil"]')?.classList.contains('ficha-alterado'), null, { timeout: 5000 }).catch(() => {});
  await c.locator('[data-campo="estadoCivil"]').selectOption(original);
  await f.waitForTimeout(1500);
  const semAmarelo = !(await f.locator('[data-campo="estadoCivil"]').evaluate((e) => e.classList.contains('ficha-alterado')));
  const nHist = await f.getByTestId('historico').locator('li').count();
  ok(semAmarelo && nHist === 3, `revertido ao original: sem amarelo, histórico com ${nHist} entradas (esperado 3)`);

  await f.getByLabel('Mostrar só alterados').check();
  ok(await f.locator('[data-campo="nome"]').evaluate((e) => e.classList.contains('ficha-esmaecido')), '"Mostrar só alterados" esmaece os demais');
  await f.getByLabel('Mostrar só alterados').uncheck();

  await c.locator('[data-campo="nome"]').click();
  await f.waitForFunction(() => document.querySelector('[data-campo="nome"]')?.classList.contains('ficha-editando'), null, { timeout: 5000 }).catch(() => {});
  ok(!(await f.locator('[data-campo="convenioMedico"]').evaluate((e) => e.classList.contains('ficha-editando'))), 'azul acompanha o campo atual');

  // recarregar o painel mantém o estado (banco é a fonte da verdade)
  await f.reload(); await f.waitForFunction(() => document.querySelectorAll('[data-campo="convenioMedico"]').length === 1, null, { timeout: 60000 });
  ok(await f.locator('[data-campo="convenioMedico"]').evaluate((e) => e.classList.contains('ficha-alterado')), 'recarregar o painel mantém o amarelo');

  console.log('Fase 6 — concluir, reabrir, aprovar:');
  await c.waitForTimeout(1200);
  await c.getByRole('button', { name: 'Concluir ficha' }).click();
  ok(await aparece(c.getByText('Ficha enviada, obrigado!')), 'cliente conclui');
  ok(await statusNoPainel('concluida'), 'painel mostra "Concluída" sem recarregar');
  ok(await aparece(f.getByRole('button', { name: 'Aprovar ficha' })), 'botão "Aprovar ficha" aparece');

  await f.getByRole('button', { name: 'Reabrir para o cliente' }).click();
  await f.getByRole('button', { name: 'Sim' }).click();
  ok(await statusNoPainel('em_preenchimento'), 'reabrir → "em preenchimento"');
  await c.reload(); await c.waitForFunction(() => document.querySelectorAll('[data-campo="nome"]').length === 1, null, { timeout: 60000 });
  ok(!(await c.locator('[data-campo="nome"]').isDisabled()), 'cliente volta a editar pelo mesmo link');
  await c.getByRole('button', { name: 'Concluir ficha' }).click();
  await aparece(c.getByText('Ficha enviada, obrigado!'));
  await statusNoPainel('concluida');
  await f.getByRole('button', { name: 'Aprovar ficha' }).click();
  ok(await statusNoPainel('aprovada'), 'aprovar → "aprovada"');
  const pdf = await f.request.get(`${APP}/api/fichas/${fichaId}/pdf`);
  ok(pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === '%PDF', 'PDF final baixa');
  const pdfCli = await fetch(`${link.replace('/f/', '/api/f/')}/pdf`);
  ok(pdfCli.status === 200, `cliente baixa cópia da ficha aprovada (${pdfCli.status})`);
  const { data: aud } = await admin.from('auditoria').select('acao').eq('ficha_id', fichaId);
  const acoes = aud.map((a) => a.acao);
  ok(['ficha_reaberta', 'ficha_aprovada', 'cliente_concluiu_ficha'].every((a) => acoes.includes(a)), 'auditoria registra concluir, reabrir e aprovar');
  ok((await f.request.post(`${APP}/api/fichas/${fichaId}/aprovar`)).status() === 409, 'aprovar de novo → 409');
  const anon = await fetch(`${APP}/api/fichas/${fichaId}/cancelar`, { method: 'POST' });
  ok(anon.status === 401 || anon.status === 403, `cancelar sem login → ${anon.status}`);
  await f.screenshot({ path: `${S}/f6-painel.png` });
  ok(errosF.length === 0, `sem erros no navegador da consultora (${errosF.slice(0, 3).join(' | ') || 'nenhum'})`);
} finally {
  await b.close();
  console.log('Limpeza:');
  await admin.from('clientes').delete().in('rd_id', RD_IDS);
  if (importacoes.length) await admin.from('importacoes').delete().in('id', importacoes);
  if (userId) await admin.auth.admin.deleteUser(userId);
  await admin.from('rate_limit').delete().or('chave.like.f:%,chave.like.fw:%,chave.like.fp:%');
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
