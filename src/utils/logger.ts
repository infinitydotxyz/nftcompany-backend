const TRACE_LOG = process.env.TRACE_LOG === 'true';
const INFO_LOG = process.env.INFO_LOG === 'true';
const ERROR_LOG = process.env.ERROR_LOG === 'true';

export function error(obj: string | (Error & { lineNumber?: number | string }), ...objs: any[]) {
  if (ERROR_LOG) {
    let msg = '';
    for (const s of objs) {
      msg += ' ' + s;
    }
    console.error('[ERROR]: ' + obj + msg);
    if (typeof obj === 'object') {
      if (obj.message) {
        console.log('\nMessage: ' + obj.message);
      }
      if (obj.lineNumber) {
        console.log('Error line number ' + obj.lineNumber);
      }
      if (obj.stack) {
        console.log('\nStacktrace:');
        console.log('====================');
        console.log(obj.stack);
      }
    }
  }
}

export function trace(obj: string, ...objs: any[]) {
  if (TRACE_LOG) {
    let msg = '';
    for (const s of objs) {
      msg += ' ' + s;
    }
    console.log('[TRACE]: ' + obj + msg);
  }
}

export function log(obj: any, ...objs: any[]) {
  if (INFO_LOG) {
    let msg = '';
    for (const s of objs) {
      msg += ' ' + s;
    }
    console.log('[INFO]: ' + obj + msg);
  }
}
