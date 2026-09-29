// E2E da v3 (Fases 3–5): importar → gerar ficha → link → cliente preenche no navegador (autosave), recarrega,
// conclui; visual em 1280 px e 390 px; ordem do Tab; erros das rotas do cliente. Tudo com dados fictícios e limpeza no fim.
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
const layout = JSON.parse(readFileSync(`${RAIZ}/src/lib/ficha/ficha-layout.json`, 'utf8'));
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
const ficha = async () => (await admin.from('fichas').select('status, dados_atuais, dados_originais, campo_em_foco, cliente_visto_em, concluida_em').eq('id', fichaId).single()).data;

const b = await chromium.launch();
try {
  await admin.from('clientes').delete().in('rd_id', RD_IDS);
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (eu) throw eu;
  userId = u.user.id;
  await admin.from('consultoras').insert({ id: userId, nome: 'Consultora Teste', email });

  const f = await (await b.newContext()).newPage();
  await f.goto(`${APP}/login`);
  await f.fill('input[name=email]', email); await f.fill('input[name=senha]', senha);
  await Promise.all([f.waitForURL(/\/admin/), f.click('button[type=submit]')]);

  console.log('Fase 3 — importação e ficha:');
  const importar = async () => {
    const imp = await (await f.request.post(`${APP}/api/importacoes`, { data: { arquivoNome: 'rd-export.csv', totalLinhas: 4 } })).json();
    importacoes.push(imp.data.id);
    return (await (await f.request.post(`${APP}/api/importacoes/${imp.data.id}/lote`, { data: { inicio: 0, linhas } })).json()).data.resultados;
  };
  await importar();
  const { data: cli } = await admin.from('clientes').select('id, dados_ficha').eq('rd_id', ALVO).single();
  const g = await (await f.request.post(`${APP}/api/fichas`, { data: { clienteId: cli.id } })).json();
  fichaId = g.data.id;
  let fx = await ficha();
  ok(g.data.acao === 'criada' && JSON.stringify(fx.dados_originais) === JSON.stringify(fx.dados_atuais), 'ficha nova: dados_originais = dados_atuais');
  ok(fx.dados_atuais.nome === 'Antônio Ribeiro Neto' && fx.dados_atuais.medicoNome === 'Dr. Fulano de Tal', 'dados do RD mapeados nos 71 campos');
  await importar();
  const { count: nClientes } = await admin.from('clientes').select('*', { count: 'exact', head: true }).in('rd_id', RD_IDS);
  const { count: nFichas } = await admin.from('fichas').select('*', { count: 'exact', head: true }).eq('cliente_id', cli.id);
  ok(nClientes === 4 && nFichas === 1, `reimportar não duplica (clientes ${nClientes}, fichas ${nFichas})`);

  const link = (await (await f.request.post(`${APP}/api/fichas/${fichaId}/link`)).json()).data.url;
  const token = link.split('/f/')[1];
  ok((await ficha()).status === 'enviada', 'link gerado → "enviada"');

  console.log('Fase 4 — visual:');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const c = await ctx.newPage();
  const errosNavegador = [];
  c.on('pageerror', (e) => errosNavegador.push(e.message.slice(0, 200)));
  c.on('console', (m) => m.type() === 'error' && errosNavegador.push(m.text().slice(0, 200)));
  const resp = await c.goto(link); await c.waitForFunction(() => document.querySelectorAll('[data-campo="nome"]').length === 1, null, { timeout: 60000 });
  ok(resp.status() === 200 && (resp.headers()['x-robots-tag'] ?? '').includes('noindex'), 'página do cliente abre (noindex)');
  ok(await aparece(c.locator('.ficha-pagina')), 'modo documento em 1280 px');
  ok((await c.locator('.ficha-pagina').count()) === layout.paginas.length, `${layout.paginas.length} páginas`);
  // cada campo precisa cair na posição do layout (tolerância de 1,5 px)
  let foraDoLugar = [];
  for (const campo of layout.campos) {
    const caixa = await c.locator(`[data-campo="${campo.chave}"]`).boundingBox();
    const pag = await c.locator('.ficha-pagina').nth(campo.pagina - 1).boundingBox();
    const esperado = { x: pag.x + (campo.pos.left / 100) * pag.width, y: pag.y + (campo.pos.top / 100) * pag.height, w: (campo.pos.width / 100) * pag.width };
    if (Math.abs(caixa.x - esperado.x) > 1.5 || Math.abs(caixa.y - esperado.y) > 1.5 || Math.abs(caixa.width - esperado.w) > 1.5) foraDoLugar.push(campo.chave);
  }
  ok(foraDoLugar.length === 0, `71 campos sobre as caixas do modelo (${foraDoLugar.join(', ') || 'todos no lugar'})`);
  await c.locator('.ficha-pagina').first().screenshot({ path: `${S}/v3-1280-p1.png` });
  await c.locator('.ficha-pagina').nth(2).screenshot({ path: `${S}/v3-1280-p3.png` });
  const ordemDom = await c.locator('[data-campo]').evaluateAll((els) => els.map((e) => e.getAttribute('data-campo')));
  ok(JSON.stringify(ordemDom) === JSON.stringify(layout.campos.map((x) => x.chave)), 'ordem do Tab = ordem do layout');
  await c.locator('[data-campo="nome"]').focus();
  await c.keyboard.press('Tab');
  ok((await c.evaluate(() => document.activeElement?.getAttribute('data-campo'))) === layout.campos[1].chave, `Tab vai de "nome" para "${layout.campos[1].chave}"`);
  const htmlCliente = await c.content();
  ok(!htmlCliente.includes('observacoesInternas') && !htmlCliente.includes(env.SUPABASE_SECRET_KEY) && !htmlCliente.includes(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    'HTML do cliente sem chaves do Supabase e sem observações internas');

  const celular = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  const htmlServidor = await (await fetch(link)).text();
  ok(htmlServidor.includes('md:hidden') && htmlServidor.includes('hidden w-full md:block'), 'servidor manda os dois formatos, cada um escondido por CSS no tamanho errado (sem piscar)');
  await celular.goto(link); await celular.locator('fieldset').first().waitFor({ timeout: 60000 });
  await celular.waitForFunction(() => document.querySelectorAll('.ficha-pagina').length === 0, null, { timeout: 15000 }).catch(() => {});
  ok((await celular.locator('.ficha-pagina').count()) === 0 && (await celular.locator('fieldset').count()) > 5, 'modo lista em 390 px');
  const fonte = await celular.locator('[data-campo="nome"]').evaluate((e) => getComputedStyle(e).fontSize);
  ok(parseFloat(fonte) >= 16, `inputs com ≥ 16 px no celular (${fonte})`);
  await celular.screenshot({ path: `${S}/v3-390.png` });

  console.log('Fase 5 — autosave e presença:');
  await c.waitForTimeout(1500);
  fx = await ficha();
  ok(fx.status === 'aberta' && fx.cliente_visto_em, `1º sinal do navegador marca "aberta" (${fx.status})`);
  await c.locator('[data-campo="convenioMedico"]').click();
  await c.waitForTimeout(1300);
  ok((await ficha()).campo_em_foco === 'convenioMedico', 'presença: campo em foco registrado');
  await c.locator('[data-campo="convenioMedico"]').fill('Unimed Nacional');
  ok(await aparece(c.getByText('Salvo ✓')), 'indicador "Salvo ✓"');
  await c.locator('[data-campo="estadoCivil"]').selectOption('Casado');
  await c.waitForTimeout(800);
  await c.locator('[data-campo="cpf"]').fill('');
  await c.locator('[data-campo="cpf"]').pressSequentially('11122233300');
  await c.locator('[data-campo="rg"]').click();
  ok(await aparece(c.getByText('CPF inválido')), 'CPF inválido: aviso ao sair do campo, e não é salvo');
  await c.locator('[data-campo="cpf"]').fill('123.456.789-09');
  await c.locator('[data-campo="rg"]').click();
  await c.waitForTimeout(1500);
  fx = await ficha();
  ok(fx.status === 'em_preenchimento' && fx.dados_atuais.convenioMedico === 'Unimed Nacional' && fx.dados_atuais.estadoCivil === 'Casado', `valores gravados, status "${fx.status}"`);
  ok(fx.dados_originais.convenioMedico === null, 'dados_originais preservados');
  const { data: hist } = await admin.from('ficha_edicoes').select('campo, origem, valor_novo').eq('ficha_id', fichaId);
  const cpfHist = hist.filter((h) => h.campo === 'cpf').length;
  ok(hist.some((h) => h.campo === 'convenioMedico') && hist.every((h) => h.origem === 'cliente'), `histórico campo a campo, origem "cliente" (${hist.length} edições)`);
  ok(cpfHist === 2 && fx.dados_atuais.cpf === fx.dados_originais.cpf,
    `CPF apagado e devolvido ao original: histórico registra ida e volta (${cpfHist}) e o valor volta a ser o original (não fica amarelo)`);
  ok(!hist.some((h) => h.campo === 'cpf' && h.valor_novo === '111.222.333-00'), 'CPF inválido nunca foi gravado');

  await c.reload(); await c.waitForFunction(() => document.querySelectorAll('[data-campo="nome"]').length === 1, null, { timeout: 60000 });
  await c.waitForTimeout(500);
  ok((await c.inputValue('[data-campo="convenioMedico"]')) === 'Unimed Nacional' && (await c.inputValue('[data-campo="estadoCivil"]')) === 'Casado',
    'recarregar a página: os valores continuam lá');

  const antes = await importar();
  const rAlvo = antes.find((r) => r.rdId === ALVO);
  fx = await ficha();
  ok(rAlvo.ficha !== 'atualizada' && fx.dados_atuais.convenioMedico === 'Unimed Nacional', 'reimportar depois da 1ª edição não toca na ficha');

  console.log('Fase 5 — concluir:');
  await c.locator('[data-campo="emergenciaTelefone"]').fill('');
  await c.locator('[data-campo="nome"]').click();
  await c.waitForTimeout(1500);
  await c.getByRole('button', { name: 'Concluir ficha' }).click();
  ok(await aparece(c.getByText('Para concluir, preencha:')), 'concluir sem obrigatório: lista o que falta');
  await c.getByRole('button', { name: 'Telefone do contato de emergência (com DDD ou DDI)' }).click();
  ok((await c.evaluate(() => document.activeElement?.getAttribute('data-campo'))) === 'emergenciaTelefone', 'clicar no item leva ao campo');
  await c.keyboard.type('16990001111');
  await c.locator('[data-campo="nome"]').click();
  await c.waitForTimeout(1500);
  await c.getByRole('button', { name: 'Concluir ficha' }).click();
  ok(await aparece(c.getByText('Ficha enviada, obrigado!')), 'ficha concluída: mensagem de obrigado');
  fx = await ficha();
  ok(fx.status === 'concluida' && fx.concluida_em && fx.dados_atuais.emergenciaTelefone === '(16) 99000-1111', `status "${fx.status}"`);
  ok(await c.locator('[data-campo="nome"]').isDisabled(), 'depois de concluir: somente leitura');
  ok(errosNavegador.length === 0, `sem erros no navegador (${errosNavegador.slice(0, 3).join(' | ') || 'nenhum'})`);
  const pdf = await c.request.get(`${APP}/api/f/${token}/pdf`);
  ok(pdf.status() === 200 && (await pdf.body()).subarray(0, 5).toString() === '%PDF-', 'cópia em PDF disponível');
  await c.screenshot({ path: `${S}/v3-concluida.png` });

  console.log('Rotas do cliente — erros:');
  const patch = (tk, corpo) => fetch(`${APP}/api/f/${tk}/campos`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  ok((await patch('x'.repeat(43), { campo: 'nome', valor: 'A' })).status === 404, 'token inválido → 404');
  ok((await patch(token, { campo: 'nome', valor: 'A' })).status === 409, 'ficha concluída → 409');
  await admin.from('fichas').update({ status: 'em_preenchimento' }).eq('id', fichaId);
  ok((await patch(token, { campo: 'observacoesInternas', valor: 'x' })).status === 400, 'chave fora do layout → 400');
  ok((await patch(token, { campo: 'nascimento', valor: '31/02/2020' })).status === 422, 'valor inválido → 422');
  const r422 = await (await patch(token, { campo: 'sabeNadar', valor: 'Talvez' })).json();
  ok(r422.erro === 'Escolha uma das opções da lista.', 'mensagem do 422 amigável');
  let ultimo = 0;
  for (let i = 0; i < 62; i++) ultimo = (await patch(token, { campo: 'profissao', valor: `Teste ${i}` })).status;
  ok(ultimo === 429, `mais de 60 escritas por minuto no mesmo link → 429 (último: ${ultimo})`);
} catch (e) {
  console.error('ERRO no teste:', e.message ?? e, String(e.stack ?? '').split('\n')[1]);
  falhas++;
} finally {
  await b.close();
  console.log('Limpeza:');
  await admin.from('clientes').delete().in('rd_id', RD_IDS);
  if (importacoes.length) await admin.from('importacoes').delete().in('id', importacoes);
  if (userId) await admin.auth.admin.deleteUser(userId);
  await admin.from('rate_limit').delete().or('chave.like.f:%,chave.like.fw:%,chave.like.fp:%');
  const { count } = await admin.from('clientes').select('*', { count: 'exact', head: true }).in('rd_id', RD_IDS);
  console.log(`  clientes de teste restantes: ${count}`);
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
