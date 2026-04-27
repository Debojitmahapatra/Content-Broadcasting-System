import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ScheduleItem = sequelize.define(
  'ScheduleItem',
  {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    schedule_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subject_schedules', key: 'id' },
      onDelete: 'CASCADE',
    },
    content_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'contents', key: 'id' },
      onDelete: 'CASCADE',
    },
    rotation_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'schedule_items',
    timestamps: true,
    indexes: [
      { fields: ['schedule_id'] },
      { fields: ['rotation_order'] },
    ],
  }
);

export default ScheduleItem;
