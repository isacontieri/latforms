import { z } from 'zod';
import { registrarAuditoria } from '@/lib/audit';
import { exigirFuncionario } from '@/lib/auth';
import { criarConvite } from '@/lib/equipe/convites';
import { falha, lerCorpo, ok } from '@/lib/http';
import { criarClienteAdmin } from '@/lib/supabase/admin';

const ConviteSchema = z.object({
  email: z.email().max(254),
  nome: z.string().trim().max(120).optional(),
});

/** Convida uma pessoa para a equipe: devolve o link de uso único (mostrado uma vez). */
export async function POST(req: Request) {
  const funcionario = await exigirFuncionario();
  if (funcionario instanceof Response) return funcionario;

  const corpo = await lerCorpo(req, ConviteSchema);
  if (corpo instanceof Response) return corpo;
  const email = corpo.email.trim().toLowerCase();

  const { data: jaExiste } = await criarClienteAdmin().from('funcionarios').select('id').ilike('email', email).maybeSingle();
  if (jaExiste) return falha('Essa pessoa já tem acesso. Se ela esqueceu a senha, gere um link de nova senha.', 409);

  try {
    const convite = await criarConvite({ tipo: 'convite', email, nome: corpo.nome, criadoPor: funcionario.id });
    await registrarAuditoria({ ator: `funcionario:${funcionario.id}`, acao: `convite_equipe_criado:${convite.id}` });
    return ok({ url: convite.url, expiraEm: convite.expiraEm }, { status: 201 });
  } catch (e) {
    console.error('equipe/convites', (e as Error).message);
    return falha('Não foi possível gerar o convite', 500);
  }
}
