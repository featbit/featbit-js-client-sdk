// This file is only for umd version

const html = document.querySelector('html');
const waittime = 500;
if (html) {
  html.style.visibility = 'hidden';
  setTimeout(() => html.style.visibility = 'visible', waittime);
}

import fbClient from './featbit';
import { logger } from './logger';

logger.logDebug(`version: __VERSION__`);

export { fbClient }
