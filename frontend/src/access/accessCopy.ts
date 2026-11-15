// ES-155 (tramo B): textos nuevos de entrar, crear cuenta y recuperar acceso en ES y EN. Los textos que ya existían siguen en `landing.access.*` (CMS, con respaldo).
// Sin promesas de empleo ni de resultados; la nota de privacidad NO dice «consentimiento» (la casilla de consentimiento llega con ES-301, junto con el registro en el servidor).
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
}
