// ES-155 (tramo B): textos nuevos de entrar, crear cuenta y recuperar acceso en ES y EN. Los textos que ya existían siguen en `landing.access.*` (CMS, con respaldo).
// Sin promesas de empleo ni de resultados; la nota de privacidad NO dice «consentimiento» (la casilla de ES-301 dice «acepto», no «consentimiento»).
export const accessEs = {
  'access.tagline': 'Tu acompañamiento no clínico y tu mapa de capacidades.',
  'access.err_name': 'Escribe tu nombre.',
  'access.err_email': 'Escribe un correo válido, por ejemplo nombre@ejemplo.com.',
  'access.err_password': 'Escribe tu contraseña.',
  'access.fix_fields': 'Revisa los campos marcados.',
  'access.no_payment': 'Por ahora no hay pago en línea: crear una cuenta no te cobra nada.',
  // ES-360: ya no dice «solo tú los ves» (podía leerse como que ni la IA ni un proveedor procesan lo que escribes). Dice qué ve cada actor; nada sobre el equipo de Elevation (no verificado).
  'access.privacy_note': 'Tu profesional no puede leer tus conversaciones con el asistente ni tu diario. Para responderte, el asistente usa inteligencia artificial: lo que escribes se procesa con un proveedor externo. Los detalles están en el',
  'access.privacy_link': 'aviso de privacidad',
  'access.show': 'Mostrar', 'access.hide': 'Ocultar',
  'access.no_account': '¿Aún no tienes cuenta?', 'access.have_account': '¿Ya tienes cuenta?',
  'access.sign_in': 'Iniciar sesión', 'access.sign_up': 'Crear cuenta',
  // ES-359 (PR6): con una sesión abierta, «Crear cuenta» no muestra el formulario sino este aviso. Textos aprobados en ES-359 (sin nombre guardado, se usa la forma corta).
  'access.session_open': 'Ya tienes una sesión abierta como {name}.', 'access.session_open_noname': 'Ya tienes una sesión abierta.',
  'access.session_continue': 'Seguir con mi sesión', 'access.session_signout_new': 'Cerrar sesión para crear una cuenta nueva',
  'access.session_form_hidden': 'El formulario de registro queda oculto mientras haya una sesión abierta.',
  // ES-301: casilla del aviso de privacidad y términos (sin la palabra «consentimiento» hasta que el texto tenga revisión legal)
  'access.terms_a': 'He leído y acepto el ', 'access.terms_privacy': 'aviso de privacidad', 'access.terms_and': ' y los ', 'access.terms_terms': 'términos de uso', 'access.terms_end': '.',
  'access.terms_new_tab': 'se abre en una pestaña nueva',
  'access.err_terms': 'Para crear tu cuenta necesitas aceptar el aviso de privacidad y los términos.',
  'access.terms_changed': 'El aviso cambió. Recarga la página y vuelve a aceptar.',
  // ES-326: aceptar una invitación.
  'access.invite_title': 'Crea tu cuenta', 'access.invite_intro': 'Te invitaron a Elevation. Elige cómo te llamas y una contraseña.',
  'access.invite_submit': 'Crear cuenta', 'access.invite_busy': 'Creando tu cuenta…',
  'access.invite_done_title': 'Cuenta creada', 'access.invite_done': 'Tu cuenta está lista. Inicia sesión para entrar.',
  'access.invite_invalid_title': 'Este enlace no sirve', 'access.invite_invalid': 'El enlace de invitación venció, ya se usó o no es válido. Pídele a quien te invitó que te envíe uno nuevo.',
}
export const accessEn: Record<keyof typeof accessEs, string> = {
  'access.tagline': 'Your non-clinical support and your skills map.',
  'access.err_name': 'Enter your name.',
  'access.err_email': 'Enter a valid email, for example name@example.com.',
  'access.err_password': 'Enter your password.',
  'access.fix_fields': 'Check the marked fields.',
  'access.no_payment': 'There is no online payment for now: creating an account does not charge you anything.',
  'access.privacy_note': 'Your professional cannot read your conversations with the assistant or your journal. To reply, the assistant uses artificial intelligence: what you write is processed by an external provider. The details are in the',
  'access.privacy_link': 'privacy notice',
  'access.show': 'Show', 'access.hide': 'Hide',
  'access.no_account': 'Do not have an account yet?', 'access.have_account': 'Already have an account?',
  'access.sign_in': 'Sign in', 'access.sign_up': 'Create account',
  'access.session_open': 'You already have a session open as {name}.', 'access.session_open_noname': 'You already have a session open.',
  'access.session_continue': 'Continue with my session', 'access.session_signout_new': 'Sign out to create a new account',
  'access.session_form_hidden': 'The sign-up form stays hidden while a session is open.',
  'access.terms_a': 'I have read and accept the ', 'access.terms_privacy': 'privacy notice', 'access.terms_and': ' and the ', 'access.terms_terms': 'terms of use', 'access.terms_end': '.',
  'access.terms_new_tab': 'opens in a new tab',
  'access.err_terms': 'To create your account you need to accept the privacy notice and the terms.',
  'access.terms_changed': 'The notice changed. Reload the page and accept again.',
  // ES-326: accepting an invitation.
  'access.invite_title': 'Create your account', 'access.invite_intro': 'You were invited to Elevation. Choose your name and a password.',
  'access.invite_submit': 'Create account', 'access.invite_busy': 'Creating your account…',
  'access.invite_done_title': 'Account created', 'access.invite_done': 'Your account is ready. Sign in to get in.',
  'access.invite_invalid_title': 'This link does not work', 'access.invite_invalid': 'The invitation link has expired, was already used or is not valid. Ask the person who invited you to send a new one.',
}
