import mammoth from 'mammoth';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';
import { AppError, badRequest } from './errors.js';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const RESUME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// Browsers sometimes send a generic MIME type, so fall back to the extension.
export function detectType(file) {
  if (RESUME_TYPES[file.mimetype]) return RESUME_TYPES[file.mimetype];
  const ext = file.originalname.toLowerCase().split('.').pop();
  return ext === 'pdf' || ext === 'docx' ? ext : null;
}

// Real files start with fixed "magic" bytes; checking them stops a renamed .exe from being parsed.
function hasValidSignature(buffer, type) {
  if (type === 'pdf') return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (type === 'docx') return buffer[0] === 0x50 && buffer[1] === 0x4b; // ZIP container ("PK")
  return false;
}

export function normaliseText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[•●▪■◦]/g, '•')
    .replace(/ +/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractResumeText(buffer, type) {
  if (!hasValidSignature(buffer, type)) {
    throw badRequest(`That file doesn’t look like a real ${type.toUpperCase()} document`);
  }

  let raw;
  try {
    if (type === 'pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      ({ text: raw } = await extractPdfText(pdf, { mergePages: true }));
    } else {
      ({ value: raw } = await mammoth.extractRawText({ buffer }));
    }
  } catch {
    throw badRequest('We couldn’t open that file. It may be damaged or password-protected.');
  }

  const text = normaliseText(raw || '');
  if (text.split(/\s+/).filter(Boolean).length < 40) {
    // Scanned (image-only) PDFs have no text layer.
    throw new AppError(422, 'We couldn’t find enough text in that file. If it’s a scanned PDF, export it from Word or Google Docs instead.');
  }
  return text;
}

// ---- Lightweight analysis (Gemini takes over in the question-generation phase) ----

const SKILLS = [
  ['C++', /(^|[^\w])c\+\+(?![\w+])/i],
  ['C#', /(^|[^\w])c#(?!\w)/i],
  ['JavaScript', /\bjavascript\b/i],
  ['TypeScript', /\btypescript\b/i],
  ['Python', /\bpython\b/i],
  ['Java', /\bjava\b(?!\s*script)/i],
  ['Go', /\bgolang\b/i],
  ['Rust', /\brust\b/i],
  ['Kotlin', /\bkotlin\b/i],
  ['Swift', /\bswift\b/i],
  ['SQL', /\bsql\b/i],
  ['React', /\breact(\.js|js)?\b(?!\s*native)/i],
  ['React Native', /\breact\s*native\b/i],
  ['Next.js', /\bnext\.?js\b/i],
  ['Vue', /\bvue(\.js)?\b/i],
  ['Angular', /\bangular\b/i],
  ['Node.js', /\bnode(\.js|js)?\b/i],
  ['Express', /\bexpress(\.js)?\b/i],
  ['Django', /\bdjango\b/i],
  ['Flask', /\bflask\b/i],
  ['FastAPI', /\bfastapi\b/i],
  ['Spring Boot', /\bspring\s*boot\b/i],
  ['REST APIs', /\brest(ful)?\s*apis?\b/i],
  ['GraphQL', /\bgraphql\b/i],
  ['MongoDB', /\bmongo(db)?\b/i],
  ['PostgreSQL', /\bpostgres(ql)?\b/i],
  ['MySQL', /\bmysql\b/i],
  ['Redis', /\bredis\b/i],
  ['Firebase', /\bfirebase\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\bkubernetes\b|\bk8s\b/i],
  ['AWS', /\baws\b|amazon web services/i],
  ['GCP', /\bgcp\b|google cloud/i],
  ['Azure', /\bazure\b/i],
  ['Git', /\bgit\b(?!hub)/i],
  ['GitHub Actions', /\bgithub actions\b/i],
  ['Linux', /\blinux\b/i],
  ['HTML', /\bhtml5?\b/i],
  ['CSS', /\bcss3?\b/i],
  ['Tailwind', /\btailwind\b/i],
  ['Machine Learning', /\bmachine learning\b|\bml\b/i],
  ['Deep Learning', /\bdeep learning\b/i],
  ['TensorFlow', /\btensorflow\b/i],
  ['PyTorch', /\bpytorch\b/i],
  ['scikit-learn', /\bscikit[- ]learn\b|\bsklearn\b/i],
  ['Pandas', /\bpandas\b/i],
  ['NumPy', /\bnumpy\b/i],
  ['NLP', /\bnlp\b|natural language processing/i],
  ['LLMs', /\bllms?\b|large language model/i],
  ['Data Structures & Algorithms', /\bdata structures\b|\bdsa\b/i],
  ['OOP', /\boop\b|object[- ]oriented/i],
  ['DBMS', /\bdbms\b/i],
  ['Operating Systems', /\boperating systems?\b/i],
  ['Computer Networks', /\bcomputer networks?\b/i],
  ['System Design', /\bsystem design\b/i],
  ['JWT', /\bjwt\b/i],
  ['Stripe', /\bstripe\b/i],
  ['Figma', /\bfigma\b/i],
];

const SECTION_HEADINGS = [
  ['Summary', /^(professional\s+)?(summary|profile|objective|about me)$/i],
  ['Education', /^education$/i],
  ['Experience', /^(work\s+|professional\s+)?experience$|^employment( history)?$/i],
  ['Internships', /^internships?$/i],
  ['Projects', /^(academic\s+|personal\s+|key\s+)?projects$/i],
  ['Skills', /^(technical\s+)?skills$/i],
  ['Certifications', /^certifications?( & achievements)?$/i],
  ['Achievements', /^(achievements|awards)( & certifications)?$/i],
];

export function analyseResume(text) {
  const skills = SKILLS.filter(([, re]) => re.test(text)).map(([name]) => name);
  const lines = text.split('\n').map((l) => l.replace(/[:|]+$/, '').trim());
  const sections = SECTION_HEADINGS.filter(([, re]) => lines.some((l) => l.length < 40 && re.test(l))).map(([name]) => name);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { skills, sections, wordCount };
}
