// Dev-server proxy: the browser only talks to :4200, so no CORS is needed in development.
module.exports = {
  '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:5080', secure: false, changeOrigin: true },
};
