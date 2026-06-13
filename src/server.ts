import { connectToDB } from "./config/db";
import dotenv from "dotenv";
import http from "http";
import app from './app';
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
dotenv.config();

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