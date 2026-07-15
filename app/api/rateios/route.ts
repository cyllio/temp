import { NextResponse } from 'next/server';
import { criarRateio, fetchRateios } from '@/lib/sheets';

export async function GET() {
  try {
    const rateios = await fetchRateios();
    return NextResponse.json({ rateios });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dataEmail, assunto, remetente, chavePix, valorTotalRateio, participantes } = body;

    if (!assunto || !Array.isArray(participantes) || participantes.length === 0) {
      return NextResponse.json({ error: 'Dados incompletos para criar o rateio.' }, { status: 400 });
    }
    if (participantes.some((p: any) => !p.pessoa || typeof p.pessoa !== 'string' || !p.pessoa.trim())) {
      return NextResponse.json({ error: 'Todos os participantes precisam de um nome.' }, { status: 400 });
    }

    const total = Number(valorTotalRateio);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: 'Valor total do rateio inválido.' }, { status: 400 });
    }

    const somaIndividuais = participantes.reduce(
      (acc: number, p: any) => acc + (Number.isFinite(Number(p.valorIndividual)) ? Number(p.valorIndividual) : 0),
      0
    );
    if (Math.abs(somaIndividuais - total) > 0.05) {
      return NextResponse.json(
        {
          error: `A soma dos valores individuais (R$ ${somaIndividuais.toFixed(2)}) não bate com o valor total (R$ ${total.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    await criarRateio({
      dataEmail: dataEmail || new Date().toISOString().slice(0, 10),
      assunto,
      remetente: remetente || '',
      chavePix: chavePix || '',
      valorTotalRateio: total,
      participantes: participantes.map((p: any) => ({
        pessoa: String(p.pessoa).trim(),
        valorIndividual: Number(p.valorIndividual),
      })),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
