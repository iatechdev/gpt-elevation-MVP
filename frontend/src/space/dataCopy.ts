// ES-135: textos de «Mis datos» (ES con tuteo / EN). Sin promesas de plazo: el servidor declara que los plazos de borrado no están verificados.
export const dataCopy = {
  es: {
    title: 'Mis datos', menu: 'Mis datos',
    intro: 'Aquí puedes llevarte una copia de tus datos o pedir que eliminemos tu cuenta. Solo tú los ves.',
    exportTitle: 'Exportar mis datos', exportBody: 'Un archivo JSON con tus datos personales. Prepara una vista previa y luego descárgalo.',
    prepare: 'Preparar vista previa', preparing: 'Preparando…', sections: 'Qué incluye: {list}', noSections: 'El archivo no trae secciones con datos.',
    validUntil: 'Disponible hasta las {time}.', download: 'Descargar archivo', downloading: 'Descargando…', downloaded: 'Archivo descargado.',
    deleteTitle: 'Eliminar mi cuenta', deleteBody: 'Se desactiva tu cuenta y se cierran tus sesiones de inmediato. No podrás deshacerlo desde esta pantalla.',
    deleteStart: 'Quiero eliminar mi cuenta', deleteAck: 'Entiendo que perderé el acceso a mi cuenta.', deleteConfirm: 'Eliminar mi cuenta', deleting: 'Eliminando…', deleteCancel: 'Cancelar',
    deleteDone: 'Recibimos tu solicitud. Tu cuenta quedó desactivada y tus sesiones se cerraron. Todavía no podemos indicarte una fecha para completar el borrado.', backHome: 'Volver al inicio',
    unavailable: 'Esta función aún no está disponible.', rate: 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.', expired: 'La vista previa venció. Prepárala de nuevo.',
    concurrent: 'Tu cuenta cambió mientras procesábamos la solicitud. Inténtalo de nuevo.', review: 'Tu cuenta requiere una revisión antes de exportar.',
    pending: 'Tu cuenta ya tiene una solicitud de eliminación.', session: 'Tu sesión venció. Inicia sesión para continuar.', login: 'Iniciar sesión', error: 'No pudimos completar la operación. Inténtalo de nuevo.',
  },
  en: {
    title: 'My data', menu: 'My data',
    intro: 'Here you can take a copy of your data or ask us to delete your account. Only you see them.',
    exportTitle: 'Export my data', exportBody: 'A JSON file with your personal data. Prepare a preview, then download it.',
    prepare: 'Prepare preview', preparing: 'Preparing…', sections: 'What it includes: {list}', noSections: 'The file has no sections with data.',
    validUntil: 'Available until {time}.', download: 'Download file', downloading: 'Downloading…', downloaded: 'File downloaded.',
    deleteTitle: 'Delete my account', deleteBody: 'Your account is deactivated and your sessions are closed right away. You will not be able to undo it from this screen.',
    deleteStart: 'I want to delete my account', deleteAck: 'I understand I will lose access to my account.', deleteConfirm: 'Delete my account', deleting: 'Deleting…', deleteCancel: 'Cancel',
    deleteDone: 'We received your request. Your account is deactivated and your sessions are closed. We cannot give you a date for completing the deletion yet.', backHome: 'Back to home',
    unavailable: 'This feature is not available yet.', rate: 'Too many requests. Wait a minute and try again.', expired: 'The preview expired. Prepare it again.',
    concurrent: 'Your account changed while we processed the request. Try again.', review: 'Your account needs a review before exporting.',
    pending: 'Your account already has a deletion request.', session: 'Your session expired. Sign in to continue.', login: 'Sign in', error: 'We could not complete the operation. Try again.',
  },
} as const
