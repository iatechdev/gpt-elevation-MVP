const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-221/backend/'; const m = process.argv[2];
const edit = (file, a, b) => { let s = fs.readFileSync(B + file, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 50)); fs.writeFileSync(B + file, s.replace(a, () => b)); };
const DP = 'utils/deletionProcessor.js', PD = 'utils/personalData.js';
const REFS = { r1: "    ['ClinicalNote', { therapistId: userId }],\n", r2: "    ['TherapySession', { therapistId: userId }],\n", r3: "    ['SessionNote', { therapistId: userId }],\n", r4: "    ['TherapistProfile', { UserId: userId }],\n", r5: "    ['TherapistValidation', { therapistId: userId }],\n", r6: "    ['MatchingRequest', { chosenTherapistId: userId }],\n", r7: "    ['EthicManifest', { uploadedBy: userId }],\n", r8: "    ['PlanRequest', { resolvedBy: userId }],\n", r9: "    ['User', { therapistId: userId }],\n" };
if (REFS[m]) edit(PD, REFS[m], '');
if (m === 'r0') edit(PD, "if (await model(name).findOne({ where, attributes: ['id'], transaction })) return true;", "if (false) return true;");
if (m === 's1') edit(DP, "await require('../' + name).destroy({ where: { [owner]: user.id }, transaction });\n      }", "await require('../' + name).destroy({ where: { [owner]: user.id } });\n      }");
if (m === 's2') edit(DP, "for (const [name, owner] of PURGE_ALSO) await require('../' + name).destroy({ where: { [owner]: user.id }, transaction });", "for (const [name, owner] of PURGE_ALSO) await require('../' + name).destroy({ where: { [owner]: user.id } });");
if (m === 's3') edit(DP, "{ where: { patientId: user.id }, transaction });\n      await ExportRequest", "{ where: { patientId: user.id } });\n      await ExportRequest");
if (m === 's4') edit(DP, "      await user.update({\n        name: 'Cuenta eliminada", "      await user.update({\n        name: 'Cuenta eliminada");
if (m === 's4') edit(DP, "onboardingCompleted: false, loginAttempts: 0, lockedUntil: null,\n      }, { transaction });", "onboardingCompleted: false, loginAttempts: 0, lockedUntil: null,\n      }, { transaction }).catch(() => {});");
if (m === 's5') { edit(DP, '  } catch {\n    // The purge rolled back in full.', '  } catch (err) {\n    // The purge rolled back in full.'); edit(DP, "failureCode: replay ? 'active_replay_failed' : 'active_purge_failed',", "failureCode: String(err.message).slice(0, 60),"); }
if (m === 's6') edit(DP, "const attempts = request.attempts + 1;", "if (request.status === 'failed') return receipt(request);\n      const attempts = request.attempts + 1;");
if (m === 's7') edit(DP, "status: 'failed', attempts: row.attempts + 1,", "status: row.status, attempts: row.attempts + 1,");
if (m === 'p1') edit(PD, "const PURGE_ALSO = [['MatchingRequest', 'UserId']];", "const PURGE_ALSO = [['MatchingRequest', 'UserId'], ['ProfessionalApplication', 'userId']];");
console.log('M' + m + ' aplicado');
