import { connectToDB } from "./config/db";
import dotenv from "dotenv";
import http from "http";
import dns from "node:dns";
import app from './app';

dotenv.config();

// Fix for Node.js fetch timeout on networks with broken IPv6
dns.setDefaultResultOrder('ipv4first');


async function startServer() {
    await connectToDB();

    const server = http.createServer(app);

    server.listen(process.env.PORT , () => {
        console.log(`Server is listening on port ${process.env.PORT}`);
    })
}

startServer().catch(error => {
    console.error("Error occur in starting the server!", error);
    process.exit(1);
})