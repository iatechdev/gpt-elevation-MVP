// ES-155 (tramo B): textos nuevos de entrar, crear cuenta y recuperar acceso en ES y EN. Los textos que ya existían siguen en `landing.access.*` (CMS, con respaldo).
// Sin promesas de empleo ni de resultados; la nota de privacidad NO dice «consentimiento» (la casilla de ES-301 dice «acepto», no «consentimiento»).
export const accessEs = {
  'access.tagline': 'Tu acompañamiento no clínico y tu mapa de capacidades.',
  'access.err_name': 'Escribe tu nombre.',
  'access.err_email': 'Escribe un correo válido, por ejemplo nombre@ejemplo.com.',
  'access.err_password': 'Escribe tu contraseña.',
  'access.fix_fields': 'Revisa los campos marcados.',
  'access.no_payment': 'Por ahora no hay pago en línea: crear una cuenta no te cobra nada.',
  'access.privacy_note': 'Tus conversaciones y tu diario son privados: solo tú los ves. Puedes leer cómo cuidamos tus datos en',
  'access.privacy_link': 'Privacidad',
  'access.show': 'Mostrar', 'access.hide': 'Ocultar',
  'access.no_account': '¿Aún no tienes cuenta?', 'access.have_account': '¿Ya tienes cuenta?',
  'access.sign_in': 'Entrar', 'access.sign_up': 'Crear cuenta',
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
  'access.privacy_note': 'Your conversations and your journal are private: only you can see them. You can read how we look after your data in',
  'access.privacy_link': 'Privacy',
  'access.show': 'Show', 'access.hide': 'Hide',
  'access.no_account': 'Do not have an account yet?', 'access.have_account': 'Already have an account?',
  'access.sign_in': 'Sign in', 'access.sign_up': 'Create account',
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
