import db from "../models/index.js";



export const connectDB=async()=>await db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
if(connectDB)console.log('Database synced.');
