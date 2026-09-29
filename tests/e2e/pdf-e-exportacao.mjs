// E2E da v3 (Fase 7): 71 campos com acentos → aprovar → PDF final preenchível (sem achatar) com todos os valores;
// exportação CSV. Dados fictícios e limpeza no fim.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const email = `e2e-v3-${Date.now()}@example.com`, senha = `E2e#9a${randomBytes(9).toString('base64url')}`;
let userId = null, fichaId = null;
const importacoes = [];

const b = await chromium.launch();
try {
  const { PDFDocument } = require('pdf-lib');
  await admin.from('clientes').delete().in('rd_id', RD_IDS);
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (eu) throw eu;
  userId = u.user.id;
  await admin.from('consultoras').insert({ id: userId, nome: 'Consultora Teste', email });
  const f = await (await b.newContext()).newPage();
  await f.goto(`${APP}/login`);
  await f.fill('input[name=email]', email); await f.fill('input[name=senha]', senha);
  await Promise.all([f.waitForURL(/\/admin/), f.click('button[type=submit]')]);
  const imp = await (await f.request.post(`${APP}/api/importacoes`, { data: { arquivoNome: 'rd-export.csv', totalLinhas: 4 } })).json();
  importacoes.push(imp.data.id);
  await f.request.post(`${APP}/api/importacoes/${imp.data.id}/lote`, { data: { inicio: 0, linhas } });
  const { data: cli } = await admin.from('clientes').select('id').eq('rd_id', ALVO).single();
  fichaId = (await (await f.request.post(`${APP}/api/fichas`, { data: { clienteId: cli.id } })).json()).data.id;

  // todos os 71 campos com acentos e caracteres especiais (fictícios)
  const valores = {};
  for (const c of layout.campos) {
    if (c.tipo === 'select') valores[c.chave] = c.opcoes.at(-1);
    else if (c.tipo === 'data') valores[c.chave] = '05/06/1971';
    else if (c.formato === 'cpf') valores[c.chave] = '529.982.247-25';
    else if (c.formato === 'cep') valores[c.chave] = '14010-000';
    else if (c.formato === 'telefone') valores[c.chave] = '(16) 99000-1111';
    else if (c.formato === 'email') valores[c.chave] = 'joao.avila@exemplo.com';
    else if (c.tipo === 'textoLongo') valores[c.chave] = `Ação, coração e pão; ç ã õ é ü — “aspas” (${c.chave})\nSegunda linha`;
    else valores[c.chave] = `Ávila São João ç ã õ é ü (${c.chave})`;
  }
  await admin.from('fichas').update({ dados_atuais: valores, status: 'concluida', concluida_em: new Date().toISOString() }).eq('id', fichaId);

  console.log('Fase 7 — aprovar e PDF final:');
  const ap = await f.request.post(`${APP}/api/fichas/${fichaId}/aprovar`);
  ok(ap.status() === 200, `aprovar → ${ap.status()}`);
  const r = await f.request.get(`${APP}/api/fichas/${fichaId}/pdf`);
  ok(r.status() === 200 && r.headers()['content-type'] === 'application/pdf', `PDF → ${r.status()} ${r.headers()['content-type']}`);
  const bytes = await r.body();
  writeFileSync(`${S}/f7-final.pdf`, bytes);
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const nomes = form.getFields().map((x) => x.getName());
  ok(nomes.length === layout.campos.length, `PDF preenchível, não achatado (${nomes.length} campos)`);
  const errados = [];
  for (const c of layout.campos) {
    const campo = form.getField(c.campoPdf);
    const v = campo.constructor.name === 'PDFDropdown' ? campo.getSelected()[0] : campo.getText();
    if (v !== valores[c.chave]) errados.push(`${c.chave}=${JSON.stringify(v)}`);
  }
  ok(errados.length === 0, `todos os valores no PDF, com acentos (${errados.slice(0, 4).join(', ') || 'ok'})`);
  ok(pdf.getPageCount() === layout.paginas.length, `${pdf.getPageCount()} páginas`);

  console.log('Fase 7 — exportação:');
  const e = await f.request.get(`${APP}/api/exportar?status=aprovada`);
  const csv = (await e.body()).toString('utf8');
  ok(e.status() === 200 && e.headers()['content-disposition']?.includes('fichas-aprovada-'), 'CSV baixa como anexo');
  const tab = Papa.parse(csv.replace(/^﻿/, ''), { delimiter: ';' }).data.filter((l) => l.length > 1);
  const linha = tab.find((l) => l[0] === ALVO);
  ok(linha && linha.length === 4 + layout.campos.length, `linha da ficha com ${linha?.length} colunas`);
  ok(linha?.includes(valores.nome) && linha?.includes(valores[layout.campos.find((c) => c.tipo === 'textoLongo').chave]), 'CSV com acentos e multilinha preservados');
  ok((await f.request.get(`${APP}/api/exportar?status=xyz`)).status() === 400, 'status inválido → 400');
  ok((await fetch(`${APP}/api/exportar`)).status === 401, 'exportar sem login → 401');
} finally {
  await b.close();
  console.log('Limpeza:');
  await admin.from('clientes').delete().in('rd_id', RD_IDS);
  if (importacoes.length) await admin.from('importacoes').delete().in('id', importacoes);
  if (userId) await admin.auth.admin.deleteUser(userId);
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
