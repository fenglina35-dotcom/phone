import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// DATE_INPUT_FIT_V1 (2026-10-21): on iPhone the native date / time boxes ignore width and grow wider and taller
// than every other box, running off the screen (seen in the iOS simulator: the same form before and after).
// Dropping the system look makes them obey width:100% like the rest; it is one rule for the whole small phone.
for (const file of ['glass-theme.css', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css']) {
  test(file + ': date and time boxes are as wide as the other boxes', () => {
    const css = fs.readFileSync(file, 'utf8');
    const KINDS = 'input:is([type=date],[type=time],[type=datetime-local],[type=month],[type=week])';
    assert(css.includes('DATE_INPUT_FIT_V1'));
    assert(css.includes(KINDS + '{-webkit-appearance:none;appearance:none;box-sizing:border-box;min-width:0;min-inline-size:0;max-width:100%;max-inline-size:100%;'), 'no system look, never wider than its box');
    assert(css.includes('.field ' + KINDS + '{display:block;width:100%;min-height:40px}'), 'form fields fill the row and keep their height when empty');
    assert(css.includes(KINDS + '::-webkit-date-and-time-value{min-width:0;margin:0;text-align:left}'));
    assert(css.lastIndexOf('DATE_INPUT_FIT_V1') > css.lastIndexOf('[type=date]') - 2000, 'the rule sits at the end so later rules do not undo it');
  });
}
