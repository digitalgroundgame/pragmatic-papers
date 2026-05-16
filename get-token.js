#!/usr/bin/env node
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/^GH_FONT_READ=(.*)$/m);
if (match) {
  // eslint-disable-next-line no-console
  console.log(match[1].trim());
}
