import { badRequest } from './errors.js';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_ANSWER_SECONDS = 300;

// What browsers' MediaRecorder produces: WebM/Opus (Chrome, Edge, Firefox) and MP4/AAC (Safari).
const FORMATS = [
  { mime: 'audio/webm', matches: (b) => b.readUInt32BE(0) === 0x1a45dfa3 }, // EBML header
  { mime: 'audio/ogg', matches: (b) => b.subarray(0, 4).toString('latin1') === 'OggS' },
  { mime: 'audio/mp4', matches: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  { mime: 'audio/wav', matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE' },
  { mime: 'audio/mpeg', matches: (b) => b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
];

// Identifies the format from the file's first bytes rather than trusting the client's label.
export function detectAudioFormat(buffer) {
  if (!buffer || buffer.length < 12) throw badRequest('That recording is empty or too short');
  const format = FORMATS.find((f) => f.matches(buffer));
  if (!format) throw badRequest('That recording isn’t in a supported audio format');
  return format.mime;
}
