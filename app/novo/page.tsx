'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { Rateio } from '@/lib/types';

type LinhaParticipante = {
  key: string;
  pessoa: string;
  email: string;
  estagiario: boolean;
  percentual: number;
  valor: number;
};

function novaChave() {
  return Math.random().toString(36).slice(2);
}

function NovoRateioForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get('from');

  const [origem, setOrigem] = useState<Rateio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [assunto, setAssunto] = useState('');
  const [remetente, setRemetente] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [dataEmail, setDataEmail] = useState(() => new Date().toISOString().slice(0, 10));
  const [valorTotal, setValorTotal] = useState(0);
  const [linhas, setLinhas] = useState<LinhaParticipante[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/rateios');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar rateios.');
        const rateios: Rateio[] = data.rateios;
        const encontrado = fromId ? rateios.find((r) => r.id === fromId) : null;
        if (encontrado) {
          setOrigem(encontrado);
          setAssunto(encontrado.assunto);
          setRemetente(encontrado.remetente);
          setChavePix(encontrado.chavePix);
          setValorTotal(encontrado.valorTotalRateio);
          setLinhas(
            encontrado.participantes.map((p) => ({
              key: novaChave(),
              pessoa: p.pessoa,
              email: p.email || '',
              estagiario: p.estagiario || false,
              percentual:
                encontrado.valorTotalRateio > 0 ? (p.valorIndividual / encontrado.valorTotalRateio) * 100 : 0,
              valor: p.valorIndividual,
            }))
          );
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro desconhecido.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [fromId]);

  function adicionarParticipante() {
    setLinhas((prev) => [
      ...prev,
      { key: novaChave(), pessoa: '', email: '', estagiario: false, percentual: 0, valor: 0 },
    ]);
  }

  function removerParticipante(key: string) {
    setLinhas((prev) => prev.filter((l) => l.key !== key));
  }

  function atualizarPercentual(key: string, percentual: number) {
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, percentual, valor: (valorTotal * percentual) / 100 } : l))
    );
  }

  function atualizarValor(key: string, valor: number) {
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, valor, percentual: valorTotal > 0 ? (valor / valorTotal) * 100 : 0 } : l))
    );
  }

  function atualizarValorTotal(novoTotal: number) {
    setValorTotal(novoTotal);
    setLinhas((prev) => prev.map((l) => ({ ...l, valor: (novoTotal * l.percentual) / 100 })));
  }

  function atualizarNome(key: string, pessoa: string) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, pessoa } : l)));
  }

  function atualizarEmail(key: string, email: string) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, email } : l)));
  }

  function atualizarEstagiario(key: string, estagiario: boolean) {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, estagiario } : l)));
  }

  // Redistribui o valor total entre os participantes: todos os colaboradores pagam o
  // mesmo valor (inclusive a Paula), e cada estagiário paga metade do valor de um colaborador.
  function redistribuir() {
    if (valorTotal <= 0 || linhas.length === 0) return;
    const nEstagiarios = linhas.filter((l) => l.estagiario).length;
    const nColaboradores = linhas.length - nEstagiarios;
    const unidades = nColaboradores + nEstagiarios * 0.5;
    if (unidades <= 0) return;
    const valorColaborador = valorTotal / unidades;
    setLinhas((prev) =>
      prev.map((l) => {
        const valor = l.estagiario ? valorColaborador / 2 : valorColaborador;
        return { ...l, valor, percentual: (valor / valorTotal) * 100 };
      })
    );
  }

  const somaValores = useMemo(() => linhas.reduce((acc, l) => acc + (Number(l.valor) || 0), 0), [linhas]);
  const somaPercentuais = useMemo(() => linhas.reduce((acc, l) => acc + (Number(l.percentual) || 0), 0), [linhas]);
  const diferenca = Math.abs(somaValores - valorTotal);
  const totalValido =
    valorTotal > 0 && diferenca <= 0.05 && linhas.length > 0 && linhas.every((l) => l.pessoa.trim().length > 0);

  async function salvar() {
    if (!totalValido) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch('/api/rateios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataEmail,
          assunto,
          remetente,
          chavePix,
          valorTotalRateio: valorTotal,
          participantes: linhas.map((l) => ({
            pessoa: l.pessoa.trim(),
            email: l.email.trim(),
            estagiario: l.estagiario,
            valorIndividual: Number(l.valor.toFixed(2)),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar rateio.');
      router.push('/');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <div className="p-8 text-slate-500">Carregando…</div>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold">{origem ? 'Clonar rateio' : 'Novo rateio'}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {origem
          ? `A partir de "${origem.assunto}" (${origem.dataEmail}). Ajuste os participantes e valores abaixo.`
          : 'Preencha os dados do novo rateio.'}
      </p>

      {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Assunto / Aniversariante
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Remetente / organizador
          <input
            value={remetente}
            onChange={(e) => setRemetente(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Chave Pix
          <input
            value={chavePix}
            onChange={(e) => setChavePix(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Data
          <input
            type="date"
            value={dataEmail}
            onChange={(e) => setDataEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Valor total do rateio (R$)
          <input
            type="number"
            step="0.01"
            value={valorTotal}
            onChange={(e) => atualizarValorTotal(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-medium">Participantes</h2>
        <div className="flex gap-2">
          <button
            onClick={redistribuir}
            disabled={valorTotal <= 0 || linhas.length === 0}
            title="Recalcula os valores: colaboradores pagam igual, estagiários pagam metade"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Redistribuir
          </button>
          <button
            onClick={adicionarParticipante}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            + Adicionar participante
          </button>
        </div>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">Nome</th>
            <th className="py-2">E-mail</th>
            <th className="py-2">Estagiário</th>
            <th className="py-2">%</th>
            <th className="py-2">Valor (R$)</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.key} className="border-b border-slate-100">
              <td className="py-1.5 pr-2">
                <input
                  value={l.pessoa}
                  onChange={(e) => atualizarNome(l.key, e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1"
                  placeholder="Nome"
                />
              </td>
              <td className="py-1.5 pr-2">
                <input
                  type="email"
                  value={l.email}
                  onChange={(e) => atualizarEmail(l.key, e.target.value)}
                  className="w-40 rounded border border-slate-300 px-2 py-1"
                  placeholder="email@exemplo.com"
                />
              </td>
              <td className="py-1.5 pr-2 text-center">
                <input
                  type="checkbox"
                  checked={l.estagiario}
                  onChange={(e) => atualizarEstagiario(l.key, e.target.checked)}
                />
              </td>
              <td className="py-1.5 pr-2">
                <input
                  type="number"
                  step="0.01"
                  value={Number(l.percentual.toFixed(2))}
                  onChange={(e) => atualizarPercentual(l.key, Number(e.target.value))}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </td>
              <td className="py-1.5 pr-2">
                <input
                  type="number"
                  step="0.01"
                  value={Number(l.valor.toFixed(2))}
                  onChange={(e) => atualizarValor(l.key, Number(e.target.value))}
                  className="w-24 rounded border border-slate-300 px-2 py-1"
                />
              </td>
              <td className="py-1.5">
                <button onClick={() => removerParticipante(l.key)} className="text-red-600 hover:underline">
                  remover
                </button>
              </td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-slate-400">
                Nenhum participante ainda. Adicione um acima.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div
        className={`mb-4 rounded-lg px-3 py-2 text-sm ${
          totalValido ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        Soma dos valores: R$ {somaValores.toFixed(2)} de R$ {valorTotal.toFixed(2)} ({somaPercentuais.toFixed(1)}%)
        {!totalValido && ' — ajuste os valores ou percentuais (ou clique em Redistribuir) para que a soma bata com o total antes de salvar.'}
      </div>

      <button
        onClick={salvar}
        disabled={!totalValido || enviando}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {enviando ? 'Salvando…' : 'Salvar rateio'}
      </button>
    </main>
  );
}

export default function NovoRateioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Carregando…</div>}>
      <NovoRateioForm />
    </Suspense>
  );
}
