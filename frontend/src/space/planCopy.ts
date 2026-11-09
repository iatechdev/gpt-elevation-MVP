// ES-174: textos de «Mi plan» (ES con tuteo / EN). Sin pago en línea y sin cancelar solicitudes: el servidor no lo permite y la pantalla lo dice.
export const planCopy = {
  es: {
    title: 'Mi plan', menu: 'Mi plan', intro: 'Aquí ves tu plan y puedes pedir un cambio.',
    currentTitle: 'Plan actual', noPlan: 'Aún no tienes un plan asignado.', loading: 'Cargando tu plan…', loadError: 'No pudimos cargar tu plan.', retry: 'Reintentar',
    pendingTitle: 'Solicitud pendiente', pendingBody: 'Pediste el plan {plan}. El equipo la revisa. Por ahora no se puede cancelar desde aquí.', pendingUnknown: 'Tienes una solicitud de plan en revisión. Por ahora no se puede cancelar desde aquí.',
    changeTitle: 'Cambiar de plan', plansLoading: 'Cargando los planes…', plansError: 'No pudimos cargar los planes.', noPlans: 'Por ahora no hay planes para elegir.',
    request: 'Solicitar este plan', sending: 'Enviando…', isCurrent: 'Es tu plan actual.', waitPending: 'Tienes una solicitud pendiente.',
    approval: 'Los planes de pago pasan por aprobación del equipo; no hay pago en línea.',
    submitted: 'Registramos tu solicitud. El equipo la revisa.', alreadyPending: 'Ya tienes una solicitud pendiente.', unknown: 'No pudimos confirmar tu solicitud. Revisa si quedó registrada antes de volver a intentarlo.', unavailable: 'Ese plan ya no está disponible.',
    free: 'Gratis', month: 'al mes', year: 'al año',
  },
  en: {
    title: 'My plan', menu: 'My plan', intro: 'Here you see your plan and can ask for a change.',
    currentTitle: 'Current plan', noPlan: "You don't have a plan yet.", loading: 'Loading your plan…', loadError: 'We could not load your plan.', retry: 'Try again',
    pendingTitle: 'Pending request', pendingBody: 'You asked for the {plan} plan. The team is reviewing it. For now it cannot be cancelled from here.', pendingUnknown: 'You have a plan request under review. For now it cannot be cancelled from here.',
    changeTitle: 'Change plan', plansLoading: 'Loading the plans…', plansError: 'We could not load the plans.', noPlans: 'There are no plans to choose from right now.',
    request: 'Request this plan', sending: 'Sending…', isCurrent: 'This is your current plan.', waitPending: 'You have a pending request.',
    approval: 'Paid plans are approved by the team; there is no online payment.',
    submitted: 'We registered your request. The team is reviewing it.', alreadyPending: 'You already have a pending request.', unknown: 'We could not confirm your request. Check whether it was registered before trying again.', unavailable: 'That plan is no longer available.',
    free: 'Free', month: 'per month', year: 'per year',
  },
} as const
