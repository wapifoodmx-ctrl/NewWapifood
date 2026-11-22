import { downloadBytes } from "@/lib/printDocument";

const WIN = {
  á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa, ü: 0xfc, ñ: 0xf1,
  Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda, Ü: 0xdc, Ñ: 0xd1,
  "¿": 0xbf, "¡": 0xa1, "°": 0xb0, "\u00a0": 0x20, "\u202f": 0x20,
};

function winAnsi(text) {
  const bytes = [];
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0);
    if (code >= 32 && code <= 126) bytes.push(code);
    else if (WIN[ch] != null) bytes.push(WIN[ch]);
    else bytes.push(0x3f);
  }
  return bytes;
}

function latin1(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function pdfText(line) {
  const bytes = winAnsi(line).slice(0, 90);
  let out = "(";
  for (const byte of bytes) {
    if (byte === 0x5c || byte === 0x28 || byte === 0x29) out += "\\";
    out += String.fromCharCode(byte);
  }
  return `${out}) Tj`;
}

/** PDF de una página. Los bytes y el índice usan la misma medida, si no el visor abre una hoja en blanco. */
export function downloadTicketPdf({ filename, lines }) {
  const commands = ["BT", "/F1 11 Tf", "36 780 Td", "14 TL"];
  lines.slice(0, 48).forEach((line, index) => {
    if (index) commands.push("T*");
    commands.push(pdfText(line));
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >> endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  downloadBytes({
    filename,
    bytes: latin1(pdf),
    type: "application/pdf",
  });
}
