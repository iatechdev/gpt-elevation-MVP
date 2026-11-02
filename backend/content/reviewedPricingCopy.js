// ES-73 / D-01: conservative ES/EN copy approved for visible, editable plans in 10406.
// This object deliberately contains no price, slug, quota, role or entitlement fields.
const features = {
  features_es: ['Conversación con un asistente de IA no clínico, sujeta a los límites operativos vigentes.', 'Registro de ánimo de entrada y salida.'],
  features_en: ['Conversation with a non-clinical AI assistant, subject to current operational limits.', 'Mood check-in and check-out.'],
};
module.exports = Object.fromEntries([
  ['basic', 'Una forma de comenzar con la conversación y la reflexión en Elevation.', 'A way to start with conversation and reflection in Elevation.'],
  ['essential', 'Un espacio de acompañamiento no clínico con las funciones indicadas en este plan.', 'A space for non-clinical support with the features listed in this plan.'],
  ['plus', 'Para dar continuidad a tu espacio de conversación y reflexión.', 'To continue your space for conversation and reflection.'],
  ['pro', 'Una opción de uso de Elevation con las condiciones indicadas en este plan.', 'An option for using Elevation under the conditions listed in this plan.'],
].map(([slug, description_es, description_en]) => [slug, { description_es, description_en, ...features }]));
