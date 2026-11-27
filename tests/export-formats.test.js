import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExportFileName,
  EXPORT_FORMATS,
  getExportFormat,
  withExportExtension,
} from '../src/audio/export-formats.js';

test('export formats cover WAV, M4A and MP3 with save-dialog metadata', () => {
  assert.deepEqual(EXPORT_FORMATS.map(format => format.id), ['wav', 'm4a', 'mp3']);
  assert.deepEqual(EXPORT_FORMATS.map(format => format.extension), ['wav', 'm4a', 'mp3']);
  assert.deepEqual(EXPORT_FORMATS.map(format => format.mimeType), [
    'audio/wav',
    'audio/mp4',
    'audio/mpeg',
  ]);
  for (const format of EXPORT_FORMATS) {
    assert.ok(format.label);
    assert.ok(format.description.length > 20);
    assert.ok(format.saveDescription);
  }
});

test('unknown formats are rejected', () => {
  assert.equal(getExportFormat('wav').id, 'wav');
  assert.equal(getExportFormat('ogg'), null);
});

test('suggested file names keep the stem and replace the extension', () => {
  assert.equal(withExportExtension('zeeone_rock_100bpm.wav', 'm4a'), 'zeeone_rock_100bpm.m4a');
  assert.equal(withExportExtension('zeeone_loop_2rows_5beats.wav', 'mp3'), 'zeeone_loop_2rows_5beats.mp3');
  assert.equal(withExportExtension('zeeone_export', 'wav'), 'zeeone_export.wav');
  assert.equal(buildExportFileName('name.wav', getExportFormat('m4a')), 'name.m4a');
});
