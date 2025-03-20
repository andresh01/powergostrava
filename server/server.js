const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const app = express();
const port = 3000;
var accessToken = '';

// Servir los archivos estáticos (HTML, CSS, JS) desde la carpeta 'public'
app.use(express.static(path.join(__dirname, '../public')));

// Función para renovar el access_token
async function refreshAccessToken() {
    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });
        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token; // Actualiza el refresh_token si es necesario
    } catch (error) {
        console.error('Error al renovar el token de acceso:', error);
    }
}

// Ruta para iniciar el proceso de autenticación con Strava
app.get('/auth/strava', (req, res) => {
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${process.env.REDIRECT_URI}&scope=read,activity:read_all`;
    res.redirect(authUrl);
});

// Ruta de callback donde Strava redirige después de la autenticación
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;

    try {
        // Intercambiar el código por un token de acceso
        const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            refresh_token: process.env.REFRESH_TOKEN,
            grant_type: 'refresh_token',
            code: code
        });
        accessToken = tokenResponse.data.access_token;
        refreshToken = tokenResponse.data.refresh_token; // Guarda el refresh_token
        
        // Guardar el token de acceso en la sesión del usuario
        //req.session.accessToken = accessToken;
        
        // Redirigir al cliente con la información del usuario y los segmentos favoritos
        res.redirect(`/segments.html`);
    } catch (error) {
        console.error('Error al obtener el token de acceso:', error);
        res.status(500).send('Error autenticando con Strava.');
        
    }
});


app.get('/api/userinfo', async (req, res) => {
    // Usa el token de acceso almacenado en la sesión o en una base de datos.
    //const accessToken = req.session.accessToken;

    if (!accessToken) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    try {
        // Solicitud para obtener la información del usuario
        const userInfoResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // Enviar los datos al frontend
        res.json(
            userInfoResponse.data
        );
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // Token expirado, intentar renovarlo
            await refreshAccessToken();
            return res.redirect('/api/userinfo'); // Reintentar la solicitud
        }
        res.status(500).json({ error: 'Error al obtener la información' });
    }
});

app.get('/api/userSegmentsStarred', async (req, res) => {

    if (!accessToken) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    try {
        var { page }= req.query;
        var { per_page } = req.query;

        // Solicitud para obtener los segmentos favoritos
        const starredSegmentsResponse = await axios.get(`https://www.strava.com/api/v3/segments/starred?page=${page}&per_page=${per_page}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // Enviar los datos al frontend
        res.json(
            starredSegmentsResponse.data
        );
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la información' });
    }
});

app.get('/api/segmentInfo', async (req, res) => {

    if (!accessToken) {
        return res.status(401).json({ status_code: 401,error: 'Usuario no autenticado' });
    }

    try {
        const { id } = req.query;
        
        // Solicitud para obtener los segmentos favoritos
        const oneStarredSegmentResponse = await axios.get(`https://www.strava.com/api/v3/segments/${id}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // Enviar los datos al frontend
        res.json(
            oneStarredSegmentResponse.data
        );
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // Token expirado, intentar renovarlo
            await refreshAccessToken();
            return res.redirect(`/api/segmentInfo?id=${id}`); // Reintentar la solicitud
        }
        res.status(500).json({ error: 'Error al obtener la información' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});

app.get("/ping", (req, res) => {
    res.send("OK");
});

