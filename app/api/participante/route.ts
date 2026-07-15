import { NextResponse } from 'next/server';
import { updateParticipantePagamento } from '@/lib/sheets';

export async function PATCH(request: Request) {
  try {
    const { rowNumber, statusPagamento, dataPagamento } = await request.json();
    if (!rowNumber || !statusPagamento) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    await updateParticipantePagamento(Number(rowNumber), String(statusPagamento), String(dataPagamento || ''));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
