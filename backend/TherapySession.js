const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const TherapySession = sequelize.define('TherapySession', {
  therapistId:      { type: DataTypes.INTEGER, allowNull: false },
  patientId:        { type: DataTypes.INTEGER, allowNull: false },
  scheduledAt:      { type: DataTypes.DATE,    allowNull: false },
  startedAt:        { type: DataTypes.DATE,    allowNull: true  },
  endedAt:          { type: DataTypes.DATE,    allowNull: true  },
  duration:         { type: DataTypes.INTEGER, defaultValue: 50 },
  status:           { type: DataTypes.STRING,  defaultValue: 'scheduled' },
  meetingUrl:       { type: DataTypes.STRING,  allowNull: true  },
  recordingUrl:     { type: DataTypes.STRING,  allowNull: true  },
  therapistNote:    { type: DataTypes.TEXT,    allowNull: true  },
  patientMoodAfter: { type: DataTypes.INTEGER, allowNull: true  },
  cancelReason:     { type: DataTypes.STRING,  allowNull: true  },
  googleEventId:    { type: DataTypes.STRING,  allowNull: true  },
});

module.exports = TherapySession;