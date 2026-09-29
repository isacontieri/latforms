// E2E: travas de administrador na Equipe. Cria 2 pessoas de teste (uma comum, uma admin), confere a tela e as rotas,
// promove e rebaixa, e apaga tudo no fim. Não mexe nas pessoas reais da equipe.
import { mkdirSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const require = createRequire(`${RAIZ}/package.json`);
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('@playwright/test');

const S = `${RAIZ}/test-results/e2e`;
mkdirSync(S, { recursive: true });
const APP = process.env.APP ?? 'http://localhost:3000';
const env = Object.fromEntries(readFileSync(`${RAIZ}/.env.local`, 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

let falhas = 0;
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) falhas++; };
const aparece = (loc, t = 10000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true).catch(() => false);
const sufixo = Date.now();
const pessoas = {
  comum: { email: `e2e-comum-${sufixo}@example.com`, senha: `E2e#9a${randomBytes(9).toString('base64url')}`, nome: 'Comum Teste', admin: false },
  adm: { email: `e2e-adm-${sufixo}@example.com`, senha: `E2e#9a${randomBytes(9).toString('base64url')}`, nome: 'Adm Teste', admin: true },
};
const ids = [];

const b = await chromium.launch();
try {
  for (const p of Object.values(pessoas)) {
    const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: p.senha, email_confirm: true });
    if (error) throw error;
    p.id = data.user.id; ids.push(p.id);
    await admin.from('consultoras').insert({ id: p.id, nome: p.nome, email: p.email, admin: p.admin });
  }
  const entrar = async (p) => {
    const pg = await (await b.newContext()).newPage();
    await pg.goto(`${APP}/login`);
    await pg.fill('input[name=email]', p.email); await pg.fill('input[name=senha]', p.senha);
    await Promise.all([pg.waitForURL(/\/admin/), pg.click('button[type=submit]')]);
    return pg;
  };

  console.log('Pessoa comum:');
  const c = await entrar(pessoas.comum);
  await c.goto(`${APP}/admin/equipe`);
  ok(await aparece(c.getByTestId('aviso-admin')), 'vê o aviso de que essas tarefas são dos administradores');
  ok((await c.getByRole('button', { name: /Gerar link de convite|Link de nova senha|Remover acesso|administrador/ }).count()) === 0, 'não vê convidar, nova senha, remover nem tornar administrador');
  ok(await aparece(c.locator('[data-admin]')), 'vê quem é administrador (selo ADMIN)');
  const tentativas = [
    ['POST', '/api/equipe/convites', { email: `x-${sufixo}@example.com` }],
    ['POST', `/api/equipe/${pessoas.adm.id}/nova-senha`],
    ['DELETE', `/api/equipe/${pessoas.adm.id}`],
    ['PATCH', `/api/equipe/${pessoas.comum.id}/admin`, { admin: true }],
  ];
  for (const [m, url, data] of tentativas) {
    const r = await c.request.fetch(`${APP}${url}`, { method: m, data });
    ok(r.status() === 403, `${m} ${url.replace(/[0-9a-f-]{36}/, ':id')} → ${r.status()} (bloqueado no servidor)`);
  }
  // direto no banco, com a sessão dela (chave publishable): sem política de UPDATE, nada muda
  const direto = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await direto.auth.signInWithPassword({ email: pessoas.comum.email, password: pessoas.comum.senha });
  await direto.from('consultoras').update({ admin: true }).eq('id', pessoas.comum.id);
  const { error: eRpc } = await direto.rpc('definir_admin', { p_alvo: pessoas.comum.id, p_admin: true });
  ok(!!eRpc, 'função definir_admin não pode ser chamada pelo navegador');
  const { data: semMudanca } = await admin.from('consultoras').select('admin').eq('id', pessoas.comum.id).single();
  ok(semMudanca.admin === false, 'pessoa comum não conseguiu se promover');

  console.log('Administrador:');
  const a = await entrar(pessoas.adm);
  await a.goto(`${APP}/admin/equipe`);
  ok(await aparece(a.getByRole('button', { name: 'Gerar link de convite' })), 'vê "Gerar link de convite"');
  const linhaComum = a.locator('li').filter({ hasText: pessoas.comum.email });
  await linhaComum.getByRole('button', { name: 'Tornar administrador' }).click();
  await linhaComum.getByRole('button', { name: 'Sim' }).click();
  ok(await aparece(a.locator('li').filter({ hasText: pessoas.comum.email }).locator('[data-admin]')), 'torna a pessoa comum administradora (selo aparece)');
  const { data: promovida } = await admin.from('consultoras').select('admin').eq('id', pessoas.comum.id).single();
  ok(promovida.admin === true, 'gravado no banco');
  await c.goto(`${APP}/admin/equipe`);
  ok(await aparece(c.getByRole('button', { name: 'Gerar link de convite' })), 'quem foi promovido passa a ver as ações');
  const rNova = await c.request.post(`${APP}/api/equipe/${pessoas.adm.id}/nova-senha`);
  ok(rNova.status() === 201, `e já consegue gerar link de nova senha (${rNova.status()})`);

  const linha2 = a.locator('li').filter({ hasText: pessoas.comum.email });
  await linha2.getByRole('button', { name: 'Remover dos administradores' }).click();
  await linha2.getByRole('button', { name: 'Sim' }).click();
  ok(await a.locator('li').filter({ hasText: pessoas.comum.email }).locator('[data-admin]').waitFor({ state: 'detached', timeout: 10000 }).then(() => true).catch(() => false), 'remove dos administradores');
  const rDepois = await c.request.post(`${APP}/api/equipe/${pessoas.adm.id}/nova-senha`);
  ok(rDepois.status() === 403, `rebaixada perde o acesso na hora (${rDepois.status()})`);

  const { data: aud } = await admin.from('auditoria').select('acao').in('acao', [`admin_concedido:${pessoas.comum.id}`, `admin_retirado:${pessoas.comum.id}`]);
  ok(aud.length === 2, 'auditoria registra conceder e retirar');
  await a.screenshot({ path: `${S}/equipe-admin.png`, fullPage: true });
} finally {
  await b.close();
  console.log('Limpeza:');
  await admin.from('convites_equipe').delete().in('criado_por', ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
