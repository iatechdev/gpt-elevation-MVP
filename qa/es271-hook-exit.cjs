const orig = process.exit; process.exit = function (c) { console.error('HOOK process.exit(', c, ') desde:', new Error().stack.split('\n').slice(2, 5).join(' | ').replace(/\s+/g, ' ')); return orig.call(process, c) }
process.on('exit', c => console.error('HOOK exit code=', c, 'process.exitCode=', process.exitCode))
