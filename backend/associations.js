const setupAssociations = () => {
  const User                   = require('./User');
  const Message                = require('./Message');
  const MoodLog                = require('./MoodLog');
  const SessionRating          = require('./SessionRating');
  const ClinicalNote           = require('./ClinicalNote');
  const WellnessRecommendation = require('./WellnessRecommendation');
  const TherapistProfile       = require('./TherapistProfile');
  const MatchingRequest        = require('./MatchingRequest');
  const TherapySession         = require('./TherapySession');
  const SessionNote            = require('./SessionNote');

  User.hasMany(Message);
  Message.belongsTo(User);
  User.hasMany(MoodLog);
  MoodLog.belongsTo(User);
  User.hasMany(SessionRating);
  SessionRating.belongsTo(User);
  User.hasMany(ClinicalNote,             { foreignKey: 'UserId' });
  ClinicalNote.belongsTo(User,           { foreignKey: 'UserId' });
  User.hasMany(WellnessRecommendation,   { foreignKey: 'UserId' });
  WellnessRecommendation.belongsTo(User, { foreignKey: 'UserId' });
  User.hasOne(TherapistProfile,          { foreignKey: 'UserId' });
  TherapistProfile.belongsTo(User,       { foreignKey: 'UserId' });
  User.hasMany(MatchingRequest,          { foreignKey: 'UserId' });
  MatchingRequest.belongsTo(User,        { foreignKey: 'UserId' });

  User.hasMany(TherapySession, { foreignKey: 'therapistId', as: 'therapistSessions' });
  User.hasMany(TherapySession, { foreignKey: 'patientId',   as: 'patientSessions'   });
  TherapySession.belongsTo(User, { foreignKey: 'therapistId', as: 'therapist' });
  TherapySession.belongsTo(User, { foreignKey: 'patientId',   as: 'patient'   });
  TherapySession.hasMany(SessionNote, { foreignKey: 'sessionId' });
  SessionNote.belongsTo(TherapySession, { foreignKey: 'sessionId' });

  console.log('✅ Asociaciones configuradas.');
};

module.exports = setupAssociations;