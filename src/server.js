
const app = require('./app');
const { connectDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await connectDatabase();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${ PORT } `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
