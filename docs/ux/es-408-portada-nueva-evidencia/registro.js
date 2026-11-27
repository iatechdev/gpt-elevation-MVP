/* ES-409 dentro de ES-408 · Registro e invitación con la declaración de mayoría de edad. DISEÑO, no es producto.
   Textos de la casilla: IDÉNTICOS al diseño aprobado (ES-409, comentarios 13026 y 13027). REF = textos que YA existen hoy
   (accessCopy.ts, interfaceCopy y shared/landing-content.json); se muestran para dar contexto y no cambian. */
(function () {
  'use strict'
  var REF = {
    register: ['Crear cuenta', 'Create account'], subtitle: ['Tu acompañamiento no clínico y tu mapa de capacidades.', 'Your non-clinical support and your capability map.'],
    invite_title: ['Crea tu cuenta', 'Create your account'], invite_intro: ['Te invitaron a Elevation. Elige cómo te llamas y una contraseña.', 'You were invited to Elevation. Choose your name and a password.'],
    name: ['Nombre', 'Name'], email: ['Correo electrónico', 'Email address'], password: ['Contraseña', 'Password'], show: ['Mostrar', 'Show'], hide: ['Ocultar', 'Hide'],
    err_name: ['Escribe tu nombre.', 'Enter your name.'], err_email: ['Escribe un correo válido, por ejemplo nombre@ejemplo.com.', 'Enter a valid email, for example name@example.com.'], err_password: ['Escribe tu contraseña.', 'Enter your password.'],
    err_terms: ['Para crear tu cuenta necesitas aceptar el aviso de privacidad y los términos.', 'To create your account you need to accept the privacy notice and the terms.'],
    terms_a: ['He leído y acepto el ', 'I have read and accept the '], terms_privacy: ['aviso de privacidad', 'privacy notice'], terms_and: [' y los ', ' and the '], terms_terms: ['términos de uso', 'terms of use'], new_tab: ['se abre en una pestaña nueva', 'opens in a new tab'],
    no_payment: ['Por ahora no hay pago en línea: crear una cuenta no te cobra nada.', 'There is no online payment for now: creating an account does not charge you anything.'],
    submitting: ['Enviando…', 'Submitting…'], invite_busy: ['Creando tu cuenta…', 'Creating your account…'], done_title: ['Cuenta creada', 'Account created'], done: ['Tu cuenta está lista. Inicia sesión para entrar.', 'Your account is ready. Sign in to get in.'],
    have: ['¿Ya tienes cuenta?', 'Already have an account?'], signin: ['Iniciar sesión', 'Sign in']
  }
  window.ES408Access = function (S, t, esc) {
    var r = function (k) { return REF[k][S.lang === 'en' ? 1 : 0] }
    var invite = S.view === 'invitacion', f = S.reg, st = S.regState, E = S.regErrors
    if (st === 'existente') {
      var es = S.lang === 'es'
      return '<div class="authwrap"><div class="card"><p class="badge badge--soon">' + (es ? 'Nota de diseño · no es una pantalla' : 'Design note · not a screen') + '</p><h1>' + (es ? 'Cuentas que ya existen' : 'Existing accounts') + '</h1><ul class="bul"><li>' + (es ? 'Entran igual que hoy: no hay pantalla nueva, aviso ni bloqueo (decisión de ES-409, opción A).' : 'They sign in as today: no new screen, notice or block (ES-409 decision, option A).') + '</li><li>' + (es ? 'No se les inventa una declaración: queda vacía en la base.' : 'No declaration is made up for them: it stays empty in the database.') + '</li><li>' + (es ? 'Condición de salida al piloto: desplegar antes de invitar y volver a crear cualquier cuenta de participante anterior.' : 'Pilot exit condition: deploy before inviting and recreate any earlier participant account.') + '</li></ul><h2>' + (es ? 'En la copia de «Mis datos» (propuesta)' : 'In the “My data” copy (proposal)') + '</h2><dl class="review"><dt>' + t('export.adult_version') + '</dt><dd>' + t('export.adult_none') + '</dd><dt>' + t('export.adult_date') + '</dt><dd>' + t('export.adult_none') + '</dd></dl></div></div>'
    }
    if (st === 'exito') return '<div class="authwrap"><div class="done" role="status"><h1 id="done" tabindex="-1">✓ ' + r('done_title') + '</h1><p>' + r('done') + '</p><div class="row"><button class="btn" data-reg="vacio">' + r('signin') + '</button></div></div></div>'
    var busy = st === 'enviando'
    function input(k, type, auto) {
      var e = E[k]
      return '<div class="field"><label for="reg-' + k + '">' + r(k) + '</label><input id="reg-' + k + '" data-rf="' + k + '" type="' + type + '" autocomplete="' + auto + '" value="' + esc(f[k]) + '"' + (busy ? ' disabled' : '') + (e ? ' aria-invalid="true" aria-describedby="reg-' + k + '-err"' : '') + '>' + (e ? '<p class="err" id="reg-' + k + '-err" role="alert">' + r('err_' + k) + '</p>' : '') + '</div>'
    }
    var adultMsg = E.adult === 'version' ? t('access.err_adult_version') : t('access.err_adult')
    var adult = '<div class="agree"><div class="agree__row"><input type="checkbox" id="access-adult" data-rc="adult"' + (f.adult ? ' checked' : '') + (busy ? ' disabled' : '') + ' aria-describedby="access-adult-help' + (E.adult ? ' access-adult-error' : '') + '"' + (E.adult ? ' aria-invalid="true"' : '') + '><label for="access-adult">' + t('access.adult_label') + '</label></div><p class="agree__help" id="access-adult-help">' + t('access.adult_help') + '</p>' + (E.adult ? '<p class="err" id="access-adult-error" role="alert">' + adultMsg + '</p>' : '') + '</div>'
    var link = function (k) { return '<a href="#" data-noop>' + r(k) + '<span class="sr"> (' + r('new_tab') + ')</span></a>' }
    var terms = '<div class="agree"><div class="agree__row"><input type="checkbox" id="access-terms" data-rc="terms"' + (f.terms ? ' checked' : '') + (busy ? ' disabled' : '') + (E.terms ? ' aria-invalid="true" aria-describedby="access-terms-error"' : '') + '><label for="access-terms">' + r('terms_a') + link('terms_privacy') + r('terms_and') + link('terms_terms') + '.</label></div>' + (E.terms ? '<p class="err" id="access-terms-error" role="alert">' + r('err_terms') + '</p>' : '') + '</div>'
    return '<div class="authwrap"><div class="card auth"><h1>' + r(invite ? 'invite_title' : 'register') + '</h1><p>' + r(invite ? 'invite_intro' : 'subtitle') + '</p><form novalidate data-regform aria-busy="' + busy + '">' + input('name', 'text', 'name') + (invite ? '' : input('email', 'email', 'email')) + input('password', 'password', 'new-password') +
      '<p class="muted small">' + (S.lang === 'es' ? '[Aquí van los requisitos de contraseña de hoy, sin cambios]' : '[Today’s password requirements go here, unchanged]') + '</p>' + adult + terms + (invite ? '' : '<p class="muted small">' + r('no_payment') + '</p>') +
      '<button type="submit" class="btn btn--mark wide"' + (busy ? ' disabled' : '') + '>' + (busy ? r(invite ? 'invite_busy' : 'submitting') : r('register')) + '</button></form>' + (invite ? '' : '<p class="muted">' + r('have') + ' <button type="button" class="link" data-noop>' + r('signin') + '</button></p>') + '</div></div>'
  }
  window.ES408Access.blank = function () { return { name: '', email: '', password: '', adult: false, terms: false } }
  window.ES408Access.filled = function () { return { name: 'Persona de ejemplo', email: 'persona@example.test', password: 'Ejemplo-1234', adult: true, terms: true } }
  /* orden de foco del diseño aprobado: nombre, correo, contraseña, edad, términos */
  window.ES408Access.validate = function (S) {
    var f = S.reg, E = {}
    if (!f.name.trim()) E.name = true
    if (S.view === 'registro' && f.email.indexOf('@') < 1) E.email = true
    if (!f.password) E.password = true
    if (!f.adult) E.adult = true
    if (!f.terms) E.terms = true
    S.regErrors = E
    var first = ['name', 'email', 'password', 'adult', 'terms'].filter(function (k) { return E[k] })[0]
    return first ? (first === 'adult' || first === 'terms' ? '#access-' + first : '#reg-' + first) : null
  }
})()
