import { google } from 'googleapis';
import type { NovoParticipante, Rateio } from './types';

const SHEET_NAME = process.env.GOOGLE_SHEET_TAB || 'Sheet1';
const DATA_RANGE = `${SHEET_NAME}!A2:I`;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      'Credenciais do Google não configuradas. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY nas variáveis de ambiente.'
    );
  }
  return new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error('GOOGLE_SHEET_ID não configurado nas variáveis de ambiente.');
  }
  return id;
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

// Converte um serial de data do Google Sheets (dias desde 1899-12-30) para "YYYY-MM-DD".
function serialToISODate(serial: number): string {
  const epochMs = Date.UTC(1899, 11, 30);
  const ms = epochMs + serial * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Normaliza célula de data que pode vir como serial numérico, "YYYY-MM-DD" ou "DD/MM/YYYY".
function normalizeDate(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'number') return serialToISODate(raw);
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

// Normaliza célula numérica que pode vir como number, "16.92" ou "16,92".
function normalizeNumero(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizeTexto(raw: unknown): string {
  return raw === undefined || raw === null ? '' : String(raw).trim();
}

export async function fetchRateios(): Promise<Rateio[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: DATA_RANGE,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });

  const values = res.data.values || [];
  const grouped = new Map<string, Rateio>();

  values.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const dataEmail = normalizeDate(row[0]);
    const assunto = normalizeTexto(row[1]);
    const remetente = normalizeTexto(row[2]);
    const pessoa = normalizeTexto(row[3]);
    const valorIndividual = normalizeNumero(row[4]);
    const valorTotalRateio = normalizeNumero(row[5]);
    const chavePix = normalizeTexto(row[6]);
    const statusPagamento = normalizeTexto(row[7]) || 'Pendente';
    const dataPagamento = normalizeDate(row[8]);

    if (!pessoa) return;

    const id = `${dataEmail}__${assunto}`;
    if (!grouped.has(id)) {
      grouped.set(id, {
        id,
        dataEmail,
        assunto,
        remetente,
        chavePix,
        valorTotalRateio,
        participantes: [],
      });
    }
    grouped.get(id)!.participantes.push({
      rowNumber,
      pessoa,
      valorIndividual,
      statusPagamento,
      dataPagamento,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => (a.dataEmail < b.dataEmail ? 1 : -1));
}

export async function updateParticipantePagamento(
  rowNumber: number,
  statusPagamento: string,
  dataPagamento: string
) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${SHEET_NAME}!H${rowNumber}:I${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[statusPagamento, dataPagamento]] },
  });
}

export async function criarRateio(params: {
  dataEmail: string;
  assunto: string;
  remetente: string;
  chavePix: string;
  valorTotalRateio: number;
  participantes: NovoParticipante[];
}) {
  const sheets = getSheetsClient();
  const rows = params.participantes.map((p) => [
    params.dataEmail,
    params.assunto,
    params.remetente,
    p.pessoa,
    p.valorIndividual.toFixed(2),
    params.valorTotalRateio.toFixed(2),
    params.chavePix,
    'Pendente',
    '',
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: DATA_RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}
