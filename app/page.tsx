'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Rateio } from '@/lib/types';

type StatusFiltro = 'todos' | 'pago' | 'pendente';

export default function Home() {
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [savingRow, setSavingRow] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rateios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar rateios.');
      setRateios(data.rateios);
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  const buscaNormalizada = busca.trim().toLowerCase();

  const rateiosFiltrados = useMemo(() => {
    if (!buscaNormalizada) return rateios;
    return rateios.filter((r) => {
      const matchAssunto = r.assunto.toLowerCase().includes(buscaNormalizada);
      const matchRemetente = r.remetente.toLowerCase().includes(buscaNormalizada);
      const matchPessoa = r.participantes.some((p) => p.pessoa.toLowerCase().includes(buscaNormalizada));
      return matchAssunto || matchRemetente || matchPessoa;
    });
  }, [rateios, buscaNormalizada]);

  useEffect(() => {
    setIndex(0);
  }, [buscaNormalizada]);

  const atual = rateiosFiltrados[index];

  const participantesVisiveis = useMemo(() => {
    if (!atual) return [];
    return atual.participantes.filter((p) => {
      if (statusFiltro === 'pago') return p.statusPagamento.toLowerCase() === 'pago';
      if (statusFiltro === 'pendente') return p.statusPagamento.toLowerCase() !== 'pago';
      return true;
    });
  }, [atual, statusFiltro]);

  async function alternarPagamento(rowNumber: number, pago: boolean) {
    const hoje = new Date().toISOString().slice(0, 10);
    const novoStatus = pago ? 'Pago' : 'Pendente';
    const novaData = pago ? hoje : '';
    setSavingRow(rowNumber);
    setRateios((prev) =>
      prev.map((r) => ({
        ...r,
        participantes: r.participantes.map((p) =>
          p.rowNumber === rowNumber ? { ...p, statusPagamento: novoStatus, dataPagamento: novaData } : p
        ),
      }))
    );
    try {
      const res = await fetch('/api/participante', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowNumber, statusPagamento: novoStatus, dataPagamento: novaData }),
      });
      if (!res.ok) throw new Error('Falha ao salvar.');
    } catch {
      load();
    } finally {
      setSavingRow(null);
    }
  }

  async function alterarDataPagamento(rowNumber: number, novaData: string) {
    setSavingRow(rowNumber);
    setRateios((prev) =>
      prev.map((r) => ({
        ...r,
        participantes: r.participantes.map((p) => (p.rowNumber === rowNumber ? { ...p, dataPagamento: novaData } : p)),
      }))
    );
    try {
      const res = await fetch('/api/participante', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowNumber, statusPagamento: 'Pago', dataPagamento: novaData }),
      });
      if (!res.ok) throw new Error('Falha ao salvar.');
    } catch {
      load();
    } finally {
      setSavingRow(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando rateios…</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600">Erro: {error}</div>
        <div className="mt-2 text-sm text-slate-500">
          Verifique se as variáveis de ambiente do Google Sheets (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_ID) estão configuradas e se a planilha foi compartilhada com a service account.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rateio Presentes</h1>
        {atual && (
          <Link
            href={`/novo?from=${encodeURIComponent(atual.id)}`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Clonar rateio
          </Link>
        )}
        {!atual && (
          <Link
            href="/novo"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Novo rateio
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, remetente ou assunto…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="todos">Todos os status</option>
          <option value="pago">Só pagos</option>
          <option value="pendente">Só pendentes</option>
        </select>
      </div>

      {rateiosFiltrados.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Nenhum rateio encontrado{busca ? ' para essa busca' : ''}.
        </div>
      )}

      {atual && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Mais recente
            </button>
            <span className="text-sm text-slate-500">
              Rateio {index + 1} de {rateiosFiltrados.length}
            </span>
            <button
              onClick={() => setIndex((i) => Math.min(rateiosFiltrados.length - 1, i + 1))}
              disabled={index === rateiosFiltrados.length - 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Mais antigo →
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{atual.assunto}</h2>
                <p className="text-sm text-slate-500">
                  {atual.dataEmail || 'sem data'} · organizado por {atual.remetente || '—'}
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">Total: R$ {atual.valorTotalRateio.toFixed(2)}</div>
                {atual.chavePix && <div className="text-slate-500">Pix: {atual.chavePix}</div>}
              </div>
            </div>

            <div className="mb-3 text-sm text-slate-500">
              {atual.participantes.filter((p) => p.statusPagamento.toLowerCase() === 'pago').length} de{' '}
              {atual.participantes.length} pagaram
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2">Pessoa</th>
                  <th className="py-2">Valor</th>
                  <th className="py-2">Pago</th>
                  <th className="py-2">Data pagamento</th>
                </tr>
              </thead>
              <tbody>
                {participantesVisiveis.map((p) => {
                  const pago = p.statusPagamento.toLowerCase() === 'pago';
                  return (
                    <tr key={p.rowNumber} className="border-b border-slate-100">
                      <td className="py-2">{p.pessoa}</td>
                      <td className="py-2">R$ {p.valorIndividual.toFixed(2)}</td>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={pago}
                          onChange={(e) => alternarPagamento(p.rowNumber, e.target.checked)}
                          disabled={savingRow === p.rowNumber}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="date"
                          value={p.dataPagamento || ''}
                          disabled={!pago || savingRow === p.rowNumber}
                          onChange={(e) => alterarDataPagamento(p.rowNumber, e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  );
                })}
                {participantesVisiveis.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      Nenhum participante para esse filtro de status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
