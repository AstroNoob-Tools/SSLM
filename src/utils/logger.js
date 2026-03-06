'use strict';
const fs = require('fs-extra');
const path = require('path');

// Save originals before server.js overrides console — logger always writes
// to the real console regardless of any overrides applied later.
const _orig = {
    log:   console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
};

class Logger {
    constructor() {
        this.logDir = null;
        this.currentDate = null;
        this.stream = null;
    }

    /**
     * Initialise file logging. Call once after configDir is known.
     * Safe to call more than once (re-init is a no-op if logDir hasn't changed).
     * @param {string} logDir - Absolute path to the log directory.
     */
    init(logDir) {
        if (this.logDir === logDir) return;
        this.logDir = logDir;
        try {
            fs.ensureDirSync(logDir);
        } catch (err) {
            _orig.error('[Logger] Cannot create log directory, file logging disabled:', err.message);
            this.logDir = null;
        }
    }

    _getStream() {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        if (today !== this.currentDate) {
            // Date rolled over — close current stream and open a new file
            if (this.stream) {
                try { this.stream.end(); } catch (_) {}
                this.stream = null;
            }
            this.currentDate = today;
            if (this.logDir) {
                const logFile = path.join(this.logDir, `sslm-${today}.log`);
                try {
                    this.stream = fs.createWriteStream(logFile, { flags: 'a' });
                    this.stream.on('error', () => { this.stream = null; });
                } catch (_) {}
            }
        }
        return this.stream;
    }

    _write(level, args) {
        const ts = new Date().toISOString();
        const msg = args.map(a =>
            a instanceof Error  ? `${a.message}\n${a.stack}` :
            typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)
        ).join(' ');

        const stream = this._getStream();
        if (stream) {
            try { stream.write(`${ts} [${level.padEnd(5)}] ${msg}\n`); } catch (_) {}
        }

        // Pass through to the real console
        if (level === 'ERROR') _orig.error(msg);
        else if (level === 'WARN')  _orig.warn(msg);
        else                        _orig.log(msg);
    }

    info(...args)  { this._write('INFO',  args); }
    warn(...args)  { this._write('WARN',  args); }
    error(...args) { this._write('ERROR', args); }
    debug(...args) { this._write('DEBUG', args); }
}

module.exports = new Logger();
