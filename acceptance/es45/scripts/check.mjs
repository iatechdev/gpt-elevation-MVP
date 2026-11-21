import { argumentsOf, loadBundle, PackageError } from '../lib/files.mjs'
import { validatePackage } from '../lib/validate.mjs'
try {
  const options = argumentsOf(process.argv.slice(2)), bundle = loadBundle(options), errors = validatePackage(bundle)
  if (errors.length) { console.error(JSON.stringify({ code: 'invalid_package', errors })); process.exitCode = 2 }
  else console.log(JSON.stringify({ package: 'ES-45', preparationValid: true, families: bundle.cases.families.length, journeys: bundle.journeys.journeys.length, productExecuted: false }))
} catch (e) { console.error(JSON.stringify({ code: e instanceof PackageError ? e.code : 'input_unreadable' })); process.exitCode = 2 }
