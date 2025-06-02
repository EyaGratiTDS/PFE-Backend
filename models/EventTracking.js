const { DataTypes } = require("sequelize");
const sequelize = require("./../database/sequelize");

const EventTracking = sequelize.define('EventTracking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  eventType: {
    type: DataTypes.ENUM(
      'view',   // Chargement initial de la vCard
      'click',  // Clic sur un élément
      'download',   // Téléchargement du contact
      'share',  // Partage de la vCard
      'heartbeat',  // Ping régulier (30s)
      'mouse_move', // Mouvement souris (heatmaps)
      'scroll', // Défilement de page
      'hover',  // Survol d'élément
      'suspicious_activity',  // Comportement anormal détecté     // Sécurité
      'preference_updated',    // Changement de préférences utilisateur         // Personnalisation
      'attention_event'      // Détection de regard/focus           // Reconnaissance IA (nécessite consentement)
    ),
    allowNull: false
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('metadata');
      return value ? JSON.parse(value) : null;
    },
    set(value) {
      this.setDataValue('metadata', value ? JSON.stringify(value) : null);
    }
  },
  duration: {
    type: DataTypes.INTEGER,
    comment: 'Duration in seconds'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  blockId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  deviceType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  os: {
    type: DataTypes.STRING,
    allowNull: true
  },
  browser: {
    type: DataTypes.STRING,
    allowNull: true
  },
  language: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pixelId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'pixels',
      key: 'id'
    }
  },
  source: {
    type: DataTypes.ENUM(
      'meta_pixel',
      'internal_tracking',
      'google_analytics'
    ),
    defaultValue: 'internal_tracking',
    allowNull: false
  },
}, {
  tableName: 'event_trackings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

EventTracking.associate = models => {
  EventTracking.belongsTo(models.Pixel, {
    foreignKey: 'pixelId',
    as: 'Pixel'
  });
};

module.exports = EventTracking;