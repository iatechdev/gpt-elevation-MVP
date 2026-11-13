import { argumentsOf, loadBundle, verifyEvidence, writeReports, PackageError } from '../lib/files.mjs'
import { consolidate, markdown } from '../lib/consolidate.mjs'
import { validatePackage } from '../lib/validate.mjs'
try {
  const options = argumentsOf(process.argv.slice(2)), bundle = loadBundle(options)
  const invalid = validatePackage(bundle)
  if (invalid.length) { console.error(JSON.stringify({ code: 'invalid_package', errors: invalid })); process.exitCode = 2 }
  else {
    const artifacts = verifyEvidence(bundle.results, options['evidence-dir'])
    const report = consolidate(bundle, { verified: artifacts.verified })
    report.evidenceErrors = artifacts.errors
    if (artifacts.errors.length) report.integratedAcceptance = 'blocked'
    writeReports(options['out-dir'], JSON.stringify(report, null, 2) + '\n', markdown(report))
    console.log(JSON.stringify({ package: 'ES-45', preparationReady: report.preparationReady, integratedAcceptance: report.integratedAcceptance,
      invitationDecision: report.invitationDecision, pilotReady: false, notVerified: report.coverage.integratedNotVerified, productExecuted: false }))
    // Exit 0 means report generation, never acceptance. Invalid input = 2; no invitation side effect.
    if (artifacts.errors.length) process.exitCode = 2
  }
} catch (e) { console.error(JSON.stringify({ code: e instanceof PackageError ? e.code : 'input_or_output_unavailable' })); process.exitCode = 2 }
