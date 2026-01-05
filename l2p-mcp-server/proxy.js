import net from 'net';

const LOCAL_PORT = 5435;
const REMOTE_PORT = 5432;
const REMOTE_HOST = 'localhost';

const server = net.createServer((socket) => {
    console.log('New connection to proxy');
    const client = net.createConnection(REMOTE_PORT, REMOTE_HOST, () => {
        socket.pipe(client);
        client.pipe(socket);
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        client.end();
    });
    client.on('error', (err) => {
        console.error('Remote error:', err);
        socket.end();
    });
});

server.listen(LOCAL_PORT, () => {
    console.log(`Proxying ${LOCAL_PORT} -> ${REMOTE_PORT}`);
});
