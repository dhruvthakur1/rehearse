import JSZip from 'jszip';

export const RESUME_LINES = [
  'Riya Sharma',
  'riya@example.com | Pune',
  'Education',
  'B.Tech in Computer Science, Example University, CGPA 8.9',
  'Experience',
  'Backend Intern at Example Labs: built REST APIs with Node.js and Express and cut API latency by 40 percent.',
  'Projects',
  'Food Finder - React, Node.js, MongoDB: a restaurant discovery app with JWT login and map search.',
  'Chat Server - Java and Redis: a websocket chat service handling 2,000 concurrent users in load tests.',
  'Skills',
  'Languages: Java, JavaScript, Python, SQL. Tools: Docker, Git, Linux, AWS.',
  'Core CS: Data Structures and Algorithms, OOP, DBMS, Operating Systems.',
];

// Builds a small but valid one-page PDF with a real text layer.
export function makePdf(lines = RESUME_LINES) {
  const esc = (s) => s.replace(/[\\()]/g, (m) => `\\${m}`);
  const content = `BT /F1 11 Tf 50 780 Td 14 TL\n${lines.map((l) => `(${esc(l)}) Tj T*`).join('\n')}\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

// Builds a minimal valid DOCX (a ZIP of WordprocessingML parts).
export async function makeDocx(paragraphs = RESUME_LINES) {
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    '_rels/.rels',
    `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    'word/document.xml',
    `${head}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`)
      .join('')}</w:body></w:document>`
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
