import sequelize from '../config/database.js';
import User from './User.js';
import Content from './Content.js';
import SubjectSchedule from './SubjectSchedule.js';
import ScheduleItem from './ScheduleItem.js';

// User <-> Content associations
User.hasMany(Content, { foreignKey: 'uploaded_by' });
Content.belongsTo(User, { as: 'uploader', foreignKey: 'uploaded_by' });
Content.belongsTo(User, { as: 'approver', foreignKey: 'approved_by' });

// Schedule associations
SubjectSchedule.hasMany(ScheduleItem, { foreignKey: 'schedule_id' });
ScheduleItem.belongsTo(SubjectSchedule, { foreignKey: 'schedule_id' });
ScheduleItem.belongsTo(Content, { foreignKey: 'content_id' });

const db = {
  sequelize,
  User,
  Content,
  SubjectSchedule,
  ScheduleItem,
};

export default db;
