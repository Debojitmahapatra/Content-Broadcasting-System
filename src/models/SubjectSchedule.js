import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SubjectSchedule = sequelize.define(
  'SubjectSchedule',
  {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    subject: {
      type: DataTypes.ENUM('Maths', 'Science', 'English', 'Social', 'Computers'),
      unique: true,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'subject_schedules',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['subject'],
      },
    ],
  }
);

export default SubjectSchedule;
